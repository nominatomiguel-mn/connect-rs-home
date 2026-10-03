-- Mantém a sequência de status também para administradores.
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
  if caller is null then raise exception 'Não autenticado.'; end if;

  select public.has_role(caller, 'admin') into is_admin;

  if new.status is distinct from old.status then
    if not ((old.status = 'aberto' and new.status = 'em_andamento') or (old.status = 'em_andamento' and new.status = 'resolvido')) then
      raise exception 'O status deve seguir: aberto → em andamento → resolvido.';
    end if;
  end if;

  if is_admin then
    if new.created_by is distinct from old.created_by or new.sector_id is distinct from old.sector_id then
      raise exception 'Admin não pode mover um chamado para outro setor ou usuário.';
    end if;
    if new.status = 'resolvido' and old.status <> 'resolvido' then new.resolved_at = now(); end if;
    return new;
  end if;

  if new.created_by = caller
     and new.sector_id = old.sector_id
     and new.priority = old.priority
     and new.title = old.title
     and new.description = old.description
     and new.location is not distinct from old.location
     and new.status = old.status
     and new.solution_comment is not distinct from old.solution_comment
     and new.solution_photo is not distinct from old.solution_photo
     and new.resolved_at is not distinct from old.resolved_at
     and new.photo_paths is distinct from old.photo_paths then
    if cardinality(coalesce(new.photo_paths, '{}')) > 3 then raise exception 'Um chamado pode ter no máximo 3 fotos.'; end if;
    return new;
  end if;

  select exists (select 1 from public.sector_responsibles where user_id = caller and sector_id = old.sector_id) into is_resp;
  if not is_resp then raise exception 'Somente o responsável do setor ou admin pode alterar o chamado.'; end if;

  if new.created_by is distinct from old.created_by
     or new.sector_id is distinct from old.sector_id
     or new.priority is distinct from old.priority
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.location is distinct from old.location
     or new.photo_paths is distinct from old.photo_paths then
    raise exception 'O responsável só pode alterar o status e os dados da solução.';
  end if;

  if new.status <> 'resolvido'
     and (new.solution_comment is distinct from old.solution_comment or new.solution_photo is distinct from old.solution_photo or new.resolved_at is distinct from old.resolved_at) then
    raise exception 'Os dados da solução só podem ser adicionados ao resolver o chamado.';
  end if;

  if new.status = 'resolvido' and old.status <> 'resolvido' then new.resolved_at = now(); end if;
  return new;
end;
$$;

revoke execute on function public.guard_ticket_update() from public, anon, authenticated;
