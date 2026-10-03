-- RS CONECT: segurança e regras finais do módulo Chamados
-- Reforça RLS, transições de status, histórico e storage privado.

insert into storage.buckets (id, name, public)
values ('chamados', 'chamados', false)
on conflict (id) do update set public = false;

drop policy if exists "Ver chamados" on public.tickets;
drop policy if exists "Abrir chamado" on public.tickets;
drop policy if exists "Responsavel ou admin atualiza chamado" on public.tickets;
drop policy if exists "Dono atualiza o proprio chamado (só fotos)" on public.tickets;
drop policy if exists "Ver comentarios" on public.ticket_comments;
drop policy if exists "Comentar" on public.ticket_comments;
drop policy if exists "Ver historico" on public.ticket_history;
drop policy if exists "Upload de fotos de chamados" on storage.objects;
drop policy if exists "Ver fotos de chamados" on storage.objects;
drop policy if exists "Excluir fotos do proprio chamado" on storage.objects;

create policy "Chamados: visibilidade por perfil"
on public.tickets for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or created_by = auth.uid()
  or exists (
    select 1
    from public.sector_responsibles sr
    where sr.user_id = auth.uid()
      and sr.sector_id = tickets.sector_id
  )
);

create policy "Chamados: colaborador cria o proprio"
on public.tickets for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.sectors s
    where s.id = tickets.sector_id and s.active = true
  )
  and cardinality(coalesce(photo_paths, '{}')) between 0 and 3
);

create policy "Chamados: responsavel ou admin atualiza"
on public.tickets for update to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or exists (
    select 1
    from public.sector_responsibles sr
    where sr.user_id = auth.uid()
      and sr.sector_id = tickets.sector_id
  )
)
with check (
  public.has_role(auth.uid(), 'admin')
  or exists (
    select 1
    from public.sector_responsibles sr
    where sr.user_id = auth.uid()
      and sr.sector_id = tickets.sector_id
  )
);

create policy "Comentarios: quem pode ver o chamado"
on public.ticket_comments for select to authenticated
using (public.can_view_ticket(auth.uid(), ticket_id));

create policy "Comentarios: participante pode comentar"
on public.ticket_comments for insert to authenticated
with check (
  author_id = auth.uid()
  and public.can_view_ticket(auth.uid(), ticket_id)
);

create policy "Historico: quem pode ver o chamado"
on public.ticket_history for select to authenticated
using (public.can_view_ticket(auth.uid(), ticket_id));

create or replace function public.validate_ticket_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by <> auth.uid() then
    raise exception 'O chamado deve pertencer ao usuário autenticado.';
  end if;

  if not exists (
    select 1 from public.sectors
    where id = new.sector_id and active = true
  ) then
    raise exception 'O setor selecionado não está ativo.';
  end if;

  if cardinality(coalesce(new.photo_paths, '{}')) > 3 then
    raise exception 'Um chamado pode ter no máximo 3 fotos.';
  end if;

  if length(trim(new.title)) < 3 or length(trim(new.title)) > 120 then
    raise exception 'O título deve ter entre 3 e 120 caracteres.';
  end if;

  if length(trim(new.description)) < 3 then
    raise exception 'A descrição é obrigatória.';
  end if;

  if new.status <> 'aberto' then
    raise exception 'Um chamado novo deve começar como aberto.';
  end if;

  return new;
end;
$$;

drop trigger if exists tickets_validate_insert on public.tickets;
create trigger tickets_validate_insert
before insert on public.tickets
for each row execute function public.validate_ticket_insert();

create or replace function public.guard_ticket_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  is_admin boolean;
  is_resp boolean;
begin
  if caller is null then
    raise exception 'Não autenticado.';
  end if;

  select public.has_role(caller, 'admin') into is_admin;

  if is_admin then
    if new.created_by is distinct from old.created_by
       or new.sector_id is distinct from old.sector_id then
      raise exception 'Admin não pode mover um chamado para outro setor ou usuário.';
    end if;
    return new;
  end if;

  select exists (
    select 1
    from public.sector_responsibles
    where user_id = caller and sector_id = old.sector_id
  ) into is_resp;

  if not is_resp then
    raise exception 'Somente o responsável do setor ou admin pode alterar o chamado.';
  end if;

  if new.created_by is distinct from old.created_by
     or new.sector_id is distinct from old.sector_id
     or new.priority is distinct from old.priority
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.location is distinct from old.location
     or new.photo_paths is distinct from old.photo_paths then
    raise exception 'O responsável só pode alterar o status e os dados da solução.';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'aberto' and new.status = 'em_andamento')
      or (old.status = 'em_andamento' and new.status = 'resolvido')
    ) then
      raise exception 'O status deve seguir: aberto → em andamento → resolvido.';
    end if;
  end if;

  if new.status <> 'resolvido'
     and (
       new.solution_comment is distinct from old.solution_comment
       or new.solution_photo is distinct from old.solution_photo
       or new.resolved_at is distinct from old.resolved_at
     ) then
    raise exception 'Os dados da solução só podem ser adicionados ao resolver o chamado.';
  end if;

  if new.status = 'resolvido' and old.status <> 'resolvido' then
    new.resolved_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists tickets_guard_update on public.tickets;
