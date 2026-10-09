import { APP_TIMEZONE, formatDateTimeTz } from "./timezone";

export const DURATIONS = [15, 30, 45, 60, 90, 120];

type MeetingLike = {
  subject: string;
  body?: string | null;
  startAt: Date;
  durationMinutes: number | null;
  meetingUrl: string | null;
  meetingPassword?: string | null;
};

/** Texto de invitación para copiar, enviar por correo o por WhatsApp. */
export function meetingInvitation(m: MeetingLike, hostName?: string | null) {
  const lines = [
    `${hostName ?? "e-grow"} te invita a una reunión${m.meetingUrl?.includes("zoom.") ? " de Zoom" : ""}.`,
    "",
    `Tema: ${m.subject}`,
    `Fecha: ${formatDateTimeTz(m.startAt)} (hora de ${APP_TIMEZONE === "America/Guayaquil" ? "Ecuador" : APP_TIMEZONE})`,
    m.durationMinutes ? `Duración: ${m.durationMinutes} min` : "",
    m.meetingUrl ? `\nUnirse a la reunión:\n${m.meetingUrl}` : "",
    m.meetingPassword ? `Código de acceso: ${m.meetingPassword}` : "",
    m.body ? `\n${m.body}` : "",
  ];
  return lines.filter((l) => l !== "").join("\n");
}

/** Enlace para agregar la reunión a Google Calendar. */
export function googleCalendarUrl(m: MeetingLike) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(m.startAt.getTime() + (m.durationMinutes ?? 30) * 60000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: m.subject,
    dates: `${fmt(m.startAt)}/${fmt(end)}`,
    details: meetingInvitation(m),
    ...(m.meetingUrl ? { location: m.meetingUrl } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
