import "server-only";
import type { Form, User } from "@prisma/client";
import { prisma } from "./db";
import { can } from "./permissions";
import { PENDING } from "./queries";
import { appUrl, emailButton, emailConfigured, emailLayout, escapeHtml, sendEmail } from "./email";
import { dealAlerts, renewalAlert } from "./alerts";
import { parseCustomData } from "./custom-fields";
import { contactName, formatDate } from "./format";
import { formatTimeTz, utcToZoned } from "./timezone";
import { createRenewalDeal } from "./renewals";

const DOT: Record<string, string> = { rojo: "#dc2626", amarillo: "#f59e0b", verde: "#16a34a" };
const dot = (level: string) =>
  `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${DOT[level]};margin-right:6px"></span>`;
const link = (path: string, text: string) => `<a href="${appUrl()}${path}" style="color:#1c315e;font-weight:bold">${escapeHtml(text)}</a>`;
const section = (title: string, items: string[]) =>
  items.length
    ? `<h2 style="font-size:15px;color:#1c315e;margin:20px 0 8px;border-bottom:2px solid #b9d43a;padding-bottom:4px">${title}</h2><ul style="padding-left:18px;margin:0">${items
        .map((i) => `<li style="margin-bottom:6px">${i}</li>`)
        .join("")}</ul>`
    : "";

/** Aviso inmediato cuando alguien llena un formulario. */
export async function notifyNewLead(form: Form, contactId: string, answers: Record<string, string>, labels: Record<string, string>) {
  if (!emailConfigured()) return;
  const recipients = form.assigneeId
    ? await prisma.user.findMany({ where: { id: form.assigneeId, active: true } })
    : (await prisma.user.findMany({ where: { active: true } })).filter((u) => can(u.role, "leads:take"));
  if (recipients.length === 0) return;
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, include: { company: true } });
  if (!contact) return;
  const rows = Object.entries(answers)
    .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#64748b;vertical-align:top">${escapeHtml(labels[k] ?? k)}</td><td style="padding:4px 8px">${escapeHtml(v)}</td></tr>`)
    .join("");
  await sendEmail({
    to: recipients.map((u) => u.email),
    subject: `Nuevo lead: ${contactName(contact)}${contact.company ? ` (${contact.company.name})` : ""} – ${form.name}`,
    html: emailLayout(
      "Llegó un nuevo lead",
      `<p>${dot("amarillo")}<b>${escapeHtml(contactName(contact))}</b> llenó el formulario <b>${escapeHtml(form.name)}</b>.</p>
       <table style="border-collapse:collapse;font-size:14px;margin:8px 0 16px">${rows}</table>
       <p>${form.assigneeId ? "Te fue asignado: contáctalo hoy." : "Está en la bandeja de leads: el primero que lo tome le da seguimiento."}</p>
       <p>${emailButton(`${appUrl()}${form.assigneeId ? `/contactos/${contactId}` : "/leads"}`, form.assigneeId ? "Ver contacto" : "Ir a la bandeja de leads")}</p>`,
    ),
  });
}

