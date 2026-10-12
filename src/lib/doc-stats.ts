/** Estadísticas de documentos rastreados (visitantes, tiempo por página). Sin dependencias del servidor. */

export type ViewLike = {
  id: string;
  startedAt: Date;
  durationSec: number;
  pageTimes: unknown;
  downloaded: boolean;
  viewerEmail: string | null;
  link: { id: string; label: string | null; contactId: string | null; contact: { id: string; firstName: string; lastName: string | null; company: { name: string; website: string | null } | null } | null };
};

/** Lee { "1": segundos, … } y devuelve [{ page, seconds }] ordenado por página. */
export function parsePageTimes(value: unknown, pageCount?: number | null) {
  const out = new Map<number, number>();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const page = Number(k);
      const seconds = Number(v);
      if (Number.isInteger(page) && page > 0 && page <= 2000 && Number.isFinite(seconds) && seconds > 0) out.set(page, seconds);
    }
  }
  const last = Math.max(pageCount ?? 0, ...out.keys(), 0);
  return Array.from({ length: last }, (_, i) => ({ page: i + 1, seconds: Math.round((out.get(i + 1) ?? 0) * 10) / 10 }));
}

/** Suma los tiempos que manda el visor, acotando valores absurdos (máx. 30 min por página y envío). */
export function mergePageTimes(current: unknown, delta: unknown) {
  const base: Record<string, number> = {};
  if (current && typeof current === "object" && !Array.isArray(current)) {
    for (const [k, v] of Object.entries(current as Record<string, unknown>)) if (Number.isFinite(Number(v))) base[k] = Number(v);
  }
  if (delta && typeof delta === "object" && !Array.isArray(delta)) {
    for (const [k, v] of Object.entries(delta as Record<string, unknown>)) {
      const page = Number(k);
      const s = Number(v);
      if (!Number.isInteger(page) || page < 1 || page > 2000 || !Number.isFinite(s) || s <= 0) continue;
      base[String(page)] = Math.round(((base[String(page)] ?? 0) + Math.min(s, 1800)) * 10) / 10;
    }
  }
  return base;
}

export function visitorKey(v: ViewLike) {
  if (v.link.contactId) return `c:${v.link.contactId}`;
  if (v.viewerEmail) return `e:${v.viewerEmail.toLowerCase()}`;
  return `l:${v.link.id}`;
}

export function visitorName(v: ViewLike) {
  const c = v.link.contact;
  if (c) return [c.firstName, c.lastName].filter(Boolean).join(" ");
  if (v.viewerEmail) return v.viewerEmail;
  return v.link.label ? `Enlace «${v.link.label}»` : "Visitante sin identificar";
}

export type Visitor = {
  key: string;
  name: string;
  contactId: string | null;
  company: { name: string; website: string | null } | null;
  visits: number;
  totalSec: number;
  lastVisit: Date;
  downloaded: boolean;
};

/** Agrupa las visitas por visitante (contacto, correo o enlace), con el más reciente primero. */
export function groupVisitors(views: ViewLike[]): Visitor[] {
  const map = new Map<string, Visitor>();
  for (const v of views) {
    const key = visitorKey(v);
    const cur = map.get(key);
    if (cur) {
      cur.visits++;
      cur.totalSec += v.durationSec;
      if (v.startedAt > cur.lastVisit) cur.lastVisit = v.startedAt;
      cur.downloaded ||= v.downloaded;
    } else {
      map.set(key, {
        key,
        name: visitorName(v),
        contactId: v.link.contactId,
        company: v.link.contact?.company ?? null,
        visits: 1,
        totalSec: v.durationSec,
        lastVisit: v.startedAt,
        downloaded: v.downloaded,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime());
}

/** "2 min 05 s", "45 s" */
export function formatDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

/** Token aleatorio para enlaces públicos (sin caracteres ambiguos en URLs). */
export function randomToken(bytes = 18) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
