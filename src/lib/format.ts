const money = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const moneyExact = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" });

type Numeric = number | string | { toString(): string } | null | undefined;

export function toNumber(value: Numeric) {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

export const formatMoney = (value: Numeric) => money.format(toNumber(value));
export const formatMoneyExact = (value: Numeric) => moneyExact.format(toNumber(value));
export const formatDate = (value: Date | null | undefined) => (value ? date.format(value) : "—");
export const formatDateTime = (value: Date | null | undefined) => (value ? dateTime.format(value) : "—");

/** yyyy-mm-dd para inputs type=date (en UTC, igual que como se guardan). */
export const toDateInput = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : "");

export function timeAgo(value: Date | null | undefined) {
  if (!value) return "sin actividad";
  const diff = Date.now() - value.getTime();
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(-days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(-months, "month");
  return rtf.format(-Math.round(months / 12), "year");
}

export function contactName(c: { firstName: string; lastName: string | null }) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
