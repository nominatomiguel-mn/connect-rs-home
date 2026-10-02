-- Política: o dono pode atualizar o próprio chamado (o gatilho abaixo limita o que ele pode mudar)
create policy "Dono atualiza o proprio chamado (só fotos)" on public.tickets
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Gatilho: valida campo a campo quem pode alterar o quê
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

  select exists (
    select 1 from public.user_roles
    where user_id = caller and role = 'admin'
  ) into is_admin;
  if is_admin then
    return new;
  end if;

  if new.created_by is distinct from old.created_by
     or new.sector_id is distinct from old.sector_id
     or new.priority is distinct from old.priority
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.location is distinct from old.location then
    raise exception 'Apenas o admin pode alterar os dados do chamado.';
  end if;

  select exists (
    select 1 from public.sector_responsibles
    where user_id = caller and sector_id = old.sector_id
  ) into is_resp;
  if not is_resp then
    if new.status is distinct from old.status
       or new.solution_comment is distinct from old.solution_comment
       or new.solution_photo is distinct from old.solution_photo
       or new.resolved_at is distinct from old.resolved_at then
      raise exception 'Somente o responsável do setor pode alterar o status.';
    end if;
  end if;

  return new;
end $$;

create trigger tickets_guard_update before update on public.tickets
  for each row execute function public.guard_ticket_update();

revoke execute on function public.guard_ticket_update() from public, anon, authenticated;
