import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendEmail, emailLayout, escapeHtml } from "./email.server";

const statusFilter = z.enum(["aberto", "em_andamento", "resolvido", "todos"]);

export const listSectors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sectors")
      .select("id, name")
      .eq("active", true)
      .order("name");
    if (error) throw new Error("Não foi possível carregar os setores.");
    return data;
  });

export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { status?: z.infer<typeof statusFilter>; urgente?: boolean } | undefined) =>
      z
        .object({
          status: statusFilter.default("todos"),
          urgente: z.boolean().default(false),
        })
        .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    let query = context.supabase
      .from("tickets")
      .select(
        "id, title, location, priority, status, created_at, resolved_at, sector:sectors(name), creator:profiles!tickets_created_by_fkey(full_name)",
      )
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.status !== "todos") query = query.eq("status", data.status);
    if (data.urgente) query = query.eq("priority", "urgente");
    const { data: tickets, error } = await query;
    if (error) throw new Error("Não foi possível carregar os chamados.");
    return tickets;
  });

export const getTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: ticket, error } = await sb
      .from("tickets")
      .select(
        "*, sector:sectors(id, name), creator:profiles!tickets_created_by_fkey(id, full_name)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error || !ticket) {
      throw new Error("Chamado não encontrado ou você não tem acesso a ele.");
    }
    const [commentsRes, historyRes] = await Promise.all([
      sb
        .from("ticket_comments")
        .select("*, author:profiles!ticket_comments_author_id_fkey(full_name)")
        .eq("ticket_id", data.id)
        .order("created_at", { ascending: true }),
      sb
        .from("ticket_history")
        .select("*, actor:profiles!ticket_history_actor_id_fkey(full_name)")
        .eq("ticket_id", data.id)
        .order("created_at", { ascending: true }),
    ]);
    return {
      ticket,
      comments: commentsRes.data ?? [],
      history: historyRes.data ?? [],
    };
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sector_id: z.string().uuid("Escolha um setor."),
        title: z.string().trim().min(3, "Escreva um título curto.").max(120),
        description: z
          .string()
          .trim()
          .min(3, "Descreva o que você precisa.")
          .max(2000),
        location: z.string().trim().max(120).optional(),
        priority: z.enum(["normal", "urgente"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: created, error } = await context.supabase
      .from("tickets")
      .insert({
        created_by: context.userId,
        sector_id: data.sector_id,
        title: data.title,
        description: data.description,
        location: data.location || null,
        priority: data.priority,
      })
      .select("id")
      .single();
    if (error || !created) {
      throw new Error("Não foi possível criar o chamado. Tente novamente.");
    }
    await notifyNewTicket(created.id);
    return { id: created.id };
  });

export const updateTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["aberto", "em_andamento", "resolvido"]),
        solution_comment: z.string().trim().max(2000).optional(),
        solution_photo: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "resolvido") {
      if (data.solution_comment) patch.solution_comment = data.solution_comment;
      if (data.solution_photo) patch.solution_photo = data.solution_photo;
patch.resolved_at = new Date().toISOString();
    }
    const { error } = await context.supabase
      .from("tickets")
      .update(patch)
      .eq("id", data.id);
    if (error) {
      throw new Error(
        "Você não tem permissão para alterar este chamado ou ele não existe.",
      );
    }
    if (data.status === "resolvido" && data.solution_comment) {
      await context.supabase.from("ticket_comments").insert({
        ticket_id: data.id,
        author_id: context.userId,
        body: data.solution_comment,
        photo_path: data.solution_photo ?? null,
      });
    }
    await notifyStatusChange(data.id, data.status);
    return { ok: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticket_id: z.string().uuid(),
        body: z.string().trim().min(1, "Escreva um comentário.").max(2000),
        photo_path: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("ticket_comments").insert({
      ticket_id: data.ticket_id,
      author_id: context.userId,
      body: data.body,
      photo_path: data.photo_path ?? null,
    });
    if (error) {
      throw new Error("Não foi possível salvar o comentário. Tente novamente.");
    }
    return { ok: true };
  });

// ===== Notificações por e-mail (não bloqueiam a operação) =====

async function notifyNewTicket(ticketId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select(
        "title, priority, location, sector_id, sector:sectors(name), creator:profiles!tickets_created_by_fkey(full_name)",
      )
      .eq("id", ticketId)
      .maybeSingle();
    if (!ticket) return;
    const { data: responsibles } = await supabaseAdmin
      .from("sector_responsibles")
      .select("profile:profiles!sector_responsibles_user_id_fkey(email, full_name)")
      .eq("sector_id", ticket.sector_id);
    const recipients = (responsibles ?? [])
      .map((r) => r.profile?.email)
      .filter((e): e is string => !!e);
    const sectorName = ticket.sector?.name ?? "";
    const priority = ticket.priority === "urgente" ? "URGENTE" : "normal";
    const html = emailLayout(
      `Novo chamado em ${escapeHtml(sectorName)}`,
      `<p><strong>${escapeHtml(ticket.title)}</strong> (prioridade: ${priority})</p>
       <p>Aberto por ${escapeHtml(ticket.creator?.full_name ?? "alguém da escola")}${ticket.location ? `, local: ${escapeHtml(ticket.location)}` : ""}.</p>
       <p>Abra o app RS CONECT para atender.</p>`,
    );
    await Promise.all(
      recipients.map((to) =>
        sendEmail({ to, subject: `Novo chamado em ${sectorName}: ${ticket.title}`, html }),
      ),
    );
  } catch (err) {
    console.error("[email] Falha ao notificar responsáveis:", err);
  }
}

async function notifyStatusChange(
  ticketId: string,
  status: string,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select(
        "title, status, creator:profiles!tickets_created_by_fkey(email, full_name)",
      )
      .eq("id", ticketId)
      .maybeSingle();
    const to = ticket?.creator?.email;
    if (!ticket || !to) return;
    const labels: Record<string, string> = {
      aberto: "Aberto",
      em_andamento: "Em andamento",
      resolvido: "Resolvido",
    };
    const html = emailLayout(
      "Seu chamado mudou de status",
      `<p>O chamado <strong>${escapeHtml(ticket.title)}</strong> agora está: <strong>${labels[status] ?? status}</strong>.</p>
       <p>Abra o app RS CONECT para ver os detalhes.</p>`,
    );
    await sendEmail({
      to,
      subject: `Chamado atualizado: ${ticket.title}`,
      html,
    });
  } catch (err) {
    console.error("[email] Falha ao notificar criador:", err);
  }
}
