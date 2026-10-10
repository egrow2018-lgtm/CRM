/**
 * Integración con Zoom mediante una app "Server-to-Server OAuth" de la cuenta de e-grow.
 * Solo se usa desde el servidor (server actions): las credenciales nunca llegan al navegador.
 *
 * Variables: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET y opcionalmente
 * ZOOM_DEFAULT_HOST (email del usuario de Zoom anfitrión si la persona del CRM no tiene licencia).
 */
import { APP_TIMEZONE, utcToZoned } from "./timezone";

const OAUTH_BASE = () => process.env.ZOOM_OAUTH_BASE || "https://zoom.us";
const API_BASE = () => process.env.ZOOM_API_BASE || "https://api.zoom.us/v2";

export class ZoomError extends Error {}

export function zoomConfigured() {
  return !!(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
}

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken() {
  if (!zoomConfigured()) throw new ZoomError("Zoom no está configurado. Agrega ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID y ZOOM_CLIENT_SECRET.");
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(
    `${OAUTH_BASE()}/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(process.env.ZOOM_ACCOUNT_ID!)}`,
    { method: "POST", headers: { Authorization: `Basic ${basic}` }, cache: "no-store" },
  );
  if (!res.ok) throw new ZoomError(`Zoom rechazó las credenciales (${res.status}). Revisa la app Server-to-Server OAuth.`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

async function zoomFetch(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  return fetch(`${API_BASE()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
}

async function errorMessage(res: Response) {
  try {
    const j = (await res.json()) as { code?: number; message?: string };
    return { code: j.code, message: j.message ?? res.statusText };
  } catch {
    return { code: undefined, message: res.statusText };
  }
}

export type ZoomMeeting = { id: string; joinUrl: string; startUrl: string; password: string | null; host: string };

/** Crea la reunión en Zoom a nombre del anfitrión (si no tiene cuenta, usa ZOOM_DEFAULT_HOST). */
export async function createZoomMeeting(input: {
  hostEmail: string;
  topic: string;
  agenda?: string | null;
  start: Date;
  durationMinutes: number;
}): Promise<ZoomMeeting> {
  const local = utcToZoned(input.start);
  const body = JSON.stringify({
    topic: input.topic.slice(0, 200),
    type: 2,
    start_time: `${local.date}T${local.time}:00`,
    timezone: APP_TIMEZONE,
    duration: input.durationMinutes,
    agenda: input.agenda?.slice(0, 2000) ?? undefined,
    settings: { join_before_host: false, waiting_room: true, mute_upon_entry: true, approval_type: 2 },
  });
  const hosts = [input.hostEmail, process.env.ZOOM_DEFAULT_HOST].filter((h, i, a): h is string => !!h && a.indexOf(h) === i);
  let lastError = "";
  for (const host of hosts) {
    const res = await zoomFetch(`/users/${encodeURIComponent(host)}/meetings`, { method: "POST", body });
    if (res.ok) {
      const m = (await res.json()) as { id: number; join_url: string; start_url: string; password?: string };
      return { id: String(m.id), joinUrl: m.join_url, startUrl: m.start_url, password: m.password ?? null, host };
    }
    const err = await errorMessage(res);
    lastError = err.message;
    // 1001: el usuario no existe en la cuenta de Zoom → se intenta con el anfitrión por defecto
    if (!(res.status === 404 || err.code === 1001)) break;
  }
  throw new ZoomError(
    `No se pudo crear la reunión en Zoom: ${lastError}. Verifica que ${input.hostEmail} sea usuario de la cuenta de Zoom o configura ZOOM_DEFAULT_HOST.`,
  );
}

export async function deleteZoomMeeting(id: string) {
  if (!zoomConfigured()) return;
  const res = await zoomFetch(`/meetings/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    const err = await errorMessage(res);
    if (err.code !== 3001) throw new ZoomError(`No se pudo cancelar la reunión en Zoom: ${err.message}`);
  }
}

/** Para la página de configuración: verifica credenciales y si el email es usuario de Zoom. */
export async function checkZoomUser(email: string) {
  const res = await zoomFetch(`/users/${encodeURIComponent(email)}`);
  if (res.ok) {
    const u = (await res.json()) as { type?: number };
    return { ok: true as const, licensed: u.type === 2 };
  }
  return { ok: false as const, message: (await errorMessage(res)).message };
}
