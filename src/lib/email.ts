/**
 * Envío de correos con Resend (https://resend.com). Solo desde el servidor.
 * Variables: RESEND_API_KEY y EMAIL_FROM (ej. "e-grow CRM <crm@e-growonline.com>").
 * Si no están configuradas, los correos no se envían y el CRM sigue funcionando.
 */
const API = () => process.env.RESEND_API_BASE || "https://api.resend.com";

export function emailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** URL pública del CRM para los enlaces de los correos. */
export function appUrl() {
  const url = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}

export type EmailAttachment = { filename: string; content: Buffer };

export async function sendEmail(msg: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  cc?: string[];
  attachments?: EmailAttachment[];
}) {
  if (!emailConfigured()) return { skipped: true as const };
  const res = await fetch(`${API()}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: Array.isArray(msg.to) ? msg.to : [msg.to],
      cc: msg.cc?.length ? msg.cc : undefined,
      subject: msg.subject,
      html: msg.html,
      reply_to: msg.replyTo,
      attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`No se pudo enviar el correo (${res.status}). ${detail.slice(0, 200)}`);
  }
  return { skipped: false as const };
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Plantilla de correo con los colores de e-grow. `body` es HTML ya escapado. */
export function emailLayout(title: string, body: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:#1c315e;padding:16px 24px;color:#ffffff;font-size:18px;font-weight:bold">e-grow <span style="background:#b9d43a;color:#1c315e;border-radius:4px;padding:1px 6px;font-size:12px">CRM</span></td></tr>
<tr><td style="height:4px;background:#b9d43a"></td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 16px;font-size:20px;color:#1c315e">${escapeHtml(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">Enviado por el CRM de e-grow · <a href="${appUrl()}" style="color:#1c315e">${appUrl().replace(/^https?:\/\//, "")}</a></td></tr>
</table></td></tr></table></body></html>`;
}

/** Botón para correos. */
export function emailButton(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#1c315e;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:bold;font-size:14px">${escapeHtml(label)}</a>`;
}