/** Contenido del resumen diario de una persona (null si no hay nada que contar). */
export async function buildDigest(user: User) {
  const today = utcToZoned(new Date()).date;
  const dayStart = new Date(`${today}T00:00:00Z`);
  const [activities, deals, leads, renewals] = await Promise.all([
    prisma.activity.findMany({
      where: { ...PENDING, assigneeId: user.id, dueDate: { lte: dayStart } },
      include: { deal: { select: { id: true, name: true } }, contact: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ startAt: { sort: "asc", nulls: "last" } }, { dueDate: "asc" }],
      take: 30,
    }),
    prisma.deal.findMany({
      where: { ownerId: user.id, stage: { isWon: false, isLost: false } },
      select: {
        id: true, name: true, closeDate: true, customData: true,
        activities: { where: PENDING, orderBy: { dueDate: { sort: "asc", nulls: "last" } }, take: 1, select: { dueDate: true } },
      },
    }),
    can(user.role, "leads:take")
      ? prisma.contact.findMany({ where: { leadStatus: "NUEVO" }, orderBy: { createdAt: "asc" }, take: 10, include: { company: { select: { name: true } } } })
      : Promise.resolve([]),
    prisma.deal.findMany({
      where: { ownerId: user.id, stage: { isWon: true }, renewalDate: { lte: new Date(Date.now() + 30 * 86400000) } },
      select: { id: true, name: true, renewalDate: true, renewals: { select: { id: true, name: true }, take: 1 } },
      orderBy: { renewalDate: "asc" },
      take: 10,
    }),
  ]);

  const meetings = activities.filter((a) => a.type === "REUNION" && a.dueDate && a.dueDate.getTime() === dayStart.getTime());
  const others = activities.filter((a) => !meetings.includes(a));
  const related = (a: (typeof activities)[number]) =>
    a.deal ? ` · ${link(`/negocios/${a.deal.id}`, a.deal.name)}` : a.contact ? ` · ${link(`/contactos/${a.contact.id}`, contactName(a.contact))}` : "";

  const red = deals
    .map((d) => {
      const data = parseCustomData(d.customData);
      const al = dealAlerts({ open: true, closeDate: d.closeDate, next: d.activities[0] ?? null, entrega: data.fechaEntrega, avance: data.avance });
      const reasons = [al.next, al.close, al.delivery].filter((x) => x?.level === "rojo").map((x) => x!.label);
      return { d, level: al.health, reasons };
    })
    .filter((x) => x.level === "rojo");

  const items = {
    meetings: meetings.map(
      (m) =>
        `<b>${m.startAt ? formatTimeTz(m.startAt) : ""}</b> ${escapeHtml(m.subject)}${related(m)}${
          m.meetingUrl ? ` · <a href="${m.hostUrl ?? m.meetingUrl}" style="color:#1c315e">${m.zoomMeetingId ? "Iniciar Zoom" : "Unirse"}</a>` : ""
        }`,
    ),
    tasks: others.map((t) => {
      const overdue = t.dueDate! < dayStart;
      return `${dot(overdue ? "rojo" : "amarillo")}${escapeHtml(t.subject)} <span style="color:#64748b">(${overdue ? `vencida ${formatDate(t.dueDate)}` : "hoy"})</span>${related(t)}`;
    }),
    deals: red.slice(0, 8).map((x) => `${dot("rojo")}${link(`/negocios/${x.d.id}`, x.d.name)} <span style="color:#64748b">· ${escapeHtml(x.reasons.join(" · "))}</span>`),
    leads: leads.map(
      (c) => `${dot((Date.now() - c.createdAt.getTime()) / 3600000 > 24 ? "rojo" : "amarillo")}${link(`/contactos/${c.id}`, contactName(c))}${c.company ? ` · ${escapeHtml(c.company.name)}` : ""}`,
    ),
    renewals: renewals.map((r) => {
      const a = renewalAlert(r.renewalDate)!;
      return `${dot(a.level)}${link(`/negocios/${r.id}`, r.name)} <span style="color:#64748b">· ${formatDate(r.renewalDate)} · ${escapeHtml(a.label)}</span>${
        r.renewals[0] ? ` → ${link(`/negocios/${r.renewals[0].id}`, "negocio de renovación")}` : ""
      }`;
    }),
  };
  const total = Object.values(items).reduce((n, l) => n + l.length, 0);
  if (total === 0) return null;

  const html = emailLayout(
    `Buenos días, ${user.name.split(" ")[0]}`,
    `<p>Este es tu resumen de hoy en el CRM.</p>
     ${section(`🎥 Reuniones de hoy (${items.meetings.length})`, items.meetings)}
     ${section(`✔ Tareas vencidas y de hoy (${items.tasks.length})`, items.tasks)}
     ${section(`🔴 Tus negocios en rojo (${red.length})`, items.deals)}${red.length > 8 ? `<p style="color:#64748b">y ${red.length - 8} más…</p>` : ""}
     ${section(`📥 Leads sin atender (${items.leads.length})`, items.leads)}
     ${section(`↻ Renovaciones próximas (${items.renewals.length})`, items.renewals)}
     <p style="margin-top:20px">${emailButton(appUrl(), "Abrir el CRM")}</p>
     <p style="color:#94a3b8;font-size:12px">Puedes desactivar este resumen en «Mi perfil».</p>`,
  );
  return { subject: `Tu día en el CRM: ${[
    items.meetings.length && `${items.meetings.length} reunión(es)`,
    items.tasks.length && `${items.tasks.length} tarea(s)`,
    red.length && `${red.length} negocio(s) en rojo`,
    items.leads.length && `${items.leads.length} lead(s)`,
  ].filter(Boolean).join(", ") || "renovaciones próximas"}`, html };
}

/** Tarea diaria: crea los negocios de renovación que tocan y envía los resúmenes. */
export async function runDailyJobs() {
  // 1) Renovaciones a 30 días o menos sin negocio de renovación → se crea automáticamente
  const due = await prisma.deal.findMany({
    where: { stage: { isWon: true }, renewalDate: { lte: new Date(Date.now() + 30 * 86400000) }, renewals: { none: {} } },
    select: { id: true },
  });
  let renewalsCreated = 0;
  for (const d of due) {
    await prisma.$transaction((tx) => createRenewalDeal(tx, d.id, null));
    renewalsCreated++;
  }

  // 2) Resumen diario
  let sent = 0;
  if (emailConfigured()) {
    const users = await prisma.user.findMany({ where: { active: true, digestEnabled: true } });
    for (const u of users) {
      const digest = await buildDigest(u);
      if (!digest) continue;
      await sendEmail({ to: u.email, subject: digest.subject, html: digest.html });
      sent++;
    }
  }
  return { renewalsCreated, digestsSent: sent };
}
