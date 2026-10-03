create type public.request_type as enum ('material','copias','compra','saida_antecipada','verba_evento');
create type public.request_status as enum ('pendente','aprovada','negada','cancelada');

create table public.solicitacoes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  tipo public.request_type not null,
  status public.request_status not null default 'pendente',
  titulo text not null,
  detalhes jsonb not null default '{}'::jsonb,
  attachment_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint solicitacoes_titulo_len check (char_length(trim(titulo)) between 3 and 160),
  constraint solicitacoes_attachments_max check (cardinality(attachment_paths) <= 3)
);

create table public.solicitacao_decisoes (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes(id) on delete restrict,
  decidido_por uuid not null references auth.users(id),
  decisao public.request_status not null check (decisao in ('aprovada','negada')),
  comentario text,
  created_at timestamptz not null default now(),
  constraint decisao_comentario_negada check (decisao <> 'negada' or nullif(trim(comentario),'') is not null)
);

grant select, insert, update on public.solicitacoes to authenticated;
grant all on public.solicitacoes to service_role;
grant select, insert on public.solicitacao_decisoes to authenticated;
grant all on public.solicitacao_decisoes to service_role;

create index solicitacoes_created_by_idx on public.solicitacoes(created_by);
create index solicitacoes_status_tipo_created_idx on public.solicitacoes(status,tipo,created_at desc);
create index solicitacao_decisoes_solicitacao_idx on public.solicitacao_decisoes(solicitacao_id,created_at desc);

alter table public.solicitacoes enable row level security;
alter table public.solicitacao_decisoes enable row level security;

create policy "Solicitações: autor cria" on public.solicitacoes
for insert to authenticated with check (created_by = auth.uid() and status = 'pendente');

create policy "Solicitações: autor vê as próprias" on public.solicitacoes
for select to authenticated using (created_by = auth.uid());

create policy "Solicitações: direção/admin vê tudo" on public.solicitacoes
for select to authenticated using (public.has_role(auth.uid(),'direcao') or public.has_role(auth.uid(),'admin'));

create policy "Solicitações: autor cancela pendente" on public.solicitacoes
for update to authenticated
using (created_by = auth.uid() and status = 'pendente')
with check (
  created_by = auth.uid()
  and status = 'cancelada'
  and tipo = tipo
  and titulo = titulo
  and detalhes = detalhes
  and attachment_paths = attachment_paths
);

create policy "Solicitações: direção/admin atualiza" on public.solicitacoes
for update to authenticated
using (public.has_role(auth.uid(),'direcao') or public.has_role(auth.uid(),'admin'))
with check (public.has_role(auth.uid(),'direcao') or public.has_role(auth.uid(),'admin'));

create policy "Decisões: autor vê decisão da própria solicitação" on public.solicitacao_decisoes
for select to authenticated
using (exists (select 1 from public.solicitacoes s where s.id = solicitacao_id and s.created_by = auth.uid()));

create policy "Decisões: direção/admin vê todas" on public.solicitacao_decisoes
for select to authenticated
using (public.has_role(auth.uid(),'direcao') or public.has_role(auth.uid(),'admin'));

create policy "Decisões: somente direção/admin insere" on public.solicitacao_decisoes
for insert to authenticated
with check (public.has_role(auth.uid(),'direcao') or public.has_role(auth.uid(),'admin'));

create or replace function public.decidir_solicitacao(
  _solicitacao_id uuid,
  _decisao public.request_status,
  _comentario text default null
)
returns public.solicitacao_decisoes
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.solicitacoes;
  d public.solicitacao_decisoes;
begin
  if not (public.has_role(auth.uid(),'direcao') or public.has_role(auth.uid(),'admin')) then
    raise exception 'Somente direção ou admin pode decidir solicitações.';
  end if;
  if _decisao not in ('aprovada','negada') then raise exception 'Decisão inválida.'; end if;
  if _decisao = 'negada' and nullif(trim(coalesce(_comentario,'')),'') is null then
    raise exception 'Negar uma solicitação exige justificativa.';
  end if;

  select * into s from public.solicitacoes where id = _solicitacao_id for update;
  if s.id is null then raise exception 'Solicitação não encontrada.'; end if;
  if s.status <> 'pendente' then raise exception 'Esta solicitação já foi decidida ou cancelada.'; end if;

  insert into public.solicitacao_decisoes(solicitacao_id,decidido_por,decisao,comentario)
  values (_solicitacao_id,auth.uid(),_decisao,nullif(trim(_comentario),'')) returning * into d;

  update public.solicitacoes
  set status = _decisao, decided_at = now(), updated_at = now()
  where id = _solicitacao_id;

  return d;
end;
$$;

grant execute on function public.decidir_solicitacao(uuid,public.request_status,text) to authenticated;

create or replace function public.block_decision_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'O registro de decisão é imutável.';
end;
$$;
create trigger solicitacao_decisoes_immutable
before update or delete on public.solicitacao_decisoes
for each row execute function public.block_decision_mutation();

create or replace function public.guard_solicitacao_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status <> 'pendente' and new.status <> old.status then
    raise exception 'Solicitação já encerrada.';
  end if;
  if old.status = 'pendente' and new.status = 'cancelada' and old.created_by = auth.uid() then
    new.updated_at = now();
    return new;
  end if;
  if (public.has_role(auth.uid(),'direcao') or public.has_role(auth.uid(),'admin')) then
    if new.status not in ('pendente','aprovada','negada','cancelada') then raise exception 'Status inválido.'; end if;
    new.updated_at = now();
    return new;
  end if;
  raise exception 'Alteração não permitida.';
end;
$$;
create trigger solicitacoes_guard_update before update on public.solicitacoes
for each row execute function public.guard_solicitacao_update();

create or replace function public.set_solicitacao_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
create trigger solicitacoes_updated_at before update on public.solicitacoes
for each row execute function public.set_solicitacao_updated_at();

create or replace function public.validate_solicitacao_details()
returns trigger language plpgsql as $$
begin
  if new.tipo = 'saida_antecipada' and not (new.detalhes ?& array['data','horario','motivo']) then raise exception 'Saída antecipada exige data, horário e motivo.'; end if;
  if new.tipo = 'compra' and not (new.detalhes ?& array['item','quantidade','valor_estimado','justificativa']) then raise exception 'Compra exige item, quantidade, valor estimado e justificativa.'; end if;
  if new.tipo = 'copias' and not (new.detalhes ?& array['quantidade','data_necessaria']) then raise exception 'Cópias exigem quantidade e data necessária.'; end if;
  return new;
end;
$$;
create trigger solicitacoes_validate_details before insert or update on public.solicitacoes
for each row execute function public.validate_solicitacao_details();

create policy "Solicitações storage: leitura autorizada"
on storage.objects for select to authenticated
using (
  bucket_id='solicitacoes' and (
    public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'direcao')
    or exists (
      select 1 from public.solicitacoes s
      where s.created_by=auth.uid()
      and name like s.id::text || '/%'
    )
  )
);
create policy "Solicitações storage: autor envia"
on storage.objects for insert to authenticated
with check (
  bucket_id='solicitacoes'
  and exists (
    select 1 from public.solicitacoes s
    where s.created_by=auth.uid() and s.status='pendente' and name like s.id::text || '/%'
  )
);
create policy "Solicitações storage: autor não apaga"
on storage.objects for delete to authenticated
using (false);