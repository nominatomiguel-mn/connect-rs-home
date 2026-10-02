export const STATUS_LABELS: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
};

export const PRIORITY_LABELS: Record<string, string> = {
  normal: "Normal",
  urgente: "Urgente",
};

export function statusClasses(status: string): string {
  switch (status) {
    case "aberto":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "em_andamento":
      return "bg-sky-100 text-sky-900 border-sky-300";
    case "resolvido":
      return "bg-emerald-100 text-emerald-900 border-emerald-300";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function priorityClasses(priority: string): string {
  return priority === "urgente"
    ? "bg-red-100 text-red-900 border-red-300"
    : "bg-muted text-muted-foreground border-border";
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function historyEventLabel(event: string): string {
  switch (event) {
    case "chamado_criado":
      return "Chamado criado";
    case "status_alterado":
      return "Status alterado";
    default:
      return event;
  }
}

export function historyDetailsText(event: string, details: unknown): string {
  if (!details || typeof details !== "object") return "";
  const d = details as Record<string, unknown>;
  if (event === "status_alterado") {
    const de = STATUS_LABELS[String(d.de)] ?? String(d.de ?? "");
    const para = STATUS_LABELS[String(d.para)] ?? String(d.para ?? "");
    return `${de} → ${para}`;
  }
  if (event === "chamado_criado") {
    return `Prioridade: ${PRIORITY_LABELS[String(d.prioridade)] ?? String(d.prioridade ?? "")}`;
  }
  return "";
}
