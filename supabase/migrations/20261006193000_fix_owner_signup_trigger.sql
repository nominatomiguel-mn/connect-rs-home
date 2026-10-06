-- RS CONECT: correção definitiva do cadastro do proprietário.
-- O trigger de auth precisa ser security definer e sincronizar perfil, papel e setores
-- sem depender de permissões do usuário que está fazendo o signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_email text := 'nominatomiguel@gmail.com';
begin
  if lower(trim(coalesce(new.email, ''))) <> owner_email then
    raise exception 'Acesso restrito ao dono do projeto.';
  end if;

  insert into public.profiles (id, full_name, email)
  values (new.id, 'Miguel Nominato', owner_email)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;

  insert into public.user_roles (user_id, role)
  values (new.id, 'admin'::public.app_role)
  on conflict (user_id, role) do nothing;

  if to_regclass('public.user_sectors') is not null
     and to_regclass('public.sectors') is not null then
    insert into public.user_sectors (user_id, sector_id)
    select new.id, s.id
    from public.sectors s
    on conflict (user_id, sector_id) do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
