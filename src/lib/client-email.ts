import "server-only";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { appUrl, egrowBrand, emailButton, emailLayout, escapeHtml, sendEmail, type EmailAttachment, type EmailBrand } from "./email";
import { docIdsIn, imageIdsIn, isEmail, openPixel, personalLayout, plainText, renderBody, senderFor, signatureHtml } from "./email-compose";
import { randomToken } from "./doc-stats";
import { quoteCode } from "./quotes";
import { contactName } from "./format";

/**
 * Envía un correo a un cliente desde el CRM, a nombre del vendedor:
 * - cada documento citado lleva su propio enlace rastreado (por contacto),
 * - los enlaces web pasan por el CRM para contar los clics,
 * - un píxel cuenta las aperturas,
 * - el vendedor recibe una copia limpia (sin píxel) para tenerla en su Outlook,
 * - queda en el historial del contacto, la empresa y el negocio.
 */
export async function sendClientEmail(p: {
  user: User;
  to: string[];
  cc?: string[];
  subject: string;
  /** Texto ya con las variables reemplazadas */
  body: string;
  contactId?: string | null;
  dealId?: string | null;
  companyId?: string | null;
  templateId?: string | null;
  /** Encabezado con marca (e-grow o la de la línea); sin marca = correo personal */
  brand?: EmailBrand | "egrow" | null;
  quote?: { id: string; code: string; total: string };
  attachments?: EmailAttachment[];
  activitySubject?: string;
}) {
  const to = p.to.map((e) => e.trim()).filter(Boolean);
  const cc = (p.cc ?? []).map((e) => e.trim()).filter(Boolean);
  if (!to.length) throw new Error("Escribe al menos un destinatario.");
  if ([...to, ...cc].some((e) => !isEmail(e))) throw new Error("Revisa los correos: hay una dirección que no es válida.");
  if (!p.subject.trim()) throw new Error("Escribe el asunto.");
  if (!p.body.trim() && !p.quote) throw new Error("El correo está vacío.");

  const sender = senderFor(p.user, process.env.EMAIL_FROM ?? "");
  const app = appUrl();
  const docs = await prisma.document.findMany({ where: { id: { in: docIdsIn(p.body) } }, select: { id: true, name: true } });
  const images = await prisma.emailImage.findMany({ where: { id: { in: imageIdsIn(p.body) } }, select: { id: true, name: true } });
  const brand: EmailBrand | null = p.brand === "egrow" ? egrowBrand() : (p.brand ?? null);

  const message = await prisma.emailMessage.create({
    data: {
      token: randomToken(),
      fromUserId: p.user.id,
      fromEmail: sender.address,
      to,
      cc,
      subject: p.subject.trim(),
      body: p.body,
      html: "",
      contactId: p.contactId ?? null,
      dealId: p.dealId ?? null,
      companyId: p.companyId ?? null,
      quoteId: p.quote?.id ?? null,
      templateId: p.templateId ?? null,
    },
  });

  try {
    // Un enlace rastreado por documento (y por la cotización) para este destinatario
    const linkFor = new Map<string, string>();
    for (const d of docs) {
      const link = await prisma.documentLink.create({
        data: { token: randomToken(), documentId: d.id, contactId: p.contactId ?? null, emailId: message.id, createdById: p.user.id },
      });
      linkFor.set(d.id, link.token);
    }
    const quoteLink = p.quote
      ? await prisma.documentLink.create({
          data: { token: randomToken(), quoteId: p.quote.id, contactId: p.contactId ?? null, emailId: message.id, createdById: p.user.id },
        })
      : null;

    const links: string[] = [];
    const color = brand?.primary ?? "#1c315e";
    const build = (forClient: boolean) => {
      const body = renderBody(p.body, {
        linkColor: color,
        doc: (id) => {
          const d = docs.find((x) => x.id === id);
          if (!d) return null;
          return { name: d.name, href: forClient ? `${app}/d/${linkFor.get(id)}` : `${app}/documentos/${id}` };
        },
        image: (id) => {
          const i = images.find((x) => x.id === id);
          return i ? { src: `${app}/api/img/${i.id}`, name: i.name } : null;
        },
        wrapLink: forClient
          ? (url) => {
              links.push(url);
              return `${app}/api/t/c/${message.token}/${links.length - 1}`;
            }
          : undefined,
      });
      const quoteBlock = p.quote
        ? `<p>Adjuntamos la cotización <b>${escapeHtml(p.quote.code)}</b> por <b>US$ ${escapeHtml(p.quote.total)}</b>.</p>
           <p>${emailButton(forClient ? `${app}/d/${quoteLink!.token}` : `${app}${p.dealId ? `/negocios/${p.dealId}` : "/cotizaciones"}`, "Ver cotización en línea", color)}</p>`
        : "";
      const signature = signatureHtml(p.user, sender.replyTo);
      const pixel = forClient ? openPixel(`${app}/api/t/o/${message.token}`) : "";
      const note = forClient
        ? ""
        : `<div style="font-family:Arial,sans-serif;font-size:12px;color:#64748b;background:#f1f5f9;padding:8px 12px;margin-bottom:12px;border-radius:6px">Copia de tu correo enviado desde el CRM a ${escapeHtml(to.join(", "))}. Los enlaces de esta copia no cuentan como vistas del cliente.</div>`;
      if (brand) {
        const html = emailLayout("", `${note}${body}${quoteBlock}<p style="color:#475569;margin-top:18px">${signature}</p>`, brand);
        return html.replace("</body>", `${pixel}</body>`);
      }
      return personalLayout(`${note}${body}${quoteBlock}`, signature, pixel);
    };

    const clientHtml = build(true);
    const copyHtml = build(false);
    const sent = await sendEmail({ from: sender.from, replyTo: sender.replyTo, to, cc, subject: p.subject.trim(), html: clientHtml, attachments: p.attachments });
    // Copia para el vendedor (si falla, el correo al cliente ya salió)
    await sendEmail({ from: sender.from, to: sender.replyTo, subject: p.subject.trim(), html: copyHtml, attachments: p.attachments }).catch((e) =>
      console.error("No se pudo enviar la copia al vendedor", e),
    );

    const now = new Date();
    const text = plainText(p.body, (id) => docs.find((d) => d.id === id)?.name ?? null);
    await prisma.$transaction([
      prisma.emailMessage.update({
        where: { id: message.id },
        data: { html: copyHtml, links, sentAt: now, providerId: sent.skipped ? null : (sent.id ?? null) },
      }),
      prisma.activity.create({
        data: {
          type: "EMAIL",
          subject: p.activitySubject ?? `Correo: ${p.subject.trim()}`,
          body: text.length > 1500 ? `${text.slice(0, 1500)}…` : text || null,
          contactId: p.contactId ?? null,
          dealId: p.dealId ?? null,
          companyId: p.dealId || p.contactId ? null : (p.companyId ?? null),
          authorId: p.user.id,
          emailId: message.id,
          completed: true,
          completedAt: now,
        },
      }),
      ...(p.contactId ? [prisma.contact.update({ where: { id: p.contactId }, data: { lastActivityAt: now } })] : []),
      ...(p.dealId ? [prisma.deal.update({ where: { id: p.dealId }, data: { lastActivityAt: now } })] : []),
      ...(p.companyId ? [prisma.company.update({ where: { id: p.companyId }, data: { lastActivityAt: now } })] : []),
    ]);
    return message.id;
  } catch (e) {
    await prisma.emailMessage.delete({ where: { id: message.id } }).catch(() => {});
    throw e;
  }
}

