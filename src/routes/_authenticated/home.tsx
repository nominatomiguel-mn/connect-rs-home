import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, FileCheck2, ShieldCheck, Users, Wrench, type LucideIcon } from "lucide-react";
import { getSession } from "@/lib/session.functions";

type Ticket = { id: string; title: string; status: "aberto" | "em_andamento" | "resolvido"; priority: "normal" | "urgente"; created_at: string; created_by: string; sector_id: string; sector?: { name: string } | null };
type Request = { id: string; created_by: string; titulo: string; status: "pendente" | "aprovada" | "negada" | "cancelada"; created_at: string; tipo: string };
type Reservation = { id: string; recurso_id: string; created_by: string; inicio: string; fim: string; finalidade: string; status: "ativa" | "cancelada"; reservante_nome: string; recurso?: { nome: string } | null };

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Início — RS CONECT" }, { name: "description", content: "Central interna do RS CONECT." }] }),
  component: HomePage,
});

const roleLabels: Record<string, string> = { admin: "Administrador", direcao: "Direção", responsavel: "Responsável de setor", colaborador: "Colaborador" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function HomePage() {
  const getSessionFn = useServerFn(getSession);
  const { data: session, isLoading: sessionLoading, isError: sessionError } = useQuery({ queryKey: ["session"], queryFn: () => getSessionFn() });
  const isAdmin = !!session?.roles.includes("admin");
  const isDirection = !!session?.roles.includes("direcao");
  const isResponsible = (session?.responsibleSectors.length ?? 0) > 0;

  const ticketsQuery = useQuery({
    queryKey: ["home", "tickets"],
    queryFn: async () => {
      const { data, error } = await import("@/integrations/supabase/client").then(({ supabase }) =>
        supabase.from("tickets").select("id,title,status,priority,created_at,created_by,sector_id,sector:sectors(name)").order("created_at", { ascending: false }).limit(100)
      );
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
    enabled: !!session,
  });

  const requestsQuery = useQuery({
    queryKey: ["home", "requests"],
    queryFn: async () => {
      const { data, error } = await import("@/integrations/supabase/client").then(({ supabase }) =>
        supabase.from("solicitacoes").select("id,created_by,titulo,status,created_at,tipo").order("created_at", { ascending: false }).limit(100)
      );
      if (error) throw error;
      return (data ?? []) as Request[];
    },
    enabled: !!session,
  });

  const reservationsQuery = useQuery({
    queryKey: ["home", "reservations"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.rpc("listar_reservas", {
        _inicio: localDate() + "T00:00:00-03:00",
        _fim: localDate(31) + "T23:59:59-03:00",
      });
      if (error) throw error;
      return (data ?? []) as Reservation[];
    },
    enabled: !!session,
  });

  if (sessionLoading) return <HomeSkeleton />;
  if (sessionError || !session) return <ErrorState message="Não foi possível carregar seu acesso. Tente novamente." />;

  const tickets = ticketsQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const reservations = reservationsQuery.data ?? [];
  const dataError = ticketsQuery.isError || requestsQuery.isError || reservationsQuery.isError;

  const openTickets = tickets.filter((t) => t.status !== "resolvido");
  const pendingRequests = requests.filter((r) => r.status === "pendente");
  const upcomingMine = reservations
    .filter((r) => r.status === "ativa" && r.created_by === session.userId && new Date(r.inicio) >= new Date())
    .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio))
    .slice(0, 5);
  const responsibleQueue = openTickets
    .filter((t) => session.responsibleSectors.some((s) => s.id === t.sector_id))
    .sort((a, b) => (a.priority === "urgente" ? -1 : 1) - (b.priority === "urgente" ? -1 : 1))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-primary p-5 text-primary-foreground sm:p-8">
        <p className="text-sm font-semibold opacity-80">Central interna · Colégio Raios de Sol</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Olá, {session.fullName.split(" ")[0] || "bem-vindo"}!</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed opacity-85">Aqui estão os assuntos mais relevantes para o seu perfil.</p>
        <div className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-background/15 px-3 py-1.5 text-xs font-semibold"><ShieldCheck className="size-4" /> {roleLabels[isAdmin ? "admin" : (session.roles[0] ?? "colaborador")] ?? "Usuário autorizado"}</div>
      </section>

      {dataError ? <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><span>Alguns dados da Home não puderam ser carregados.</span><button className="min-h-10 rounded-lg border px-3 font-semibold" onClick={() => { void ticketsQuery.refetch(); void requestsQuery.refetch(); void reservationsQuery.refetch(); }}>Tentar novamente</button></div> : null}

      {isAdmin ? (
        <AdminHome tickets={tickets} requests={requests} reservations={reservations} />
      ) : isDirection ? (
        <DirectionHome requests={pendingRequests} loading={requestsQuery.isLoading} />
      ) : isResponsible ? (
        <ResponsibleHome tickets={responsibleQueue} loading={ticketsQuery.isLoading} />
      ) : (
        <CollaboratorHome tickets={openTickets.filter((t) => t.created_by === session.userId)} requests={requests.filter((r) => r.created_by === session.userId)} reservations={upcomingMine} loading={ticketsQuery.isLoading || requestsQuery.isLoading || reservationsQuery.isLoading} />
      )}
    </div>
  );
}

