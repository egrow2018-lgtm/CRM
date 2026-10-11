/** Invitación de calendario (.ics) para que la reunión aparezca en Outlook, Gmail o el calendario del teléfono. */
export type IcsEvent = {
  uid: string;
  sequence?: number;
  start: Date;
  durationMinutes: number;
  summary: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  organizer: { name: string; email: string };
  attendees: string[];
  method: "REQUEST" | "CANCEL";
};

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// Texto según RFC 5545: escapar \ ; , y saltos de línea
const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// Líneas de máximo 75 caracteres (las siguientes empiezan con un espacio)
const fold = (line: string) => {
  const out: string[] = [];
  for (let i = 0; i < line.length; i += i === 0 ? 75 : 74) out.push((i === 0 ? "" : " ") + line.slice(i, i + (i === 0 ? 75 : 74)));
  return out.join("\r\n");
};

export function buildIcs(e: IcsEvent) {
  const end = new Date(e.start.getTime() + e.durationMinutes * 60000);
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//e-grow//CRM//ES",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${e.method}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `SEQUENCE:${e.sequence ?? 0}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.summary)}`,
    e.description ? `DESCRIPTION:${esc(e.description)}` : "",
    e.location ? `LOCATION:${esc(e.location)}` : "",
    e.url ? `URL:${e.url}` : "",
    `ORGANIZER;CN=${esc(e.organizer.name)}:mailto:${e.organizer.email}`,
    ...e.attendees.map((a) => `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a}`),
    `STATUS:${e.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Separa una lista de correos escrita a mano (comas, punto y coma, espacios o saltos de línea). */
export function parseEmails(text: string | null | undefined) {
  const all = (text ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const invalid = all.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return { emails: [...new Set(all.filter((e) => !invalid.includes(e)))], invalid };
}