/* ───────────── Seguimiento ───────────── */

const ALERT_EVERY_MS = 60 * 60 * 1000; // como máximo un aviso por hora por correo o enlace

/** Apertura del correo (píxel). Se ignoran las de los primeros segundos (escáneres de antivirus). */
export async function recordOpen(token: string, userAgent: string | null) {
  const msg = await prisma.emailMessage.findUnique({ where: { token }, include: { fromUser: true, contact: true } });
  if (!msg || Date.now() - msg.sentAt.getTime() < 5000) return;
  const now = new Date();
  const notify = msg.fromUser?.trackingAlerts && msg.fromUser.active && (!msg.lastNotifiedAt || now.getTime() - msg.lastNotifiedAt.getTime() > ALERT_EVERY_MS);
  const updated = await prisma.emailMessage.update({
    where: { id: msg.id },
    data: {
      openCount: { increment: 1 },
      firstOpenedAt: msg.firstOpenedAt ?? now,
      lastOpenedAt: now,
      ...(notify ? { lastNotifiedAt: now } : {}),
      events: { create: { type: "open", userAgent: userAgent?.slice(0, 300) } },
    },
  });
  if (notify && msg.fromUser) {
    const who = msg.contact ? contactName(msg.contact) : msg.to.join(", ");
    await sendEmail({
      to: msg.fromUser.email,
      subject: `👀 ${who} abrió tu correo «${msg.subject}»`,
      html: emailLayout(
        "Abrieron tu correo",
        `<p><b>${escapeHtml(who)}</b> abrió tu correo <b>«${escapeHtml(msg.subject)}»</b>${updated.openCount > 1 ? ` (lo ha abierto ${updated.openCount} veces)` : ""}.</p>
         <p>Es un buen momento para dar seguimiento.</p>
         <p>${emailButton(`${appUrl()}/correos/${msg.id}`, "Ver en el CRM")}</p>
         <p style="color:#94a3b8;font-size:12px">Puedes desactivar estos avisos en «Mi perfil».</p>`,
      ),
    }).catch((e) => console.error("Aviso de apertura", e));
  }
}

