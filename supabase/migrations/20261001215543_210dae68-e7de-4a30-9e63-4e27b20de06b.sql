-- RS CONECT — base do módulo Chamados

-- Papéis e enumerações
create type public.app_role as enum ('admin', 'direcao', 'responsavel', 'colaborador');
create type public.ticket_status as enum ('aberto', 'em_andamento', 'resolvido');
create type public.ticket_priority as enum ('normal', 'urgente');

-- Pessoas autorizadas a criar conta (controlada pelo admin)
create table public.authorized_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role public.app_role not null default 'colaborador',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Perfil básico do usuário
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  created_at timestamptz not null default now()
);

-- Papéis em tabela separada (nunca no perfil editável)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

-- Setores de chamados
create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Responsáveis por setor (uma pessoa pode responder por vários setores)
create table public.sector_responsibles (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.sectors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unique (sector_id, user_id)
);

-- Chamados
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  sector_id uuid not null references public.sectors(id),
  title text not null,
  description text not null,
  location text,
  priority public.ticket_priority not null default 'normal',
  status public.ticket_status not null default 'aberto',
  photo_paths text[] not null default '{}',
  solution_comment text,
  solution_photo text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Comentários por chamado
create table public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  photo_path text,
  created_at timestamptz not null default now()
);

-- Histórico (quem, quando, o quê) — gerado pelo banco, nunca apagado
create table public.ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid references auth.users(id),
  event text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============ GRANTS (mesma migração) ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authorized_emails TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sectors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sector_responsibles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT, INSERT ON public.ticket_comments TO authenticated;
GRANT SELECT ON public.ticket_history TO authenticated;
GRANT ALL ON public.authorized_emails, public.profiles, public.user_roles, public.sectors, public.sector_responsibles, public.tickets, public.ticket_comments, public.ticket_history TO service_role;

-- ============ RLS ============
alter table public.authorized_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.sectors enable row level security;
alter table public.sector_responsibles enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.ticket_history enable row level security;

-- Funções auxiliares (security definer evita recursão de RLS)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.can_view_ticket(_user_id uuid, _ticket_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = _ticket_id and (
      public.has_role(_user_id, 'admin')
      or public.has_role(_user_id, 'direcao')
      or t.created_by = _user_id
      or exists (
        select 1 from public.sector_responsibles sr
        where sr.user_id = _user_id and sr.sector_id = t.sector_id
      )
    )
  )
$$;

-- Políticas: authorized_emails — só o admin gerencia
create policy "Admin gerencia lista de autorizados" on public.authorized_emails
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Políticas: profiles — cada um vê/edita o próprio; admin e direção veem todos
create policy "Ver o proprio perfil" on public.profiles
  for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'direcao'));
create policy "Editar o proprio perfil" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Admin edita perfis" on public.profiles
  for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Políticas: user_roles — cada um vê os próprios; admin gerencia
create policy "Ver proprios papeis" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'direcao'));
create policy "Admin gerencia papeis" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Políticas: sectors — todos autenticados veem (para abrir chamado); admin gerencia
create policy "Ver setores" on public.sectors
  for select to authenticated using (true);
create policy "Admin gerencia setores" on public.sectors
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Políticas: sector_responsibles — responsável vê as próprias atribuições; admin e direção veem todas
create policy "Ver atribuicoes" on public.sector_responsibles
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'direcao'));
create policy "Admin gerencia atribuicoes" on public.sector_responsibles
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Políticas: tickets — colaborador vê só os próprios; responsável só os dos seus setores; admin e direção veem tudo
create policy "Ver chamados" on public.tickets
  for select to authenticated using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'direcao')
    or created_by = auth.uid()
    or exists (
      select 1 from public.sector_responsibles sr
      where sr.user_id = auth.uid() and sr.sector_id = tickets.sector_id
    )
  );
create policy "Abrir chamado" on public.tickets
  for insert to authenticated with check (created_by = auth.uid());
-- Só o responsável do setor (ou admin) altera o chamado — validado no banco
create policy "Responsavel ou admin atualiza chamado" on public.tickets
  for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.sector_responsibles sr
      where sr.user_id = auth.uid() and sr.sector_id = tickets.sector_id
    )
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.sector_responsibles sr
      where sr.user_id = auth.uid() and sr.sector_id = tickets.sector_id
    )
  );

-- Políticas: comentários e histórico — mesma visibilidade do chamado
create policy "Ver comentarios" on public.ticket_comments
  for select to authenticated using (public.can_view_ticket(auth.uid(), ticket_id));
create policy "Comentar" on public.ticket_comments
  for insert to authenticated with check (author_id = auth.uid() and public.can_view_ticket(auth.uid(), ticket_id));
create policy "Ver historico" on public.ticket_history
  for select to authenticated using (public.can_view_ticket(auth.uid(), ticket_id));

-- ============ Gatilhos ============

-- updated_at automático nos chamados
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger tickets_updated_at before update on public.tickets
  for each row execute function public.set_updated_at();

-- Histórico automático: criação e mudança de status
create or replace function public.record_ticket_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.ticket_history (ticket_id, actor_id, event, details)
  values (new.id, new.created_by, 'chamado_criado',
    jsonb_build_object('titulo', new.title, 'setor_id', new.sector_id, 'prioridade', new.priority));
  return new;
end $$;
create trigger tickets_on_create after insert on public.tickets
  for each row execute function public.record_ticket_created();

create or replace function public.record_ticket_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.ticket_history (ticket_id, actor_id, event, details)
    values (new.id, auth.uid(), 'status_alterado',
      jsonb_build_object('de', old.status, 'para', new.status));
  end if;
  if new.status = 'resolvido' and old.status <> 'resolvido' then
    new.resolved_at = now();
  end if;
  return new;
end $$;
create trigger tickets_on_status before update of status on public.tickets
  for each row execute function public.record_ticket_status();

-- Cadastro controlado: só quem está na lista de autorizados cria conta;
-- ao criar, perfil e papel são copiados da lista.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  auth_row public.authorized_emails;
begin
  select * into auth_row from public.authorized_emails
    where lower(email) = lower(new.email) and active limit 1;
  if auth_row.id is null then
    raise exception 'E-mail não autorizado. Peça à direção para incluir você na lista de acesso.';
  end if;
  insert into public.profiles (id, full_name, email)
  values (new.id, auth_row.full_name, lower(new.email))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, auth_row.role)
  on conflict (user_id, role) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Dados iniciais: os 12 setores ============
insert into public.sectors (name) values
  ('Limpeza'),
  ('Manutenção'),
  ('Papelaria'),
  ('Materiais diversos para aulas'),
  ('Xerox'),
  ('Sala Interativa'),
  ('Sala de leitura'),
  ('Teatro'),
  ('Parque'),
  ('Quadra'),
  ('Laboratório de ciências'),
  ('Cozinha da nutrição');

-- Políticas de storage privado (fotos dos chamados)
create policy "Upload de fotos de chamados"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chamados' and public.can_view_ticket(auth.uid(), (split_part(name, '/', 2))::uuid));
create policy "Ver fotos de chamados"
  on storage.objects for select to authenticated
  using (bucket_id = 'chamados' and public.can_view_ticket(auth.uid(), (split_part(name, '/', 2))::uuid));
create policy "Excluir fotos do proprio chamado"
  on storage.objects for delete to authenticated
  using (bucket_id = 'chamados' and public.can_view_ticket(auth.uid(), (split_part(name, '/', 2))::uuid));
