import { ChangeEvent, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Camera, CheckCircle2, Clock3, ImagePlus, MessageCircle, Paperclip, Plus, Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/session.functions";

type Ticket = {
  id: string; created_by: string; sector_id: string; title: string; description: string; location: string | null;
  priority: "normal" | "urgente"; status: "aberto" | "em_andamento" | "resolvido"; photo_paths: string[];
  solution_comment: string | null; solution_photo: string | null; resolved_at: string | null; created_at: string; updated_at: string;
  sector?: { id: string; name: string } | null;
};
type Comment = { id: string; ticket_id: string; author_id: string; body: string; photo_path: string | null; created_at: string };
type History = { id: string; ticket_id: string; actor_id: string | null; event: string; details: Record<string, unknown> | null; created_at: string };
type Profile = { id: string; full_name: string; email: string | null };

export const Route = createFileRoute("/_authenticated/chamados")({
  head: () => ({ meta: [{ title: "Chamados — RS CONECT" }] }),
  component: ChamadosPage,
});

const statusLabel: Record<Ticket["status"], string> = { aberto: "Aberto", em_andamento: "Em andamento", resolvido: "Resolvido" };
const statusStyle: Record<Ticket["status"], string> = {
  aberto: "bg-amber-500/10 text-amber-700", em_andamento: "bg-primary/10 text-primary", resolvido: "bg-emerald-500/10 text-emerald-700",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
async function signedUrl(path: string) {
  const { data } = await supabase.storage.from("chamados").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
async function notifyTicket(ticketId: string, type: "novo_chamado" | "status_alterado") {
  try {
    await supabase.functions.invoke("send-ticket-notification", { body: { ticketId, type } });
  } catch {
    // A notificação não deve impedir a abertura/atualização do chamado.
  }
}

async function uploadPhoto(ticketId: string, file: File, kind: "chamado" | "solucao") {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = kind === "solucao" ? `${ticketId}/solucao-${crypto.randomUUID()}.${extension}` : `${ticketId}/chamado-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("chamados").upload(path, file, { cacheControl: "3600", contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

function ChamadosPage() {
  const getSessionFn = useServerFn(getSession);
  const queryClient = useQueryClient();
  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ["session"], queryFn: () => getSessionFn() });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"todos" | Ticket["status"]>("todos");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [error, setError] = useState("");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tickets").select("*, sector:sectors(id,name)").order("priority", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
    enabled: !!session,
  });

  const isAdmin = !!session?.roles.includes("admin");
  const isResponsible = !!session?.roles.includes("responsavel") || isAdmin;
  const visibleTickets = tickets.filter((ticket) => (statusFilter === "todos" || ticket.status === statusFilter) && (!urgentOnly || ticket.priority === "urgente"));

  if (sessionLoading || isLoading) return <p className="text-sm text-muted-foreground">Carregando chamados…</p>;

  if (creating) {
    return <NewTicketForm sessionUserId={session?.userId ?? ""} onCancel={() => setCreating(false)} onCreated={async (id) => {
      setCreating(false); setSelectedId(id); await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    }} />;
  }

  if (selectedId) {
    const ticket = tickets.find((item) => item.id === selectedId);
    if (ticket) return <TicketDetail ticket={ticket} isResponsible={isResponsible} onBack={() => setSelectedId(null)} onChanged={async () => { await queryClient.invalidateQueries({ queryKey: ["tickets"] }); }} onError={setError} />;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Atendimento interno</p><h1 className="mt-1 text-2xl font-black">Chamados</h1><p className="mt-1 text-sm text-muted-foreground">{isResponsible ? "Acompanhe os chamados dos seus setores." : "Acompanhe os pedidos que você abriu."}</p></div>
        <Button onClick={() => setCreating(true)}><Plus className="size-4" />Novo chamado</Button>
      </header>
      {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center">
        <select aria-label="Filtrar por status" className="h-10 rounded-lg border bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="todos">Todos os status</option><option value="aberto">Abertos</option><option value="em_andamento">Em andamento</option><option value="resolvido">Resolvidos</option>
        </select>
        {isResponsible ? <label className="flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium"><input type="checkbox" checked={urgentOnly} onChange={(e) => setUrgentOnly(e.target.checked)} />Somente urgentes</label> : null}
        <span className="text-sm text-muted-foreground sm:ml-auto">{visibleTickets.length} chamado(s)</span>
      </section>
      <section className="space-y-3">
        {visibleTickets.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center"><CheckCircle2 className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-semibold">Nenhum chamado encontrado.</p><p className="mt-1 text-sm text-muted-foreground">Os chamados que você puder acessar aparecerão aqui.</p></div> :
          visibleTickets.map((ticket) => <button key={ticket.id} type="button" onClick={() => setSelectedId(ticket.id)} className="w-full rounded-2xl border bg-card p-4 text-left transition hover:bg-accent/40">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-bold">{ticket.title}</h2><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle[ticket.status]}`}>{statusLabel[ticket.status]}</span>{ticket.priority === "urgente" ? <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive"><ShieldAlert className="size-3" />Urgente</span> : null}</div><p className="mt-1 text-sm text-muted-foreground">{ticket.sector?.name ?? "Setor"}{ticket.location ? ` · ${ticket.location}` : ""}</p></div><Clock3 className="mt-1 size-4 shrink-0 text-muted-foreground" /></div>
            <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{ticket.description}</p><p className="mt-3 text-xs text-muted-foreground">{formatDate(ticket.created_at)}</p>
          </button>)}
      </section>
    </div>
  );
}

