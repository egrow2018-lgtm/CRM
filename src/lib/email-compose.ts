/**
 * Redacción de correos a clientes: variables de plantilla, formato sencillo y enlaces rastreados.
 *
 * El texto se escribe como en un correo normal:
 *   - **texto** → negrita
 *   - {{nombre}}, {{empresa}}… → datos del contacto (ver TEMPLATE_VARIABLES)
 *   - [[doc:ID]] → enlace al documento (nombre en negrita), rastreado por destinatario
 *   - las direcciones web (https://…) se vuelven enlaces
 * Se usa en el navegador (vista previa) y en el servidor (envío), así que no depende de Node.
 */

export const TEMPLATE_VARIABLES = [
  { key: "nombre", label: "Nombre del contacto" },
  { key: "apellido", label: "Apellido" },
  { key: "nombre_completo", label: "Nombre y apellido" },
  { key: "empresa", label: "Empresa" },
  { key: "cargo", label: "Cargo" },
  { key: "negocio", label: "Nombre del negocio" },
  { key: "vendedor", label: "Tu nombre" },
  { key: "mi_correo", label: "Tu correo" },
] as const;

export type TemplateValues = Partial<Record<(typeof TEMPLATE_VARIABLES)[number]["key"], string | null>>;

/** Reemplaza {{variable}}. Las que no tienen dato quedan vacías; las desconocidas se dejan tal cual. */
export function fillTemplate(text: string, values: TemplateValues) {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, key: string) => {
    const k = key.toLowerCase();
    if (!TEMPLATE_VARIABLES.some((v) => v.key === k)) return whole;
    return values[k as keyof TemplateValues] ?? "";
  });
}

export const DOC_TOKEN = /\[\[doc:([a-z0-9]+)\]\]/gi;

/** IDs de los documentos citados en el texto, sin repetir. */
export function docIdsIn(text: string) {
  return [...new Set([...text.matchAll(DOC_TOKEN)].map((m) => m[1]))];
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export type RenderOptions = {
  /** Nombre y URL de cada documento citado (null = documento que ya no existe) */
  doc: (id: string) => { name: string; href: string } | null;
  /** Para rastrear clics: recibe la URL original y devuelve la que va en el correo */
  wrapLink?: (url: string) => string;
  linkColor?: string;
};

const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g;

function inline(line: string, opts: RenderOptions) {
  const color = opts.linkColor ?? "#1c315e";
  // Se separan los tokens de documento para no escaparlos ni tomarlos como URL
  return line
    .split(/(\[\[doc:[a-z0-9]+\]\])/i)
    .map((part) => {
      const doc = /^\[\[doc:([a-z0-9]+)\]\]$/i.exec(part);
      if (doc) {
        const d = opts.doc(doc[1]);
        if (!d) return "";
        return `<a href="${escapeHtml(d.href)}" style="color:${color};font-weight:bold;text-decoration:underline">📄 <b>${escapeHtml(d.name)}</b></a>`;
      }
      let html = escapeHtml(part);
      html = html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
      html = html.replace(URL_RE, (url) => {
        const raw = url.replace(/&amp;/g, "&");
        const href = opts.wrapLink ? opts.wrapLink(raw) : raw;
        return `<a href="${escapeHtml(href)}" style="color:${color}">${url}</a>`;
      });
      return html;
    })
    .join("");
}

/** Convierte el texto del correo en HTML (párrafos, saltos de línea, negritas, enlaces y documentos). */
export function renderBody(text: string, opts: RenderOptions) {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p style="margin:0 0 12px">${p.split("\n").map((l) => inline(l, opts)).join("<br>")}</p>`)
    .join("\n");
}

/** Correo con aspecto personal (sin encabezado de marca), que es el que mejor llega a la bandeja de entrada. */
export function personalLayout(bodyHtml: string, signatureHtml: string, extra = "") {
  return `<!doctype html><html lang="es"><body style="margin:0;padding:16px;background:#ffffff">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1e293b;max-width:640px">
${bodyHtml}
${signatureHtml ? `<div style="margin-top:18px;padding-top:10px;border-top:1px solid #e2e8f0;color:#475569;font-size:13px">${signatureHtml}</div>` : ""}
</div>${extra}</body></html>`;
}

/** Firma: el texto que escribió la persona o, si no tiene, su nombre y correo. */
export function signatureHtml(user: { name: string; signature?: string | null }, email: string) {
  const text = user.signature?.trim() || `${user.name}\n${email}`;
  return text
    .split("\n")
    .map((l, i) => (i === 0 ? `<b>${escapeHtml(l)}</b>` : escapeHtml(l)))
    .join("<br>");
}

/** Píxel de apertura (imagen de 1×1 que se carga al abrir el correo). */
export function openPixel(url: string) {
  return `<img src="${escapeHtml(url)}" width="1" height="1" alt="" style="width:1px;height:1px;border:0" />`;
}

/** Texto plano de la vista previa de un correo (para el historial de actividades). */
export function plainText(text: string, docName: (id: string) => string | null) {
  return text
    .replace(DOC_TOKEN, (_, id: string) => {
      const n = docName(id);
      return n ? `📄 ${n}` : "";
    })
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .trim();
}

export function splitEmails(value: string) {
  return value
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** Dominio de una dirección (o de "Nombre <correo>"). */
export function emailDomain(address: string | null | undefined) {
  const m = /@([^\s>]+)>?\s*$/.exec(address ?? "");
  return m ? m[1].toLowerCase() : null;
}

/**
 * Remitente de un correo a clientes: el vendedor con su propia dirección si es del dominio
 * verificado en Resend; si no, la dirección del CRM con su nombre (y las respuestas le llegan a él).
 */
export function senderFor(user: { name: string; email: string; senderEmail?: string | null }, systemFrom: string) {
  const domain = emailDomain(systemFrom);
  const own = (user.senderEmail || user.email).trim();
  const name = user.name.replace(/[<>"]/g, "");
  if (domain && emailDomain(own) === domain) return { from: `${name} <${own}>`, address: own, replyTo: own };
  const systemAddress = /<([^>]+)>/.exec(systemFrom)?.[1] ?? systemFrom.trim();
  return { from: `${name} (e-grow) <${systemAddress}>`, address: systemAddress, replyTo: own };
}

/* En el editor, los documentos se ven como [📄 Nombre] en lugar de [[doc:ID]] */
type DocRef = { id: string; name: string };
const EDITABLE_DOC = /\[📄 ([^\]\n]+)\]/g;

export function editableDocToken(name: string) {
  return `[📄 ${name.replace(/[\]\n]/g, " ")}]`;
}

/** [[doc:ID]] → [📄 Nombre] (los documentos que ya no existen se quitan). */
export function toEditable(text: string, docs: DocRef[]) {
  return text.replace(DOC_TOKEN, (_, id: string) => {
    const d = docs.find((x) => x.id === id);
    return d ? editableDocToken(d.name) : "";
  });
}

/** [📄 Nombre] → [[doc:ID]] (si el nombre no coincide con ningún documento, se deja como texto). */
export function fromEditable(text: string, docs: DocRef[]) {
  return text.replace(EDITABLE_DOC, (whole, name: string) => {
    const d = docs.find((x) => x.name.replace(/[\]\n]/g, " ").trim() === name.trim());
    return d ? `[[doc:${d.id}]]` : whole;
  });
}
