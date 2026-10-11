import "server-only";
import { prisma } from "./db";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmail } from "./email";
import { buildIcs } from "./ics";
import { googleCalendarUrl } from "./meetings";
import { APP_TIMEZONE, formatDateTimeTz } from "./timezone";

const tzLabel = APP_TIMEZONE === "America/Guayaquil" ? "hora de Ecuador" : APP_TIMEZONE;

/** Quién recibe la invitación: los invitados, el anfitrión (y sus correos adicionales) y quien la organizó. */
export function inviteRecipients(a: {
  guests: string[];
  assignee: { email: string; extraEmails: string[] } | null;
  author: { email: string } | null;
}) {
  return [...new Set([...a.guests, a.assignee?.email, ...(a.assignee?.extraEmails ?? []), a.author?.email].filter((e): e is string => !!e).map((e) => e.toLowerCase()))];
}

/**
 * Envía por correo la invitación (o la cancelación) de una reunión, con el archivo .ics para que
 * se agregue sola al calendario. Devuelve a cuántos se envió; si el correo no está configurado, no hace nada.
 */
export async function sendMeetingInvite(activityId: string, method: "REQUEST" | "CANCEL" = "REQUEST") {
  if (!emailConfigured()) return { sent: 0, skipped: true as const };
  const a = await prisma.activity.findUniqueOrThrow({
    where: { id: activityId },
    include: {
      assignee: { select: { name: true, email: true, extraEmails: true } },
      author: { select: { name: true, email: true } },
    },
  });
  if (!a.startAt) return { sent: 0 };
  const to = inviteRecipients(a);
  if (to.length === 0) return { sent: 0 };
  const organizer = a.author ?? a.assignee ?? { name: "e-grow", email: to[0]! };
  const duration = a.durationMinutes ?? 30;
  const isZoom = !!a.zoomMeetingId;
  const where = a.location ? `Presencial: ${a.location}` : a.meetingUrl ? `${isZoom ? "Zoom" : "En línea"}: ${a.meetingUrl}` : null;
  const description = [
    a.body,
    a.meetingUrl ? `Unirse: ${a.meetingUrl}` : null,
    a.meetingPassword ? `Código de acceso: ${a.meetingPassword}` : null,
    a.location ? `Lugar: ${a.location}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  const ics = buildIcs({
    uid: `${a.id}@egrow-crm`,
    sequence: method === "CANCEL" ? 1 : 0,
    start: a.startAt,
    durationMinutes: duration,
    summary: a.subject,
    description,
    location: a.location ?? a.meetingUrl,
    url: a.meetingUrl,
    organizer: { name: organizer.name, email: organizer.email },
    attendees: to,
    method,
  });

  const cancel = method === "CANCEL";
  const rows = [
    ["Fecha", `${formatDateTimeTz(a.startAt)} (${tzLabel})`],
    ["Duración", `${duration} min`],
    ["Modalidad", a.location ? "Presencial" : isZoom ? "Zoom" : a.meetingUrl ? "En línea" : "Por confirmar"],
    a.location ? ["Lugar", a.location] : null,
    a.meetingPassword ? ["Código de acceso", a.meetingPassword] : null,
    a.assignee ? ["Anfitrión", a.assignee.name] : null,
    ["Invitados", to.join(", ")],
  ].filter((r): r is string[] => !!r);
  const html = emailLayout(
    cancel ? `Reunión cancelada: ${a.subject}` : a.subject,
    `<p>${
      cancel
        ? `${escapeHtml(organizer.name)} canceló esta reunión.`
        : `${escapeHtml(organizer.name)} te invita a una reunión${isZoom ? " por Zoom" : a.location ? " presencial" : ""}.`
    }</p>
     <table cellpadding="6" style="border-collapse:collapse;font-size:14px;margin:12px 0">
       ${rows.map(([k, v]) => `<tr><td style="color:#64748b;vertical-align:top">${k}</td><td><b>${escapeHtml(v!)}</b></td></tr>`).join("")}
     </table>
     ${a.body && !cancel ? `<p style="white-space:pre-line">${escapeHtml(a.body)}</p>` : ""}
     ${
       cancel
         ? ""
         : `<p>${a.meetingUrl ? emailButton(a.meetingUrl, isZoom ? "Unirse por Zoom" : "Unirse a la reunión") : ""}
            &nbsp; <a href="${googleCalendarUrl({ ...a, startAt: a.startAt })}" style="color:#1c315e">Agregar a Google Calendar</a></p>
            <p style="color:#64748b;font-size:12px">La invitación adjunta (.ics) agrega la reunión a Outlook, Gmail o el calendario del teléfono.</p>`
     }`,
  );
  await sendEmail({
    to,
    replyTo: organizer.email,
    subject: `${cancel ? "Cancelada: " : "Invitación: "}${a.subject} · ${formatDateTimeTz(a.startAt)}`,
    html,
    attachments: [{ filename: cancel ? "cancelacion.ics" : "invitacion.ics", content: Buffer.from(ics), contentType: `text/calendar; charset=utf-8; method=${method}` }],
  });
  if (!cancel) await prisma.activity.update({ where: { id: a.id }, data: { invitedAt: new Date() } });
  return { sent: to.length, where };
}
