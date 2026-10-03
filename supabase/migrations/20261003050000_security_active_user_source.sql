-- RS CONECT: usa a tabela canônica de pessoas autorizadas na verificação de usuário ativo.
create or replace function public.is_active_authorized_user(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    join public.pessoas_autorizadas pa on lower(pa.email) = lower(u.email)
    where u.id = _user_id and pa.ativo = true
  )
$$;

revoke execute on function public.is_active_authorized_user(uuid) from public, anon;
grant execute on function public.is_active_authorized_user(uuid) to authenticated;