/** Clic en un enlace del correo: lo registra y devuelve el destino. */
export async function recordClick(token: string, index: number, userAgent: string | null) {
  const msg = await prisma.emailMessage.findUnique({ where: { token }, select: { id: true, links: true, firstOpenedAt: true } });
  const url = msg?.links[index];
  if (!msg || !url) return null;
  const now = new Date();
  await prisma.emailMessage.update({
    where: { id: msg.id },
    data: {
      clickCount: { increment: 1 },
      lastClickedAt: now,
      // Si hizo clic, abrió el correo aunque su programa haya bloqueado el píxel
      ...(msg.firstOpenedAt ? {} : { firstOpenedAt: now, lastOpenedAt: now, openCount: { increment: 1 } }),
      events: { create: { type: "click", url, userAgent: userAgent?.slice(0, 300) } },
    },
  });
  return url;
}

/** Aviso al dueño del enlace cuando alguien abre un documento o una cotización. */
export async function notifyDocumentView(linkId: string, viewerEmail: string | null) {
  const link = await prisma.documentLink.findUnique({
    where: { id: linkId },
    include: {
      createdBy: true,
      contact: { include: { company: true } },
      document: { select: { id: true, name: true, owner: true } },
      quote: { select: { id: true, year: true, number: true, dealId: true } },
      email: { select: { to: true } },
      _count: { select: { views: true } },
    },
  });
  if (!link) return;
  const recipient = link.createdBy ?? link.document?.owner;
  if (!recipient?.active || !recipient.trackingAlerts) return;
  const now = new Date();
  if (link.lastNotifiedAt && now.getTime() - link.lastNotifiedAt.getTime() < ALERT_EVERY_MS) return;
  await prisma.documentLink.update({ where: { id: link.id }, data: { lastNotifiedAt: now } });

  const who = link.contact
    ? `${contactName(link.contact)}${link.contact.company ? ` (${link.contact.company.name})` : ""}`
    : (viewerEmail ?? link.email?.to.join(", ") ?? (link.label ? `Alguien con el enlace «${link.label}»` : "Alguien"));
  const what = link.document ? link.document.name : `la cotización ${quoteCode(link.quote!.year, link.quote!.number)}`;
  const href = link.document ? `/documentos/${link.document.id}` : `/negocios/${link.quote!.dealId}`;
  const previous = link._count.views - 1;
  await sendEmail({
    to: recipient.email,
    subject: `📄 ${who} está viendo ${link.document ? `«${what}»` : what}`,
    html: emailLayout(
      "Están viendo tu documento",
      `<p><b>${escapeHtml(who)}</b> abrió <b>${escapeHtml(what)}</b> ahora mismo${previous > 0 ? ` (ya lo había visto ${previous} ${previous === 1 ? "vez" : "veces"})` : ""}.</p>
       <p>En el CRM verás cuánto tiempo pasó en cada página.</p>
       <p>${emailButton(`${appUrl()}${href}`, "Ver en el CRM")}</p>
       <p style="color:#94a3b8;font-size:12px">Puedes desactivar estos avisos en «Mi perfil».</p>`,
    ),
  }).catch((e) => console.error("Aviso de documento", e));
}
