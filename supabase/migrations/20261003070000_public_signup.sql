-- RS CONECT: cadastro aberto.
-- Qualquer e-mail pode criar conta; contas novas entram somente como colaborador.
-- A atribuição de admin/direção/responsável continua sendo administrativa.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    lower(new.email)
  )
  on conflict (id) do update
    set email = excluded.email;

  insert into public.user_roles (user_id, role)
  values (new.id, 'colaborador')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
