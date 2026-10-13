/**
 * Redacción de correos a clientes: variables de plantilla, formato sencillo y enlaces rastreados.
 *
 * El texto se escribe como en un correo normal:
 *   - **texto** → negrita
 *   - {{nombre}}, {{empresa}}… → datos del contacto (ver TEMPLATE_VARIABLES)
 *   - [[doc:ID]] → enlace al documento (nombre en negrita), rastreado por destinatario
 *   - [[img:ID]] o [[img:ID|https://…]] → imagen (con enlace opcional)
 *   - [texto](https://…) → texto con enlace
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
  /** URL pública y nombre de cada imagen citada (null = ya no existe) */
  image?: (id: string) => { src: string; name: string } | null;
  /** Para rastrear clics: recibe la URL original y devuelve la que va en el correo */
  wrapLink?: (url: string) => string;
  linkColor?: string;
};

const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g;

const TOKEN_SPLIT = /(\[\[(?:doc|img):[a-z0-9]+(?:\|[^\]\s]*)?\]\])/i;
const MD_LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

function inline(line: string, opts: RenderOptions) {
  const color = opts.linkColor ?? "#1c315e";
  const href = (raw: string) => escapeHtml(opts.wrapLink ? opts.wrapLink(raw) : raw);
  const format = (t: string) => escapeHtml(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  // Se separan los tokens de documento e imagen para no escaparlos ni tomarlos como URL
  return line
    .split(TOKEN_SPLIT)
    .map((part) => {
      const doc = /^\[\[doc:([a-z0-9]+)\]\]$/i.exec(part);
      if (doc) {
        const d = opts.doc(doc[1]);
        if (!d) return "";
        return `<a href="${escapeHtml(d.href)}" style="color:${color};font-weight:bold;text-decoration:underline">📄 <b>${escapeHtml(d.name)}</b></a>`;
      }
      const img = /^\[\[img:([a-z0-9]+)(?:\|(https?:\/\/[^\]\s]+))?\]\]$/i.exec(part);
      if (img) {
        const i = opts.image?.(img[1]);
        if (!i) return "";
        const tag = `<img src="${escapeHtml(i.src)}" alt="${escapeHtml(i.name)}" style="display:block;max-width:100%;height:auto;border:0;margin:8px 0" />`;
        return img[2] ? `<a href="${href(img[2])}">${tag}</a>` : tag;
      }
      // [texto](url): se guardan aparte para que la URL no se convierta dos veces en enlace
      const links: { label: string; url: string }[] = [];
      const marked = part.replace(MD_LINK, (_, label: string, url: string) => {
        links.push({ label, url });
        return `\u0000${links.length - 1}\u0000`;
      });
      let html = format(marked);
      html = html.replace(URL_RE, (url) => `<a href="${href(url.replace(/&amp;/g, "&"))}" style="color:${color}">${url}</a>`);
      return html.replace(/\u0000(\d+)\u0000/g, (_, n: string) => {
        const l = links[Number(n)]!;
        return `<a href="${href(l.url)}" style="color:${color};text-decoration:underline">${format(l.label)}</a>`;
      });
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
export function signatureHtml(
  user: { name: string; signature?: string | null },
  email: string,
  /** Imagen de firma (como la de Outlook): URL pública y ancho en px */
  image?: { src: string; width: number } | null,
) {
  const lines = (t: string) => t.split("\n").map(escapeHtml);
  if (image) {
    // Con imagen: la imagen es la firma; el texto (si hay) va debajo en letra pequeña, como un aviso legal
    const w = Math.round(Math.min(Math.max(image.width, 120), 700));
    const img = `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(user.name)}" width="${w}" style="display:block;width:${w}px;max-width:100%;height:auto;border:0" />`;
    const text = user.signature?.trim();
    return text ? `${img}<div style="margin-top:8px;font-size:10px;line-height:1.4;color:#64748b">${lines(text).join("<br>")}</div>` : img;
  }
  const text = user.signature?.trim() || `${user.name}\n${email}`;
  return lines(text)
    .map((l, i) => (i === 0 ? `<b>${l}</b>` : l))
    .join("<br>");
}

/** Ancho de la imagen de firma: el elegido o, en automático, su ancho natural hasta 560 px (el ancho del correo). */
export function signatureWidth(chosen: number | null | undefined, natural: number | null | undefined) {
  if (chosen && chosen > 0) return chosen;
  return Math.min(natural ?? 500, 560);
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
    .replace(/\[\[img:[a-z0-9]+(?:\|[^\]\s]*)?\]\]/gi, "")
    .replace(MD_LINK, "$1 ($2)")
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

/* …y las imágenes como [🖼 Nombre] o [🖼 Nombre → https://enlace] */
const IMG_TOKEN = /\[\[img:([a-z0-9]+)(?:\|(https?:\/\/[^\]\s]+))?\]\]/gi;
const EDITABLE_IMG = /\[🖼 ([^\]\n→]+?)(?:\s*→\s*(https?:\/\/[^\]\s]+))?\]/g;
const cleanName = (n: string) => n.replace(/[\]\n→]/g, " ").trim();

export function editableImageToken(name: string, url?: string | null) {
  return `[🖼 ${cleanName(name)}${url ? ` → ${url}` : ""}]`;
}

/** [[doc:ID]] → [📄 Nombre] y [[img:ID|url]] → [🖼 Nombre → url] (los que ya no existen se quitan). */
export function toEditable(text: string, docs: DocRef[], images: DocRef[] = []) {
  return text
    .replace(DOC_TOKEN, (_, id: string) => {
      const d = docs.find((x) => x.id === id);
      return d ? editableDocToken(d.name) : "";
    })
    .replace(IMG_TOKEN, (_, id: string, url?: string) => {
      const i = images.find((x) => x.id === id);
      return i ? editableImageToken(i.name, url) : "";
    });
}

/** [📄 Nombre] → [[doc:ID]] y [🖼 Nombre → url] → [[img:ID|url]] (si el nombre no coincide, se deja como texto). */
export function fromEditable(text: string, docs: DocRef[], images: DocRef[] = []) {
  return text
    .replace(EDITABLE_DOC, (whole, name: string) => {
      const d = docs.find((x) => x.name.replace(/[\]\n]/g, " ").trim() === name.trim());
      return d ? `[[doc:${d.id}]]` : whole;
    })
    .replace(EDITABLE_IMG, (whole, name: string, url?: string) => {
      const i = images.find((x) => cleanName(x.name) === name.trim());
      return i ? `[[img:${i.id}${url ? `|${url}` : ""}]]` : whole;
    });
}

/** IDs de las imágenes citadas en el texto. */
export function imageIdsIn(text: string) {
  return [...new Set([...text.matchAll(IMG_TOKEN)].map((m) => m[1]))];
}
