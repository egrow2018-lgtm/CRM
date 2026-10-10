/** Zona horaria de e-grow (Ecuador). Se puede cambiar con NEXT_PUBLIC_APP_TIMEZONE. */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Guayaquil";

function offsetMs(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-20" + "10:30" en la zona horaria indicada → instante UTC. */
export function zonedToUtc(date: string, time: string, tz = APP_TIMEZONE) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || hh == null || mm == null || Number.isNaN(hh) || Number.isNaN(mm)) throw new Error("Fecha u hora inválida.");
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - offsetMs(new Date(guess), tz);
  const second = offsetMs(new Date(utc), tz);
  if (guess - second !== utc) utc = guess - second;
  return new Date(utc);
}

/** Partes locales de un instante: { date: "2026-10-20", time: "10:30" }. */
export function utcToZoned(date: Date, tz = APP_TIMEZONE) {
  const local = new Date(date.getTime() + offsetMs(date, tz));
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function formatDateTimeTz(date: Date, tz = APP_TIMEZONE) {
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "full", timeStyle: "short", timeZone: tz }).format(date);
}

export function formatTimeTz(date: Date, tz = APP_TIMEZONE) {
  return new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(date);
}
