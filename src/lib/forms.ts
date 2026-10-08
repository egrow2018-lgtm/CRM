/** Utilidades para leer FormData en server actions. */
export function str(form: FormData, key: string) {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function reqStr(form: FormData, key: string, label: string) {
  const v = str(form, key);
  if (!v) throw new Error(`El campo "${label}" es obligatorio.`);
  return v;
}

export function num(form: FormData, key: string) {
  const v = str(form, key);
  if (v == null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function date(form: FormData, key: string) {
  const v = str(form, key);
  if (!v) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function bool(form: FormData, key: string) {
  const v = form.get(key);
  return v === "on" || v === "true" || v === "1";
}

export type ActionState = { error?: string; ok?: boolean } | undefined;