function NewTicketForm({ sessionUserId, onCancel, onCreated }: { sessionUserId: string; onCancel: () => void; onCreated: (id: string) => Promise<void> }) {
  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);
  const [sectorId, setSectorId] = useState(""); const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [location, setLocation] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgente">("normal"); const [files, setFiles] = useState<File[]>([]); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null); const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("sectors").select("id,name").eq("active", true).order("name").then(({ data, error: loadError }) => {
      if (loadError) setError("Não foi possível carregar os setores ativos."); else setSectors((data ?? []) as { id: string; name: string }[]);
    });
  }, []);

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    setFiles((current) => [...current, ...Array.from(event.target.files ?? [])].slice(0, 3)); event.target.value = "";
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!sectorId || title.trim().length < 3 || description.trim().length < 3) { setError("Preencha setor, título e descrição."); return; }
    setSaving(true); setError("");
    try {
      const { data: ticket, error: insertError } = await supabase.from("tickets").insert({ created_by: sessionUserId, sector_id: sectorId, title: title.trim(), description: description.trim(), location: location.trim() || null, priority, status: "aberto", photo_paths: [] }).select("id").single();
      if (insertError || !ticket) throw insertError ?? new Error("Não foi possível criar o chamado.");
      const paths: string[] = [];
      for (const file of files.slice(0, 3)) paths.push(await uploadPhoto(ticket.id, file, "chamado"));
      if (paths.length) {
        const { error: updateError } = await supabase.from("tickets").update({ photo_paths: paths }).eq("id", ticket.id);
        if (updateError) throw updateError;
      }
      await notifyTicket(ticket.id, "novo_chamado");
      await onCreated(ticket.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível abrir o chamado."); } finally { setSaving(false); }
  }

  return <form onSubmit={submit} className="space-y-5">
    <header className="flex items-center gap-3"><Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Voltar"><ArrowLeft className="size-5" /></Button><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Novo chamado</p><h1 className="text-2xl font-black">Abrir solicitação</h1></div></header>
    <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
      <label className="block space-y-1.5 text-sm font-medium">Setor<select required className="h-10 w-full rounded-lg border bg-background px-3" value={sectorId} onChange={(e) => setSectorId(e.target.value)}><option value="">Selecione um setor ativo</option>{sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></label>
      <label className="block space-y-1.5 text-sm font-medium">Título curto<input required minLength={3} maxLength={120} className="h-10 w-full rounded-lg border bg-background px-3" placeholder="Ex.: Torneira com vazamento" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="block space-y-1.5 text-sm font-medium">Descrição<textarea required minLength={3} rows={5} className="w-full rounded-lg border bg-background p-3" placeholder="Explique o que aconteceu." value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <label className="block space-y-1.5 text-sm font-medium">Local<input maxLength={160} className="h-10 w-full rounded-lg border bg-background px-3" placeholder="Ex.: Sala 5" value={location} onChange={(e) => setLocation(e.target.value)} /></label>
      <fieldset><legend className="text-sm font-medium">Prioridade</legend><div className="mt-2 grid grid-cols-2 gap-2">{(["normal", "urgente"] as const).map((value) => <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${priority === value ? "border-primary bg-primary/5" : ""}`}><input type="radio" name="priority" value={value} checked={priority === value} onChange={() => setPriority(value)} />{value === "urgente" ? "Urgente" : "Normal"}</label>)}</div></fieldset>
      <div><p className="text-sm font-medium">Fotos <span className="font-normal text-muted-foreground">(até 3)</span></p><div className="mt-2 flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={files.length >= 3} onClick={() => cameraRef.current?.click()}><Camera className="size-4" />Câmera</Button><Button type="button" variant="outline" disabled={files.length >= 3} onClick={() => galleryRef.current?.click()}><ImagePlus className="size-4" />Galeria</Button><input ref={cameraRef} className="hidden" type="file" accept="image/*" capture="environment" onChange={addFiles} /><input ref={galleryRef} className="hidden" type="file" accept="image/*" multiple onChange={addFiles} /></div>
      {files.length ? <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-muted p-2"><span className="truncate">{file.name}</span><button type="button" className="font-semibold text-destructive" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>Remover</button></li>)}</ul> : null}</div>
      {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}<div className="flex gap-2"><Button type="submit" disabled={saving}>{saving ? "Abrindo…" : "Abrir chamado"}</Button><Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button></div>
    </section>
  </form>;
}

function TicketDetail({ ticket, isResponsible, onBack, onChanged, onError }: { ticket: Ticket; isResponsible: boolean; onBack: () => void; onChanged: () => Promise<void>; onError: (message: string) => void }) {
  const [comments, setComments] = useState<Comment[]>([]); const [history, setHistory] = useState<History[]>([]); const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [photoUrls, setPhotoUrls] = useState<string[]>([]); const [solutionUrl, setSolutionUrl] = useState<string | null>(null); const [comment, setComment] = useState("");
  const [nextStatus, setNextStatus] = useState<Ticket["status"]>(ticket.status); const [solutionComment, setSolutionComment] = useState(ticket.solution_comment ?? "");
  const [solutionFile, setSolutionFile] = useState<File | null>(null); const [savingStatus, setSavingStatus] = useState(false); const [savingComment, setSavingComment] = useState(false); const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: commentsData }, { data: historyData }] = await Promise.all([
        supabase.from("ticket_comments").select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true }),
        supabase.from("ticket_history").select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true }),
      ]);
      const ids = [...new Set([...(commentsData ?? []).map((item) => item.author_id), ...(historyData ?? []).map((item) => item.actor_id).filter(Boolean)])] as string[];
      const { data: profileData } = ids.length ? await supabase.from("profiles").select("id,full_name,email").in("id", ids) : { data: [] as Profile[] };
      if (cancelled) return;
      setComments((commentsData ?? []) as Comment[]); setHistory((historyData ?? []) as History[]);
      setProfiles(Object.fromEntries(((profileData ?? []) as Profile[]).map((profile) => [profile.id, profile])));
      setPhotoUrls((await Promise.all((ticket.photo_paths ?? []).map(signedUrl))).filter(Boolean) as string[]);
      setSolutionUrl(ticket.solution_photo ? await signedUrl(ticket.solution_photo) : null);
    })();
    return () => { cancelled = true; };
  }, [ticket.id, ticket.photo_paths, ticket.solution_photo]);

  async function changeStatus() {
    if (!isResponsible || nextStatus === ticket.status) return;
    setSavingStatus(true); setError("");
    try {
      let solutionPath = ticket.solution_photo;
      if (nextStatus === "resolvido" && solutionFile) solutionPath = await uploadPhoto(ticket.id, solutionFile, "solucao");
      const { error: updateError } = await supabase.from("tickets").update({
        status: nextStatus,
        solution_comment: nextStatus === "resolvido" ? (solutionComment.trim() || null) : ticket.solution_comment,
        solution_photo: nextStatus === "resolvido" ? solutionPath : ticket.solution_photo,
      }).eq("id", ticket.id);
      if (updateError) throw updateError;
      await onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível alterar o status."); } finally { setSavingStatus(false); }
  }

  async function addComment(event: React.FormEvent) {
    event.preventDefault(); if (!comment.trim()) return;
    setSavingComment(true); setError("");
    try {
      const { data: sessionData } = await supabase.auth.getUser(); if (!sessionData.user) throw new Error("Sessão expirada.");
      const { error: insertError } = await supabase.from("ticket_comments").insert({ ticket_id: ticket.id, author_id: sessionData.user.id, body: comment.trim() });
      if (insertError) throw insertError;
      setComment("");
      const { data } = await supabase.from("ticket_comments").select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true });
      setComments((data ?? []) as Comment[]);
      const { data: historyData } = await supabase.from("ticket_history").select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true });
      setHistory((historyData ?? []) as History[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível adicionar o comentário."); } finally { setSavingComment(false); }
  }

  const nextLabel = ticket.status === "aberto" ? "Marcar em andamento" : ticket.status === "em_andamento" ? "Resolver chamado" : "Resolvido";

  return <div className="space-y-5">
    <header className="flex items-start gap-3"><Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar"><ArrowLeft className="size-5" /></Button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-wider text-primary">Chamado</p>{ticket.priority === "urgente" ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">Urgente</span> : null}</div><h1 className="mt-1 text-2xl font-black">{ticket.title}</h1><p className="mt-1 text-sm text-muted-foreground">{ticket.sector?.name ?? "Setor"}{ticket.location ? ` · ${ticket.location}` : ""}</p></div></header>
    <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[ticket.status]}`}>{statusLabel[ticket.status]}</span><span className="text-xs text-muted-foreground">Aberto em {formatDate(ticket.created_at)}</span></div><div><h2 className="text-sm font-bold">Descrição</h2><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p></div>{photoUrls.length ? <div><h2 className="text-sm font-bold">Fotos do chamado</h2><div className="mt-2 grid grid-cols-3 gap-2">{photoUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Foto do chamado ${index + 1}`} className="aspect-square w-full rounded-lg object-cover" /></a>)}</div></div> : null}</section>

    {isResponsible && ticket.status !== "resolvido" ? <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6"><div><h2 className="font-bold">Atualizar chamado</h2><p className="mt-1 text-xs text-muted-foreground">Somente o responsável deste setor ou um administrador pode alterar o status.</p></div><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as Ticket["status"])}><option value={ticket.status}>{statusLabel[ticket.status]}</option>{ticket.status === "aberto" ? <option value="em_andamento">Em andamento</option> : null}{ticket.status === "em_andamento" ? <option value="resolvido">Resolvido</option> : null}</select>{nextStatus === "resolvido" ? <><label className="block space-y-1.5 text-sm font-medium">Comentário da solução<textarea rows={4} className="w-full rounded-lg border bg-background p-3" placeholder="Descreva o que foi feito." value={solutionComment} onChange={(e) => setSolutionComment(e.target.value)} /></label><label className="block space-y-1.5 text-sm font-medium">Foto da solução<input className="mt-1 block w-full text-sm" type="file" accept="image/*" capture="environment" onChange={(e) => setSolutionFile(e.target.files?.[0] ?? null)} /></label></> : null}<Button disabled={savingStatus || nextStatus === ticket.status} onClick={changeStatus}>{savingStatus ? "Salvando…" : nextLabel}</Button></section> : null}

    {ticket.status === "resolvido" && (ticket.solution_comment || solutionUrl) ? <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-6"><div className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" /><h2 className="font-bold">Solução</h2></div>{ticket.solution_comment ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.solution_comment}</p> : null}{solutionUrl ? <a href={solutionUrl} target="_blank" rel="noreferrer"><img src={solutionUrl} alt="Foto da solução" className="max-h-72 rounded-lg object-contain" /></a> : null}</section> : null}

    {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
    <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6"><div className="flex items-center gap-2"><MessageCircle className="size-5 text-primary" /><h2 className="font-bold">Comentários</h2></div>{comments.length ? <div className="space-y-3">{comments.map((item) => <article key={item.id} className="rounded-xl bg-muted/60 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{profiles[item.author_id]?.full_name ?? "Usuário"}</p><time className="text-xs text-muted-foreground">{formatDate(item.created_at)}</time></div><p className="mt-2 whitespace-pre-wrap text-sm">{item.body}</p></article>)}</div> : <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>}<form onSubmit={addComment} className="flex gap-2"><textarea className="min-h-10 flex-1 rounded-lg border bg-background p-2.5 text-sm" placeholder="Adicionar comentário…" value={comment} onChange={(e) => setComment(e.target.value)} /><Button type="submit" size="icon" disabled={savingComment || !comment.trim()} aria-label="Enviar comentário"><Send className="size-4" /></Button></form></section>

    <section className="rounded-2xl border bg-card p-4 sm:p-6"><div className="flex items-center gap-2"><Paperclip className="size-5 text-primary" /><h2 className="font-bold">Histórico</h2></div><div className="mt-3 space-y-3">{history.map((item) => <div key={item.id} className="flex gap-3 border-l-2 pl-3"><div className="min-w-0"><p className="text-sm"><span className="font-semibold">{profiles[item.actor_id ?? ""]?.full_name ?? "Sistema"}</span>{" "}{historyLabel(item)}</p><time className="text-xs text-muted-foreground">{formatDate(item.created_at)}</time></div></div>)}</div></section>
  </div>;
}

function historyLabel(item: History) {
  if (item.event === "chamado_criado") return "abriu o chamado.";
  if (item.event === "comentario_adicionado") return "adicionou um comentário.";
  if (item.event === "status_alterado") {
    const from = String(item.details?.["de"] ?? ""); const to = String(item.details?.["para"] ?? "");
    return `alterou o status de ${statusLabel[from as Ticket["status"]] ?? from} para ${statusLabel[to as Ticket["status"]] ?? to}.`;
  }
  return "atualizou o chamado.";
}
