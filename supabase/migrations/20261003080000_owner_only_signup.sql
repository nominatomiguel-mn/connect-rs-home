-- RS CONECT: acesso exclusivo ao dono do projeto.
-- Apenas nominatomiguel@gmail.com pode criar conta; novas contas recebem admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(trim(coalesce(new.email, ''))) <> 'nominatomiguel@gmail.com' then
    raise exception 'Acesso restrito ao dono do projeto.';
  end if;

  insert into public.profiles (id, full_name, email)
  values (new.id, 'Miguel Nominato', lower(new.email))
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;

  insert into public.user_roles (user_id, role)
  values (new.id, 'admin')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
