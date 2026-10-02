-- RS CONECT: fundação de pessoas, papéis e setores
-- A tabela antiga authorized_emails é mantida para compatibilidade com código legado.
create table if not exists public.pessoas_autorizadas (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome text not null,
  papel public.app_role not null default 'colaborador',
  setores uuid[] not null default '{}',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pessoas_autorizadas_email_lower_uidx on public.pessoas_autorizadas (lower(email));
create table if not exists public.user_sectors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sector_id uuid not null references public.sectors(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, sector_id)
);
grant select, insert, update, delete on public.pessoas_autorizadas to authenticated;
grant select, insert, update, delete on public.user_sectors to authenticated;
grant all on public.pessoas_autorizadas, public.user_sectors to service_role;
alter table public.pessoas_autorizadas enable row level security;
alter table public.user_sectors enable row level security;
create policy "Admin gerencia pessoas autorizadas" on public.pessoas_autorizadas for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Ver setores atribuídos" on public.user_sectors for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'direcao'));
create policy "Admin gerencia setores atribuídos" on public.user_sectors for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

insert into public.pessoas_autorizadas (email, nome, papel, ativo)
select lower(email), full_name, role, active from public.authorized_emails
on conflict (lower(email)) do nothing;
insert into public.pessoas_autorizadas (email, nome, papel, setores, ativo)
values ('nominatomiguel@gmail.com', 'Miguel Nominato', 'admin', coalesce((select array_agg(id order by name) from public.sectors), '{}'), true)
on conflict (lower(email)) do update set nome = excluded.nome, papel = 'admin', setores = excluded.setores, ativo = true, updated_at = now();

create or replace function public.is_active_authorized_user(_user_id uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users u
    join public.pessoas_autorizadas pa on lower(pa.email) = lower(u.email)
    where u.id = _user_id and pa.ativo = true
  )
$$;
revoke execute on function public.is_active_authorized_user(uuid) from public, anon;
grant execute on function public.is_active_authorized_user(uuid) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['pessoas_autorizadas','user_sectors','profiles','user_roles','sectors','sector_responsibles','tickets','ticket_comments','ticket_history'] loop
    execute format('create policy "Acesso somente pessoa ativa" on public.%I as restrictive for all to authenticated using (public.is_active_authorized_user(auth.uid())) with check (public.is_active_authorized_user(auth.uid()))', table_name);
  end loop;
end $$;
create policy "Storage somente pessoa ativa" on storage.objects as restrictive for all to authenticated using (public.is_active_authorized_user(auth.uid())) with check (public.is_active_authorized_user(auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
declare authorized_row public.pessoas_autorizadas;
begin
  select * into authorized_row from public.pessoas_autorizadas where lower(email) = lower(new.email) and ativo = true limit 1;
  if authorized_row.id is null then raise exception 'E-mail não autorizado. Peça ao administrador para liberar o acesso.'; end if;
  insert into public.profiles (id, full_name, email) values (new.id, authorized_row.nome, lower(new.email))
  on conflict (id) do update set full_name = excluded.full_name, email = excluded.email;
  insert into public.user_roles (user_id, role) values (new.id, authorized_row.papel) on conflict (user_id, role) do nothing;
  insert into public.user_sectors (user_id, sector_id)
  select new.id, assigned_sector.sector_id from unnest(authorized_row.setores) as assigned_sector(sector_id)
  on conflict (user_id, sector_id) do nothing;
  return new;
end
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

insert into public.user_sectors (user_id, sector_id)
select p.id, assigned_sector.sector_id from public.profiles p
join auth.users u on u.id = p.id
join public.pessoas_autorizadas pa on lower(pa.email) = lower(u.email)
cross join lateral unnest(pa.setores) as assigned_sector(sector_id)
where pa.ativo = true
on conflict (user_id, sector_id) do nothing;

do $$
declare admin_user_id uuid;
begin
  select id into admin_user_id from auth.users where lower(email) = 'nominatomiguel@gmail.com' limit 1;
  if admin_user_id is not null then
    insert into public.profiles (id, full_name, email) values (admin_user_id, 'Miguel Nominato', 'nominatomiguel@gmail.com')
    on conflict (id) do update set full_name = excluded.full_name, email = excluded.email;
    insert into public.user_roles (user_id, role) values (admin_user_id, 'admin') on conflict (user_id, role) do nothing;
    insert into public.user_sectors (user_id, sector_id) select admin_user_id, id from public.sectors on conflict (user_id, sector_id) do nothing;
  end if;
end
$$;
