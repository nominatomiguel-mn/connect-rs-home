ALTER TABLE public.authorized_emails ADD COLUMN IF NOT EXISTS setores uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.authorized_emails ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS authorized_emails_email_key ON public.authorized_emails(email);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  auth_row public.authorized_emails%rowtype;
begin
  select * into auth_row from public.authorized_emails
  where lower(email) = lower(new.email) and active = true limit 1;

  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(auth_row.full_name, split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, coalesce(auth_row.role, 'colaborador'::app_role))
  on conflict do nothing;

  if auth_row.id is not null and coalesce(array_length(auth_row.setores,1),0) > 0 then
    insert into public.sector_responsibles (sector_id, user_id)
    select s.id, new.id from public.sectors s where s.id = any(auth_row.setores)
    on conflict do nothing;
  end if;
  return new;
end;
$function$;