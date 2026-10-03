-- RS CONECT: módulo Reservas
create extension if not exists btree_gist;

create type public.resource_category as enum ('espaco','equipamento');
create type public.reservation_status as enum ('ativa','cancelada');

create table public.recursos_reserva (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria public.resource_category not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recursos_reserva_nome_len check (char_length(trim(nome)) between 2 and 120)
);

create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  recurso_id uuid not null references public.recursos_reserva(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  inicio timestamptz not null,
  fim timestamptz not null,
  finalidade text not null,
  status public.reservation_status not null default 'ativa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  canceled_at timestamptz,
  canceled_by uuid references auth.users(id),
  constraint reservas_finalidade_len check (char_length(trim(finalidade)) between 3 and 500),
  constraint reservas_intervalo_valido check (fim > inicio),
  constraint reservas_inicio_30min check (extract(minute from (inicio at time zone 'America/Sao_Paulo')) in (0,30)),
  constraint reservas_fim_30min check (extract(minute from (fim at time zone 'America/Sao_Paulo')) in (0,30)),
  constraint reservas_duracao_30min check (mod(extract(epoch from (fim - inicio))::bigint, 1800) = 0)
);

create index recursos_reserva_categoria_ativo_idx on public.recursos_reserva(categoria,ativo,nome);
create index reservas_recurso_inicio_idx on public.reservas(recurso_id,inicio);
create index reservas_created_by_idx on public.reservas(created_by,inicio);

alter table public.reservas
  add constraint reservas_recurso_sem_conflito
  exclude using gist (
    recurso_id with =,
    tstzrange(inicio,fim,'[)') with &&
  )
  where (status = 'ativa');

alter table public.recursos_reserva enable row level security;
alter table public.reservas enable row level security;

create policy "Reservas: recursos ativos visíveis"
on public.recursos_reserva for select to authenticated
using (ativo = true or public.has_role(auth.uid(),'admin'));

create policy "Reservas: admin gerencia recursos"
on public.recursos_reserva for all to authenticated
using (public.has_role(auth.uid(),'admin'))
with check (public.has_role(auth.uid(),'admin'));

create policy "Reservas: usuários ativos veem reservas"
on public.reservas for select to authenticated
using (public.is_active_authorized_user(auth.uid()));

create policy "Reservas: autor cancela a própria"
on public.reservas for update to authenticated
using (created_by = auth.uid() and status = 'ativa')
with check (created_by = auth.uid() and status = 'cancelada');

create policy "Reservas: admin cancela qualquer"
on public.reservas for update to authenticated
using (public.has_role(auth.uid(),'admin'))
with check (public.has_role(auth.uid(),'admin'));

create or replace function public.set_reserva_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end;
$$;
create trigger reservas_updated_at before update on public.reservas
for each row execute function public.set_reserva_updated_at();

create or replace function public.criar_reservas(
  _recurso_id uuid,
  _inicio timestamptz,
  _fim timestamptz,
  _finalidade text,
  _ocorrencias integer default 1
)
returns setof public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  i integer;
  novo public.reservas;
  recurso public.recursos_reserva;
  candidato timestamptz;
  duracao interval;
  conflito public.reservas;
begin
  if not public.is_active_authorized_user(auth.uid()) then
    raise exception 'Usuário sem acesso ativo.';
  end if;
  select * into recurso from public.recursos_reserva where id=_recurso_id;
  if recurso.id is null then raise exception 'Recurso não encontrado.'; end if;
  if not recurso.ativo then raise exception 'Este recurso está inativo e não pode ser reservado.'; end if;
  if _fim <= _inicio then raise exception 'O horário final deve ser depois do horário inicial.'; end if;
  if _ocorrencias < 1 or _ocorrencias > 4 then raise exception 'As reservas recorrentes podem ter de 1 a 4 ocorrências.'; end if;
  if char_length(trim(_finalidade)) < 3 then raise exception 'Informe a finalidade da reserva.'; end if;
  if extract(minute from (_inicio at time zone 'America/Sao_Paulo')) not in (0,30)
     or extract(minute from (_fim at time zone 'America/Sao_Paulo')) not in (0,30)
     or mod(extract(epoch from (_fim-_inicio))::bigint,1800) <> 0 then
    raise exception 'Os horários devem usar intervalos de 30 minutos.';
  end if;

  duracao := _fim - _inicio;

  for i in 0..(_ocorrencias-1) loop
    candidato := _inicio + make_interval(days => i*7);
    begin
      insert into public.reservas(recurso_id,created_by,inicio,fim,finalidade)
      values (_recurso_id,auth.uid(),candidato,candidato+duracao,trim(_finalidade))
      returning * into novo;
    exception when exclusion_violation then
      loop
        select r.* into conflito
        from public.reservas r
        where r.recurso_id=_recurso_id
          and r.status='ativa'
          and tstzrange(r.inicio,r.fim,'[)') && tstzrange(candidato,candidato+duracao,'[)')
        order by r.inicio
        limit 1;
        exit when conflito.id is null;
        candidato := greatest(candidato, conflito.fim);
        conflito := null;
      end loop;
      raise exception 'Horário indisponível. O recurso estará livre novamente a partir de % (duração solicitada: % minutos).',
        to_char(candidato at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),
        round(extract(epoch from duracao)/60);
    end;
    return next novo;
  end loop;
end;
$$;

grant execute on function public.criar_reservas(uuid,timestamptz,timestamptz,text,integer) to authenticated;

create or replace function public.cancelar_reserva(_reserva_id uuid)
returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare r public.reservas;
begin
  if not public.is_active_authorized_user(auth.uid()) then raise exception 'Usuário sem acesso ativo.'; end if;
  select * into r from public.reservas where id=_reserva_id for update;
  if r.id is null then raise exception 'Reserva não encontrada.'; end if;
  if r.status <> 'ativa' then raise exception 'Esta reserva já está cancelada.'; end if;
  if r.created_by <> auth.uid() and not public.has_role(auth.uid(),'admin') then
    raise exception 'Você só pode cancelar suas próprias reservas.';
  end if;
  update public.reservas
  set status='cancelada', canceled_at=now(), canceled_by=auth.uid(), updated_at=now()
  where id=_reserva_id
  returning * into r;
  return r;
end;
$$;
grant execute on function public.cancelar_reserva(uuid) to authenticated;

revoke insert, delete on public.reservas from authenticated;
