import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Building2, ShieldCheck, Users } from "lucide-react";
import { getSession } from "@/lib/session.functions";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Início — RS CONECT" }, { name: "description", content: "Central de acesso do RS CONECT." }] }),
  component: HomePage,
});
const roleLabels: Record<string, string> = { admin: "Administrador", direcao: "Direção", responsavel: "Responsável de setor", colaborador: "Colaborador" };

function HomePage() {
  const getSessionFn = useServerFn(getSession);
  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => getSessionFn() });
  const isAdmin = !!session?.roles.includes("admin");
  const role = session?.roles[0] ?? "colaborador";
  return <div className="space-y-7">
    <section className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
      <p className="text-sm font-semibold opacity-80">Central interna · Colégio Raios de Sol</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Olá, {session?.fullName?.split(" ")[0] ?? "bem-vindo"}!</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed opacity-85">Bem-vindo ao RS CONECT. Aqui você encontra os recursos disponíveis conforme seu perfil de acesso.</p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-background/15 px-3 py-1.5 text-xs font-semibold"><ShieldCheck className="size-4" /> {roleLabels[role] ?? "Usuário autorizado"}</div>
    </section>
    <section><div className="mb-3"><h2 className="text-lg font-bold">Acessos rápidos</h2><p className="text-sm text-muted-foreground">Os recursos aparecem conforme suas permissões.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {isAdmin ? <>
          <Link to="/admin/pessoas" className="group rounded-2xl border bg-card p-5 transition-colors hover:bg-accent/50"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="size-5" /></span><h3 className="mt-4 font-bold">Pessoas autorizadas</h3><p className="mt-1 text-sm text-muted-foreground">Gerencie e-mails, papéis, setores e acessos.</p><span className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary">Abrir administração <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span></Link>
          <Link to="/admin/setores" className="group rounded-2xl border bg-card p-5 transition-colors hover:bg-accent/50"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="size-5" /></span><h3 className="mt-4 font-bold">Setores</h3><p className="mt-1 text-sm text-muted-foreground">Edite setores e consulte seus responsáveis.</p><span className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary">Gerenciar setores <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span></Link>
        </> : <div className="rounded-2xl border bg-card p-5 sm:col-span-2"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="size-5" /></span><h3 className="mt-4 font-bold">Seu acesso está configurado</h3><p className="mt-1 text-sm text-muted-foreground">Os setores e recursos disponíveis para sua conta são definidos pela administração do RS CONECT.</p>{session?.responsibleSectors?.length ? <p className="mt-3 text-sm font-medium">Responsável por: {session.responsibleSectors.map((s) => s.name).join(", ")}</p> : null}</div>}
      </div>
    </section>
    <p className="text-xs text-muted-foreground">As permissões são validadas no banco de dados, além da navegação da interface.</p>
  </div>;
}