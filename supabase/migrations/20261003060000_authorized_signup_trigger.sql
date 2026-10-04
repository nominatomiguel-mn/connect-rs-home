-- Garante que o cadastro use a lista atual de pessoas_autorizadas.
-- A conta só é criada quando o e-mail existe e está ativo; papel e setores vêm do banco.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  authorized_row public.pessoas_autorizadas;
begin
  select *
    into authorized_row
  from public.pessoas_autorizadas
  where lower(trim(email)) = lower(trim(new.email))
    and ativo = true
  limit 1;

  if authorized_row.id is null then
    raise exception 'E-mail não autorizado. Peça ao administrador para liberar o acesso.';
  end if;

  insert into public.profiles (id, full_name, email)
  values (new.id, authorized_row.nome, lower(new.email))
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;

  insert into public.user_roles (user_id, role)
  values (new.id, authorized_row.papel)
  on conflict (user_id, role) do nothing;

  insert into public.user_sectors (user_id, sector_id)
  select new.id, assigned_sector.sector_id
  from unnest(coalesce(authorized_row.setores, '{}'::uuid[])) as assigned_sector(sector_id)
  on conflict (user_id, sector_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Recria explicitamente o gatilho para não depender de uma instalação antiga/incompleta.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
