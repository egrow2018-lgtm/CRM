/**
 * Envío de correos con Resend (https://resend.com). Solo desde el servidor.
 * Variables: RESEND_API_KEY y EMAIL_FROM (ej. "e-grow CRM <crm@e-growonline.com>").
 * Si no están configuradas, los correos no se envían y el CRM sigue funcionando.
 */
import { textOn } from "./brand";

const API = () => process.env.RESEND_API_BASE || "https://api.resend.com";

export function emailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** URL pública del CRM para los enlaces de los correos. */
export function appUrl() {
  const url = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}

export type EmailAttachment = { filename: string; content: Buffer; contentType?: string };

export async function sendEmail(msg: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  cc?: string[];
  attachments?: EmailAttachment[];
  /** Remitente (por defecto EMAIL_FROM). Debe ser del dominio verificado en Resend. */
  from?: string;
}) {
  if (!emailConfigured()) return { skipped: true as const };
  const res = await fetch(`${API()}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: msg.from ?? process.env.EMAIL_FROM,
      to: Array.isArray(msg.to) ? msg.to : [msg.to],
      cc: msg.cc?.length ? msg.cc : undefined,
      subject: msg.subject,
      html: msg.html,
      reply_to: msg.replyTo,
      attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64"), ...(a.contentType ? { content_type: a.contentType } : {}) })),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`No se pudo enviar el correo (${res.status}). ${detail.slice(0, 200)}`);
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { skipped: false as const, id: data.id };
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Marca del encabezado del correo (por defecto e-grow CRM; las cotizaciones usan la de su línea). */
export type EmailBrand = {
  name: string;
  primary: string;
  accent: string;
  /** Logo en el encabezado (URL pública; los clientes de correo no muestran imágenes incrustadas como data URL) */
  logoUrl?: string | null;
  /** Texto del pie (por defecto "<marca> · una marca de e-grow") */
  footer?: string;
};

/** Marca e-grow para correos a clientes (logo en lugar del texto «e-grow CRM»). */
export function egrowBrand(): EmailBrand {
  return { name: "e-grow", primary: "#1c315e", accent: "#b9d43a", logoUrl: `${appUrl()}/egrow-logo.png`, footer: "e-grow · e-growonline.com" };
}

/** Plantilla de correo con los colores de e-grow. `body` es HTML ya escapado. */
export function emailLayout(title: string, body: string, brand?: EmailBrand) {
  const primary = brand?.primary ?? "#1c315e";
  const accent = brand?.accent ?? "#b9d43a";
  // Con logo: encabezado blanco con el logo; sin logo: barra de color con el nombre.
  // Los avisos internos (sin marca) llevan el logo de e-grow con la etiqueta «CRM».
  const logo = brand ? brand.logoUrl : egrowBrand().logoUrl;
  const crmTag = brand
    ? ""
    : `<td style="padding-left:10px;vertical-align:middle"><span style="background:#b9d43a;color:#1c315e;border-radius:4px;padding:2px 7px;font-size:12px;font-weight:bold">CRM</span></td>`;
  const headerRow = logo
    ? `<tr><td style="background:#ffffff;padding:18px 24px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle"><img src="${escapeHtml(logo)}" alt="${escapeHtml(brand?.name ?? "e-grow")}" height="44" style="height:44px;width:auto;max-width:260px;border:0;display:block" /></td>${crmTag}</tr></table></td></tr>`
    : `<tr><td style="background:${primary};padding:16px 24px;color:${textOn(primary)};font-size:18px;font-weight:bold">${escapeHtml(brand!.name)}</td></tr>`;
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden">
${headerRow}
<tr><td style="height:4px;background:${accent}"></td></tr>
<tr><td style="padding:24px">
${title ? `<h1 style="margin:0 0 16px;font-size:20px;color:${primary}">${escapeHtml(title)}</h1>` : ""}
${body}
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">${
    brand ? escapeHtml(brand.footer ?? `${brand.name} · una marca de e-grow`) : `Enviado por el CRM de e-grow · <a href="${appUrl()}" style="color:#1c315e">${appUrl().replace(/^https?:\/\//, "")}</a>`
  }</td></tr>
</table></td></tr></table></body></html>`;
}

/** Botón para correos. */
export function emailButton(href: string, label: string, color = "#1c315e") {
  return `<a href="${href}" style="display:inline-block;background:${color};color:${textOn(color)};text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:bold;font-size:14px">${escapeHtml(label)}</a>`;
}

/** Último estado del correo en Resend (delivered, bounced, complained, delivery_delayed…), o null si no se pudo consultar. */
export async function deliveryStatus(providerId: string) {
  if (!emailConfigured()) return null;
  try {
    const res = await fetch(`${API()}/emails/${encodeURIComponent(providerId)}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { last_event?: string };
    return data.last_event ?? null;
  } catch {
    return null;
  }
}

/** Cómo se muestra cada estado de entrega de Resend. */
export const DELIVERY_LABELS: Record<string, { label: string; className: string; help?: string }> = {
  queued: { label: "En cola", className: "bg-slate-100 text-slate-600" },
  scheduled: { label: "Programado", className: "bg-slate-100 text-slate-600" },
  sent: { label: "Enviado al servidor del cliente", className: "bg-slate-100 text-slate-600", help: "Aún no confirma la entrega; puede tardar unos minutos." },
  delivered: { label: "Entregado", className: "bg-emerald-50 text-emerald-700", help: "Llegó al servidor del cliente. Si no lo ve, que revise la carpeta de spam o correo no deseado." },
  delivery_delayed: { label: "Entrega demorada", className: "bg-amber-50 text-amber-800", help: "El servidor del cliente lo está retrasando; se reintenta solo." },
  bounced: { label: "Rebotado", className: "bg-red-50 text-red-700", help: "El correo no existe o el servidor del cliente lo rechazó. Revisa la dirección." },
  complained: { label: "Marcado como spam", className: "bg-red-50 text-red-700", help: "El cliente lo marcó como correo no deseado." },
  failed: { label: "Falló el envío", className: "bg-red-50 text-red-700" },
  opened: { label: "Entregado", className: "bg-emerald-50 text-emerald-700" },
  clicked: { label: "Entregado", className: "bg-emerald-50 text-emerald-700" },
};
