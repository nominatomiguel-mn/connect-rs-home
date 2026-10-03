create or replace function public.is_active_authorized_user(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.authorized_emails a on lower(a.email) = lower(p.email)
    where p.id = _user_id and a.active = true
  )
$$;
revoke execute on function public.is_active_authorized_user(uuid) from anon;