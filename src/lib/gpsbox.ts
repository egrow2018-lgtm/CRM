/**
 * Enlace con GPSBox (app de operación de Rutalink: equipos, SIMs, unidades y renovaciones).
 * Los clientes se relacionan por RUC/cédula (campo "identificacion" en GPSBox, "taxId" en el CRM).
 *
 * Variables:
 *  - GPSBOX_URL: URL pública de GPSBox (ej. https://gpsbox-rutalink.netlify.app). Activa los botones.
 *  - GPSBOX_SUPABASE_URL y GPSBOX_SUPABASE_SERVICE_KEY (opcionales, solo servidor): permiten
 *    mostrar en el CRM las unidades activas y la próxima renovación. El CRM solo LEE.
 */

export type GpsboxCliente = { id: string; nombre: string; identificacion: string; estado?: string; tipoPlan?: string };
export type GpsboxUnidad = { id: string; clienteId: string; estado?: string; placa?: string; fechaProximaRenovacion?: string | null };

export type GpsboxSummary = {
  nombre: string;
  estado: string | null;
  tipoPlan: string | null;
  unidadesActivas: number;
  unidadesTotal: number;
  proximaRenovacion: string | null;
};

/** RUC/cédula comparable: solo dígitos y letras, sin espacios ni guiones. */
export function normalizeTaxId(value: string | null | undefined) {
  return (value ?? "").replace(/[^0-9a-z]/gi, "").toUpperCase();
}

export function gpsboxEnabled() {
  return !!process.env.GPSBOX_URL;
}

export function gpsboxReadEnabled() {
  return !!(process.env.GPSBOX_SUPABASE_URL && process.env.GPSBOX_SUPABASE_SERVICE_KEY);
}

/** Enlace a GPSBox: abre el cliente por RUC o, si no existe, el formulario de nuevo cliente con los datos. */
export function gpsboxLink(company: {
  taxId: string | null;
  name: string;
  phone?: string | null;
  city?: string | null;
  contact?: { firstName: string; lastName: string | null; email: string | null; phone: string | null } | null;
}) {
  const base = (process.env.GPSBOX_URL ?? "").replace(/\/$/, "");
  const params = new URLSearchParams({ ruc: normalizeTaxId(company.taxId), nombre: company.name });
  if (company.city) params.set("ciudad", company.city);
  const phone = company.contact?.phone ?? company.phone;
  if (phone) params.set("telefono", phone);
  if (company.contact?.email) params.set("correo", company.contact.email);
  if (company.contact?.firstName) params.set("contactoNombre", company.contact.firstName);
  if (company.contact?.lastName) params.set("contactoApellido", company.contact.lastName);
  return `${base}/?${params}`;
}

/** Resume los datos de GPSBox de un cliente (pura, para poder probarla). */
export function summarizeGpsbox(data: { clientes?: GpsboxCliente[]; unidades?: GpsboxUnidad[] }, taxId: string): GpsboxSummary | null {
  const key = normalizeTaxId(taxId);
  if (!key) return null;
  const cliente = (data.clientes ?? []).find((c) => normalizeTaxId(c.identificacion) === key);
  if (!cliente) return null;
  const unidades = (data.unidades ?? []).filter((u) => u.clienteId === cliente.id);
  const activas = unidades.filter((u) => (u.estado ?? "Activo") === "Activo");
  const proxima = activas
    .map((u) => u.fechaProximaRenovacion)
    .filter((d): d is string => !!d)
    .sort()[0];
  return {
    nombre: cliente.nombre,
    estado: cliente.estado ?? null,
    tipoPlan: cliente.tipoPlan ?? null,
    unidadesActivas: activas.length,
    unidadesTotal: unidades.length,
    proximaRenovacion: proxima ?? null,
  };
}

// Caché de 5 minutos para no descargar los datos de GPSBox en cada visita
let cache: { at: number; data: { clientes?: GpsboxCliente[]; unidades?: GpsboxUnidad[] } } | null = null;

/** Lee (solo lectura) los datos de GPSBox desde su Supabase. Devuelve null si no está configurado o falla. */
export async function fetchGpsboxSummary(taxId: string | null | undefined): Promise<GpsboxSummary | null | "error"> {
  if (!gpsboxReadEnabled() || !normalizeTaxId(taxId)) return null;
  try {
    if (!cache || Date.now() - cache.at > 5 * 60_000) {
      const url = `${process.env.GPSBOX_SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/rutalink_data?select=data&id=eq.main`;
      const key = process.env.GPSBOX_SUPABASE_SERVICE_KEY!;
      const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
      if (!res.ok) throw new Error(`GPSBox respondió ${res.status}`);
      const rows = (await res.json()) as { data: { clientes?: GpsboxCliente[]; unidades?: GpsboxUnidad[] } }[];
      cache = { at: Date.now(), data: rows[0]?.data ?? {} };
    }
    return summarizeGpsbox(cache.data, taxId!);
  } catch (e) {
    console.error("No se pudo leer GPSBox", e);
    return "error";
  }
}
