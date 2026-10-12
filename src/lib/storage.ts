import "server-only";

/**
 * Archivos de la biblioteca de documentos en Supabase Storage (bucket privado "documentos").
 * Variables: SUPABASE_URL (https://xxxx.supabase.co) y SUPABASE_SERVICE_ROLE_KEY.
 * Los archivos suben directo del navegador a Supabase con una URL firmada (Vercel no acepta
 * archivos de más de 4,5 MB) y se leen con URLs firmadas de corta duración.
 */

export const BUCKET = "documentos";
export const MAX_FILE_MB = 50;

export function storageConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const base = () => `${process.env.SUPABASE_URL!.replace(/\/$/, "")}/storage/v1`;
const headers = () => ({ Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY! });
const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

async function fail(res: Response, what: string): Promise<never> {
  const detail = await res.text().catch(() => "");
  throw new Error(`${what} (${res.status}). ${detail.slice(0, 200)}`);
}

let bucketReady = false;
/** Crea el bucket privado la primera vez (si ya existe, no hace nada). */
async function ensureBucket() {
  if (bucketReady) return;
  const res = await fetch(`${base()}/bucket/${BUCKET}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const created = await fetch(`${base()}/bucket`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_FILE_MB * 1024 * 1024 }),
      cache: "no-store",
    });
    if (!created.ok && created.status !== 409) {
      const text = await created.text().catch(() => "");
      if (!/already exists/i.test(text)) throw new Error(`No se pudo crear el espacio de archivos en Supabase (${created.status}). ${text.slice(0, 200)}`);
    }
  }
  bucketReady = true;
}

/** URL a la que el navegador sube el archivo (PUT), válida por 2 horas. */
export async function signedUploadUrl(path: string) {
  await ensureBucket();
  const res = await fetch(`${base()}/object/upload/sign/${BUCKET}/${encodePath(path)}`, { method: "POST", headers: headers(), cache: "no-store" });
  if (!res.ok) await fail(res, "No se pudo preparar la subida del archivo");
  const { url } = (await res.json()) as { url: string };
  return `${base()}${url}`;
}

/** URL temporal para ver o descargar el archivo. */
export async function signedFileUrl(path: string, opts: { expiresIn?: number; download?: string } = {}) {
  const res = await fetch(`${base()}/object/sign/${BUCKET}/${encodePath(path)}`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: opts.expiresIn ?? 600 }),
    cache: "no-store",
  });
  if (!res.ok) await fail(res, "No se pudo abrir el archivo");
  const { signedURL } = (await res.json()) as { signedURL: string };
  const url = new URL(`${base()}${signedURL}`);
  if (opts.download) url.searchParams.set("download", opts.download);
  return url.toString();
}

/** ¿Existe el archivo? (para confirmar que la subida terminó) */
export async function fileExists(path: string) {
  const res = await fetch(`${base()}/object/info/${BUCKET}/${encodePath(path)}`, { headers: headers(), cache: "no-store" });
  return res.ok;
}

export async function deleteFiles(paths: string[]) {
  if (!paths.length || !storageConfigured()) return;
  const res = await fetch(`${base()}/object/${BUCKET}`, {
    method: "DELETE",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
    cache: "no-store",
  });
  if (!res.ok) console.error("No se pudieron borrar archivos de Supabase", res.status, await res.text().catch(() => ""));
}
