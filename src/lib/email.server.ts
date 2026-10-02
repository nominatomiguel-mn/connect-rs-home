/**
 * Envio de e-mails do app (notificações de chamados).
 * Requer o domínio de e-mail configurado no Lovable Cloud
 * (segredos RESEND_API_KEY e EMAIL_FROM_ADDRESS). Enquanto não
 * estiver configurado, o envio é ignorado com registro no log.
 */

export type AppEmail = { to: string; subject: string; html: string };

export async function sendEmail(email: AppEmail): Promise<boolean> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM_ADDRESS"];
  if (!apiKey || !from) {
    console.info(
      `[email] Envio ignorado (domínio de e-mail não configurado): "${email.subject}" → ${email.to}`,
    );
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
      }),
    });
    if (!res.ok) {
      console.error(`[email] Falha no envio [${res.status}]: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Erro ao enviar:", err);
    return false;
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f7f7f2;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;border:1px solid #e2e8f0;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <span style="font-size:20px;">☀️</span>
        <strong style="font-size:16px;color:#1d4ed8;">RS CONECT — Colégio Raios de Sol</strong>
      </div>
      <h1 style="font-size:18px;margin:0 0 12px;">${escapeHtml(title)}</h1>
      <div style="font-size:14px;line-height:1.6;">${bodyHtml}</div>
      <p style="font-size:12px;color:#64748b;margin-top:24px;">
        Mensagem automática do RS CONECT. Não responda este e-mail.
      </p>
    </div>
  </body>
</html>`;
}
