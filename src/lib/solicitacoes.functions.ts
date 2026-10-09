import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendEmail, emailLayout, escapeHtml } from "./email.server";

// Aviso por e-mail de solicitações (falha no envio não bloqueia a operação).
export const notifySolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        solicitacaoId: z.string().uuid(),
        type: z.enum(["nova", "decidida"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    try {
      // Confere acesso pelas regras do banco, como o próprio usuário.
      const { data: s } = await context.supabase
        .from("solicitacoes")
        .select("id, created_by, tipo, titulo, status")
        .eq("id", data.solicitacaoId)
        .maybeSingle();
      if (!s) return { ok: false, sent: 0 };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      const isDirecao = (roles ?? []).some((r) => r.role === "direcao");
      if (data.type === "nova" && s.created_by !== context.userId && !isAdmin) return { ok: false, sent: 0 };
      if (data.type === "decidida" && !isAdmin && !isDirecao) return { ok: false, sent: 0 };

      let recipients: string[] = [];
      if (data.type === "nova") {
        const { data: ds } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "direcao");
        const ids = (ds ?? []).map((x) => x.user_id);
        if (ids.length) {
          const { data: ps } = await supabaseAdmin.from("profiles").select("email").in("id", ids);
          recipients = (ps ?? []).map((p) => p.email).filter((x): x is string => !!x);
        }
      } else {
        const { data: p } = await supabaseAdmin.from("profiles").select("email").eq("id", s.created_by).maybeSingle();
        if (p?.email) recipients = [p.email];
      }
      if (!recipients.length) return { ok: true, sent: 0 };

      const statusLabel = s.status === "aprovada" ? "aprovada" : s.status === "negada" ? "negada" : String(s.status);
      const subject = data.type === "nova" ? `Nova solicitação — ${s.titulo}` : `Solicitação ${statusLabel} — ${s.titulo}`;
      const html =
        data.type === "nova"
          ? emailLayout("Nova solicitação", `<p><strong>Tipo:</strong> ${escapeHtml(String(s.tipo))}</p><p><strong>Título:</strong> ${escapeHtml(s.titulo)}</p><p>Abra o app RS CONECT para decidir.</p>`)
          : emailLayout("Sua solicitação foi decidida", `<p><strong>${escapeHtml(s.titulo)}</strong> foi <strong>${escapeHtml(statusLabel)}</strong>.</p><p>Abra o app RS CONECT para ver os detalhes.</p>`);
      const results = await Promise.all(recipients.map((to) => sendEmail({ to, subject, html })));
      return { ok: true, sent: results.filter(Boolean).length };
    } catch (err) {
      console.error("[email] Falha ao notificar solicitação:", err);
      return { ok: false, sent: 0 };
    }
  });
