const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotificationType = "novo_chamado" | "status_alterado";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("MAIL_FROM");

    if (!supabaseUrl || !serviceRoleKey || !resendKey || !from) {
      return json({ error: "Serviço de e-mail não configurado." }, 503);
    }

    const { ticketId, type } = await req.json() as { ticketId?: string; type?: NotificationType };
    if (!ticketId || (type !== "novo_chamado" && type !== "status_alterado")) {
      return json({ error: "Parâmetros inválidos." }, 400);
    }

    const db = createServiceClient(supabaseUrl, serviceRoleKey);
    const accessToken = authHeader.replace(/^Bearer\s+/i, "");

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: serviceRoleKey },
    });
    if (!authResponse.ok) return json({ error: "Sessão inválida." }, 401);
    const caller = await authResponse.json() as { id: string };

    const { data: ticket } = await db.from("tickets").select("id,title,description,location,priority,status,sector_id,created_by").eq("id", ticketId).maybeSingle();
    if (!ticket) return json({ error: "Chamado não encontrado." }, 404);

    const { data: roleRows } = await db.from("user_roles").select("role").eq("user_id", caller.id);
    const isAdmin = (roleRows ?? []).some((row: { role: string }) => row.role === "admin");

    if (!isAdmin) {
      if (type === "novo_chamado" && ticket.created_by !== caller.id) return json({ error: "Sem permissão." }, 403);
      if (type === "status_alterado") {
        const { data: responsible } = await db.from("sector_responsibles").select("user_id").eq("sector_id", ticket.sector_id).eq("user_id", caller.id).maybeSingle();
        if (!responsible) return json({ error: "Sem permissão." }, 403);
      }
    }

    const { data: sector } = await db.from("sectors").select("name").eq("id", ticket.sector_id).maybeSingle();
    let recipients: { email: string; name: string }[] = [];

    if (type === "novo_chamado") {
      const { data: responsibleRows } = await db.from("sector_responsibles").select("user_id").eq("sector_id", ticket.sector_id);
      const ids = (responsibleRows ?? []).map((row: { user_id: string }) => row.user_id);
      if (ids.length) {
        const { data: profiles } = await db.from("profiles").select("email,full_name").in("id", ids);
        recipients = (profiles ?? []).filter((profile: { email: string | null }) => profile.email).map((profile: { email: string | null; full_name: string }) => ({ email: profile.email!, name: profile.full_name }));
      }
    } else {
      const { data: profile } = await db.from("profiles").select("email,full_name").eq("id", ticket.created_by).maybeSingle();
      if (profile?.email) recipients = [{ email: profile.email, name: profile.full_name }];
    }

    if (!recipients.length) return json({ ok: true, sent: 0 });

    const subject = type === "novo_chamado"
      ? `Novo chamado ${ticket.priority === "urgente" ? "URGENTE " : ""}— ${ticket.title}`
      : `Chamado atualizado — ${ticket.title}`;

    const html = type === "novo_chamado"
      ? `<h2>Novo chamado</h2><p><strong>Setor:</strong> ${escapeHtml(sector?.name ?? "")}</p><p><strong>Título:</strong> ${escapeHtml(ticket.title)}</p><p><strong>Prioridade:</strong> ${escapeHtml(ticket.priority)}</p><p><strong>Local:</strong> ${escapeHtml(ticket.location ?? "Não informado")}</p><p>${escapeHtml(ticket.description)}</p>`
      : `<h2>Chamado atualizado</h2><p><strong>${escapeHtml(ticket.title)}</strong></p><p><strong>Novo status:</strong> ${escapeHtml(ticket.status)}</p><p>O chamado foi atualizado no RS CONECT.</p>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: recipients.map((recipient) => recipient.email), subject, html }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("Email provider error", details);
      return json({ error: "Não foi possível enviar a notificação." }, 502);
    }

    return json({ ok: true, sent: recipients.length });
  } catch (error) {
    console.error(error);
    return json({ error: "Erro interno ao enviar notificação." }, 500);
  }
});

function createServiceClient(url: string, key: string) {
  return {
    from(table: string) {
      return new Proxy({ table }, {
        get(_target, property: string) {
          if (property === "select") return (columns: string) => query(url, key, table, columns);
          return undefined;
        },
      });
    },
  } as any;
}

async function query(url: string, key: string, table: string, columns: string) {
  const filters: { column: string; value: string }[] = [];
  return {
    eq(column: string, value: string) {
      filters.push({ column, value });
      return this;
    },
    in(column: string, values: string[]) {
      return fetchRows(url, key, table, columns, [...filters, { column, value: values.join(",") }], true);
    },
    maybeSingle() { return fetchRows(url, key, table, columns, filters, false); },
  };
}

async function fetchRows(url: string, key: string, table: string, columns: string, filters: { column: string; value: string }[], inMode = false) {
  const params = new URLSearchParams({ select: columns });
  for (const filter of filters) params.set(inMode ? `${filter.column}` : filter.column, inMode ? `in.(${filter.value})` : `eq.${filter.value}`);
  const response = await fetch(`${url}/rest/v1/${table}?${params.toString()}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const data = await response.json();
  return { data: Array.isArray(data) ? data[0] ?? null : data };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] ?? char));
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