function AdminHome({ tickets, requests, reservations }: { tickets: Ticket[]; requests: Request[]; reservations: Reservation[] }) {
  const cards = [
    { label: "Chamados abertos", value: tickets.filter((t) => t.status !== "resolvido").length, icon: ClipboardList, to: "/chamados" as const },
    { label: "Solicitações pendentes", value: requests.filter((r) => r.status === "pendente").length, icon: FileCheck2, to: "/solicitacoes" as const },
    { label: "Reservas ativas", value: reservations.filter((r) => r.status === "ativa").length, icon: CalendarDays, to: "/reservas" as const },
  ];
  const semResp = useQuery({ queryKey: ["home", "setores-sem-responsavel"], queryFn: async () => { const { supabase } = await import("@/integrations/supabase/client"); const { data, error } = await supabase.rpc("setores_sem_responsavel"); if (error) throw error; return data ?? []; } });
  const missing = semResp.data ?? [];
  return <section className="space-y-4">{missing.length ? <Link to="/admin/setores" role="alert" className="block rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p className="font-bold text-destructive">Setor sem responsável ({missing.length})</p><p className="mt-1 text-muted-foreground">Chamados destes setores ficam visíveis só para a administração: {missing.map((m) => m.name).join(", ")}.</p></Link> : null}<SectionTitle title="Visão geral" description="Resumo operacional dos módulos."/><div className="grid gap-3 sm:grid-cols-3">{cards.map((card) => <Link key={card.label} to={card.to} className="min-h-32 rounded-2xl border bg-card p-5 transition-colors hover:bg-accent/40"><card.icon className="size-5 text-primary"/><p className="mt-4 text-3xl font-black">{card.value}</p><p className="mt-1 text-sm text-muted-foreground">{card.label}</p></Link>)}</div><div className="grid gap-3 sm:grid-cols-2"><QuickLink to="/admin/pessoas" icon={Users} title="Pessoas autorizadas" description="Gerencie acessos e papéis."/><QuickLink to="/admin/setores" icon={Wrench} title="Setores" description="Gerencie setores e responsáveis."/></div></section>;
}

function DirectionHome({ requests, loading }: { requests: Request[]; loading: boolean }) {
  return <section className="space-y-4"><SectionTitle title="Aprovações" description="Solicitações que aguardam decisão da direção."/><Link to="/solicitacoes" className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border bg-card p-5 hover:bg-accent/40"><div><p className="text-3xl font-black">{loading ? "…" : requests.length}</p><p className="text-sm text-muted-foreground">pendente(s) de aprovação</p></div><ArrowRight className="size-5 text-primary"/></Link>{!loading && requests.length === 0 ? <EmptyState icon={CheckCircle2} title="Nenhuma aprovação pendente" description="Não há solicitações aguardando sua decisão."/> : <div className="space-y-2">{requests.slice(0,5).map((r)=><Link key={r.id} to="/solicitacoes" className="block rounded-xl border bg-card p-4 hover:bg-accent/40"><p className="font-bold">{r.titulo}</p><p className="mt-1 text-xs text-muted-foreground">{r.tipo} · {formatDate(r.created_at)}</p></Link>)}</div>}</section>;
}

function ResponsibleHome({ tickets, loading }: { tickets: Ticket[]; loading: boolean }) {
  return <section className="space-y-4"><SectionTitle title="Fila dos seus setores" description="Chamados em aberto ou em andamento, com urgentes primeiro."/><Link to="/chamados" className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border bg-card p-5 hover:bg-accent/40"><div><p className="text-3xl font-black">{loading ? "…" : tickets.length}</p><p className="text-sm text-muted-foreground">chamado(s) na fila</p></div><ArrowRight className="size-5 text-primary"/></Link>{!loading && tickets.length === 0 ? <EmptyState icon={CheckCircle2} title="Fila vazia" description="Não há chamados pendentes nos seus setores."/> : <div className="space-y-2">{tickets.map((t)=><Link key={t.id} to="/chamados" className="block rounded-xl border bg-card p-4 hover:bg-accent/40"><div className="flex items-center justify-between gap-3"><p className="truncate font-bold">{t.title}</p>{t.priority === "urgente" ? <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">Urgente</span> : null}</div><p className="mt-1 text-xs text-muted-foreground">{t.sector?.name ?? "Setor"} · {t.status === "aberto" ? "Aberto" : "Em andamento"}</p></Link>)}</div>}</section>;
}

