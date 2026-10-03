import { type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn, useRouterState } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, CalendarDays, ClipboardList, FileCheck2, LogOut, ShieldCheck, Sun, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/session.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function NavLinks({ isAdmin, orientation }: { isAdmin: boolean; orientation: "bottom" | "sidebar" }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = [
    { to: "/home", label: "Início", icon: Sun, exact: true },
    { to: "/chamados", label: "Chamados", icon: ClipboardList, exact: false },
    { to: "/solicitacoes", label: "Solicitações", icon: FileCheck2, exact: false },
    { to: "/reservas", label: "Reservas", icon: CalendarDays, exact: false },
    ...(isAdmin ? [
      { to: "/admin/pessoas", label: "Pessoas", icon: Users, exact: false },
      { to: "/admin/setores", label: "Setores", icon: Building2, exact: false },
    ] : []),
  ];
  return items.map((item) => {
    const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
    return <Link key={item.to} to={item.to} className={cn(
      orientation === "bottom" ? "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold" : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold",
      active ? orientation === "bottom" ? "text-primary" : "bg-primary text-primary-foreground" : orientation === "bottom" ? "text-muted-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    )}><item.icon className="size-5" />{item.label}</Link>;
  });
}

export function AppLayout({ children }: { children: ReactNode }) {
  const getSessionFn = useServerFn(getSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => getSessionFn() });
  const isAdmin = !!session?.roles.includes("admin");
  async function handleSignOut() {
    await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }
  return <div className="min-h-screen bg-background">
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r bg-card p-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2"><span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sun className="size-5" /></span><div><p className="text-sm font-extrabold leading-tight">RS CONECT</p><p className="text-[11px] text-muted-foreground">Colégio Raios de Sol</p></div></div>
      <nav className="flex flex-col gap-1"><NavLinks isAdmin={isAdmin} orientation="sidebar" /></nav>
      <div className="mt-auto border-t pt-3"><p className="truncate px-2 text-sm font-semibold">{session?.fullName}</p><p className="truncate px-2 text-xs text-muted-foreground">{session?.email}</p><Button variant="ghost" size="sm" className="mt-2 w-full justify-start text-muted-foreground" onClick={handleSignOut}><LogOut className="size-4" /> Sair</Button></div>
    </aside>
    <div className="md:pl-60">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3 md:px-6">
        <div className="flex items-center gap-2 md:hidden"><span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Sun className="size-4" /></span><p className="text-sm font-extrabold">RS CONECT</p></div>
        <p className="hidden text-sm font-bold md:block">Colégio Raios de Sol</p>
        <div className="flex items-center gap-2"><span className="hidden text-sm font-semibold text-muted-foreground md:block">{session?.fullName}</span><span className="hidden items-center gap-1 text-xs text-muted-foreground lg:flex"><ShieldCheck className="size-4" /> Acesso protegido</span><Button variant="outline" size="sm" className="md:hidden" onClick={handleSignOut} aria-label="Sair"><LogOut className="size-4" /></Button></div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 md:pb-10 md:pt-6">{children}</main>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-card md:hidden"><NavLinks isAdmin={isAdmin} orientation="bottom" /></nav>
  </div>;
}
