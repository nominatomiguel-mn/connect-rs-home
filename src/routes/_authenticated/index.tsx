import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Sun } from "lucide-react";
import { getSession } from "@/lib/session.functions";
import { listTickets } from "@/lib/chamados.functions";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  formatDateTime,
  priorityClasses,
  statusClasses,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "RS CONECT — Chamados | Colégio Raios de Sol" },
      {
        name: "description",
        content:
          "Abra, acompanhe e resolva chamados do Colégio Raios de Sol.",
      },
      { property: "og:title", content: "RS CONECT — Chamados" },
      {
        property: "og:description",
        content: "Abra, acompanhe e resolva chamados do Colégio Raios de Sol.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChamadosPage,
});

const STATUS_FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "aberto", label: "Abertos" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "resolvido", label: "Resolvidos" },
] as const;

function ChamadosPage() {
  const getSessionFn = useServerFn(getSession);
  const listTicketsFn = useServerFn(listTickets);
  const [status, setStatus] = useState<string>("todos");
  const [urgente, setUrgente] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => getSessionFn(),
  });
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets", status, urgente],
    queryFn: () => listTicketsFn({ data: { status: status as never, urgente } }),
  });

  const isResponsavel = (session?.responsibleSectors.length ?? 0) > 0;
  const seesQueue =
    isResponsavel || session?.roles.includes("admin") || session?.roles.includes("direcao");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold md:text-2xl">Chamados</h1>
          <p className="text-sm text-muted-foreground">
            {seesQueue
              ? isResponsavel
                ? `Setores que você atende: ${session?.responsibleSectors.map((s) => s.name).join(", ")}`
                : "Você vê os chamados de todos os setores."
              : "Seus chamados e o andamento de cada um."}
          </p>
        </div>
        <Button asChild className="hidden md:inline-flex">
          <Link to="/novo-chamado">
            <Plus className="size-4" /> Novo chamado
          </Link>
        </Button>
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                status === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => setUrgente((v) => !v)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
              urgente
                ? "border-red-400 bg-red-500 text-white"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            Só urgentes
          </button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-14 text-center">
          <Sun className="size-10 text-yellow-500" />
          <div>
            <p className="font-bold">Nenhum chamado por aqui</p>
            <p className="text-sm text-muted-foreground">
              Quando algo precisar de atenção, abra um novo chamado.
            </p>
          </div>
          <Button asChild className="md:hidden">
            <Link to="/novo-chamado">
              <Plus className="size-4" /> Novo chamado
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                to="/chamados/$id"
                params={{ id: t.id }}
                className="block rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold leading-snug">{t.title}</p>
                  {t.priority === "urgente" && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                        priorityClasses(t.priority),
                      )}
                    >
                      Urgente
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.sector?.name}
                  {t.location ? ` · ${t.location}` : ""}
                  {seesQueue && t.creator?.full_name
                    ? ` · por ${t.creator.full_name}`
                    : ""}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-bold",
                      statusClasses(t.status),
                    )}
                  >
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(t.created_at)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Botão flutuante (celular) */}
      <Link
        to="/novo-chamado"
        className="fixed bottom-20 right-4 z-20 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
        aria-label="Novo chamado"
      >
        <Plus className="size-7" />
      </Link>
    </div>
  );
}