create trigger tickets_guard_update
before update on public.tickets
for each row execute function public.guard_ticket_update();

create or replace function public.record_ticket_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.ticket_history (ticket_id, actor_id, event, details)
    values (
      new.id,
      auth.uid(),
      'status_alterado',
      jsonb_build_object('de', old.status, 'para', new.status)
    );
  elsif new.solution_comment is distinct from old.solution_comment
     or new.solution_photo is distinct from old.solution_photo
     or new.priority is distinct from old.priority
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.location is distinct from old.location
     or new.photo_paths is distinct from old.photo_paths then
    insert into public.ticket_history (ticket_id, actor_id, event, details)
    values (
      new.id,
      auth.uid(),
      'chamado_atualizado',
      jsonb_build_object(
        'solucao_comentario', new.solution_comment is distinct from old.solution_comment,
        'solucao_foto', new.solution_photo is distinct from old.solution_photo,
        'prioridade', new.priority is distinct from old.priority,
        'titulo', new.title is distinct from old.title,
        'descricao', new.description is distinct from old.description,
        'local', new.location is distinct from old.location,
        'fotos', new.photo_paths is distinct from old.photo_paths
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_on_status on public.tickets;
create trigger tickets_on_update_history
after update on public.tickets
for each row execute function public.record_ticket_update();

create or replace function public.record_ticket_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ticket_history (ticket_id, actor_id, event, details)
  values (
    new.ticket_id,
    new.author_id,
    'comentario_adicionado',
    jsonb_build_object('tem_foto', new.photo_path is not null)
  );
  return new;
end;
$$;

drop trigger if exists ticket_comments_on_create on public.ticket_comments;
create trigger ticket_comments_on_create
after insert on public.ticket_comments
for each row execute function public.record_ticket_comment();

create or replace function public.record_ticket_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ticket_history (ticket_id, actor_id, event, details)
  values (
    new.id,
    new.created_by,
    'chamado_criado',
    jsonb_build_object(
      'titulo', new.title,
      'setor_id', new.sector_id,
      'prioridade', new.priority
    )
  );
  return new;
end;
$$;

drop trigger if exists tickets_on_create on public.tickets;
create trigger tickets_on_create
after insert on public.tickets
for each row execute function public.record_ticket_created();

create or replace function public.validate_ticket_photo_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if cardinality(coalesce(new.photo_paths, '{}')) > 3 then
    raise exception 'Um chamado pode ter no máximo 3 fotos.';
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_validate_photo_count on public.tickets;
create trigger tickets_validate_photo_count
before update of photo_paths on public.tickets
for each row execute function public.validate_ticket_photo_count();

create or replace function public.can_view_ticket(_user_id uuid, _ticket_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = _ticket_id
      and (
        public.has_role(_user_id, 'admin')
        or t.created_by = _user_id
        or exists (
          select 1
          from public.sector_responsibles sr
          where sr.user_id = _user_id and sr.sector_id = t.sector_id
        )
      )
  )
$$;

create or replace function public.set_ticket_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tickets_updated_at on public.tickets;
create trigger tickets_updated_at
before update on public.tickets
for each row execute function public.set_ticket_updated_at();

-- Storage privado: o primeiro segmento do caminho é o ticket UUID.
create policy "Chamados: upload privado"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chamados'
  and public.can_view_ticket(auth.uid(), split_part(name, '/', 1)::uuid)
);

create policy "Chamados: leitura privada"
on storage.objects for select to authenticated
using (
  bucket_id = 'chamados'
  and public.can_view_ticket(auth.uid(), split_part(name, '/', 1)::uuid)
);

create policy "Chamados: exclusao privada"
on storage.objects for delete to authenticated
using (
  bucket_id = 'chamados'
  and public.can_view_ticket(auth.uid(), split_part(name, '/', 1)::uuid)
);

revoke execute on function public.guard_ticket_update() from public, anon, authenticated;
revoke execute on function public.validate_ticket_insert() from public, anon, authenticated;
revoke execute on function public.validate_ticket_photo_count() from public, anon, authenticated;
revoke execute on function public.record_ticket_update() from public, anon, authenticated;
revoke execute on function public.record_ticket_comment() from public, anon, authenticated;