function CollaboratorHome({ tickets, requests, reservations, loading }: { tickets: Ticket[]; requests: Request[]; reservations: Reservation[]; loading: boolean }) {
  return <section className="grid gap-4 md:grid-cols-3"><HomeList to="/chamados" icon={ClipboardList} title="Meus chamados abertos" loading={loading} emptyTitle="Nenhum chamado aberto" emptyDescription="Tudo certo por aqui." items={tickets.slice(0,4).map((t) => ({ title: t.title, meta: t.status === "aberto" ? "Aberto" : "Em andamento" }))}/><HomeList to="/solicitacoes" icon={FileCheck2} title="Minhas solicitações" loading={loading} emptyTitle="Nenhuma solicitação" emptyDescription="Suas solicitações aparecerão aqui." items={requests.slice(0,4).map((r) => ({ title: r.titulo, meta: r.status }))}/><HomeList to="/reservas" icon={CalendarDays} title="Próximas reservas" loading={loading} emptyTitle="Nenhuma reserva próxima" emptyDescription="Você não possui reservas futuras." items={reservations.slice(0,4).map((r) => ({ title: r.finalidade, meta: formatDate(r.inicio) }))}/></section>;
}

function HomeList({ to, icon: Icon, title, items, loading, emptyTitle, emptyDescription }: { to: "/chamados" | "/solicitacoes" | "/reservas"; icon: LucideIcon; title: string; items: { title: string; meta: string }[]; loading: boolean; emptyTitle: string; emptyDescription: string }) {
  return <Link to={to} className="block min-h-44 rounded-2xl border bg-card p-5 hover:bg-accent/40"><div className="flex items-center gap-2"><Icon className="size-5 text-primary"/><h2 className="font-bold">{title}</h2></div>{loading ? <p className="mt-6 text-sm text-muted-foreground">Carregando…</p> : items.length ? <div className="mt-4 space-y-3">{items.map((item) => <div key={item.title+item.meta} className="border-b pb-2 last:border-0"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.meta}</p></div>)}</div> : <div className="mt-5"><p className="font-semibold">{emptyTitle}</p><p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p></div>}</Link>;
}

function SectionTitle({ title, description }: { title: string; description: string }) { return <div><h2 className="text-lg font-bold">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div>; }
function QuickLink({ to, icon: Icon, title, description }: { to: "/admin/pessoas" | "/admin/setores"; icon: LucideIcon; title: string; description: string }) { return <Link to={to} className="min-h-20 rounded-2xl border bg-card p-5 hover:bg-accent/40"><div className="flex items-center gap-3"><Icon className="size-5 text-primary"/><div><p className="font-bold">{title}</p><p className="text-sm text-muted-foreground">{description}</p></div></div></Link>; }
function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) { return <div className="rounded-2xl border border-dashed p-8 text-center"><Icon className="mx-auto size-8 text-muted-foreground"/><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>; }
function ErrorState({ message }: { message: string }) { return <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center"><p className="font-semibold">{message}</p><p className="mt-1 text-sm text-muted-foreground">Atualize a página ou tente novamente.</p></div>; }
function HomeSkeleton() { return <div className="space-y-5" aria-busy="true" aria-label="Carregando Home"><div className="h-40 animate-pulse rounded-2xl bg-muted"/><div className="grid gap-3 sm:grid-cols-3">{Array.from({length:3},(_,i)=><div key={i} className="h-32 animate-pulse rounded-2xl bg-muted"/>)}</div></div>; }
