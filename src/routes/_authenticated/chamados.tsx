import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chamados")({
  head: () => ({ meta: [{ title: "Chamados — RS CONECT" }] }),
  component: ChamadosFuturePage,
});

function ChamadosFuturePage() {
  return (
    <section className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ClipboardList className="size-7" />
      </span>
      <h1 className="mt-5 text-2xl font-black">Módulo em preparação</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        O módulo de chamados será desenvolvido em uma próxima etapa. Por enquanto, o RS CONECT está focado no acesso, nos perfis e na organização dos setores.
      </p>
    </section>
  );
}
