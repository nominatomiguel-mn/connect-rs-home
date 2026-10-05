-- RS CONECT: sincronização do acesso exclusivo do proprietário.
-- Mantém o usuário do projeto como admin e replica os setores atribuídos.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  owner_id uuid;
begin
  if lower(trim(coalesce(new.email, ''))) <> 'nominatomiguel@gmail.com' then
    raise exception 'Acesso restrito ao dono do projeto.';
  end if;

  insert into public.profiles (id, full_name, email)
  values (new.id, 'Miguel Nominato', 'nominatomiguel@gmail.com')
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;

  insert into public.user_roles (user_id, role)
  values (new.id, 'admin')
  on conflict (user_id, role) do nothing;

  insert into public.user_sectors (user_id, sector_id)
  select new.id, s.id
  from public.sectors s
  where s.active = true
  on conflict (user_id, sector_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Garante que o proprietário já existente permaneça sincronizado.
select public.has_role(u.id, 'admin')
from auth.users u
where lower(u.email) = 'nominatomiguel@gmail.com'
limit 1;
