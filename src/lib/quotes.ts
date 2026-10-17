/** Cálculos y formato de las cotizaciones (sin dependencias de servidor, para poder probarlos). */

/** Cómo se cobra un producto o una línea de cotización. */
export type Billing = "UNICO" | "MENSUAL" | "ANUAL";

export const BILLING: Record<Billing, { label: string; short: string; per: string }> = {
  UNICO: { label: "Pago único", short: "Único", per: "" },
  MENSUAL: { label: "Mensual", short: "Mensual", per: "/mes" },
  ANUAL: { label: "Anual", short: "Anual", per: "/año" },
};

/** Plazo del contrato por defecto de los servicios recurrentes (meses). */
export const DEFAULT_TERM_MONTHS = 12;

export const isBilling = (v: unknown): v is Billing => v === "UNICO" || v === "MENSUAL" || v === "ANUAL";

/**
 * Cuántas veces se cobra una línea en el primer año:
 * pago único 1 · mensual tantos meses como dure el contrato (máximo 12) · anual 1.
 */
export function firstYearFactor(billing: Billing | null | undefined, termMonths?: number | null) {
  if (billing === "MENSUAL") return Math.min(12, Math.max(1, termMonths || DEFAULT_TERM_MONTHS));
  return 1;
}

export type QuoteItem = {
  /** Producto del catálogo (para pasarlo a los productos del negocio al aceptarla) */
  productId?: string | null;
  description: string;
  detail?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number; // porcentaje
  /** Subtotal de un período: el pago único, un mes o un año */
  subtotal: number;
  /** Cómo se cobra (las cotizaciones antiguas no lo tienen: pago único) */
  billing?: Billing;
  /** Plazo del contrato en meses (solo recurrentes) */
  termMonths?: number | null;
};

import type { QuoteBrand } from "./brand";

export type QuoteSnapshot = {
  company: {
    name: string;
    legalName: string;
    taxId: string;
    address: string;
    phone: string;
    email: string;
    website: string;
  };
  client: { company: string | null; contact: string | null; email: string | null; phone: string | null; taxId: string | null; address: string | null };
  dealName: string;
  owner: { name: string; email: string } | null;
  items: QuoteItem[];
  subtotal: number;
  discountTotal: number;
  ivaPercent: number;
  iva: number;
  total: number;
  conditions: string;
  notes: string | null;
  validityDays: number;
  /** Desglose por tipo de cobro, sin IVA (solo si hay servicios recurrentes) */
  oneTime?: number;
  monthly?: number;
  annual?: number;
  /** Marca de la línea (ej. Rutalink); sin ella se usa la de e-grow. Las cotizaciones antiguas no la tienen. */
  brand?: QuoteBrand | null;
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Totales de una cotización. `lines` es el subtotal de cada línea por período (pago único, un mes o un año).
 * `subtotal`, `iva` y `total` corresponden al primer año: los pagos únicos + las mensualidades del primer año
 * (según el plazo) + las anualidades. Así un negocio recurrente se compara en la misma medida que uno de pago único.
 */
export function computeTotals(
  items: { quantity: number; unitPrice: number; discount: number; billing?: Billing | null; termMonths?: number | null }[],
  ivaPercent: number,
) {
  const lines = items.map((i) => round(i.quantity * i.unitPrice * (1 - i.discount / 100)));
  const factor = items.map((i) => firstYearFactor(i.billing, i.termMonths));
  const gross = items.reduce((s, i, k) => s + i.quantity * i.unitPrice * factor[k]!, 0);
  const subtotal = round(lines.reduce((s, l, k) => s + l * factor[k]!, 0));
  const sumOf = (b: Billing) => round(lines.reduce((s, l, k) => s + ((items[k]!.billing ?? "UNICO") === b ? l : 0), 0));
  const iva = round((subtotal * ivaPercent) / 100);
  return {
    lines,
    subtotal,
    discountTotal: round(gross - subtotal),
    iva,
    total: round(subtotal + iva),
    oneTime: sumOf("UNICO"),
    monthly: sumOf("MENSUAL"),
    annual: sumOf("ANUAL"),
  };
}

/** Valor de un producto del negocio en el primer año (para reportes de productos vendidos). */
export function itemFirstYear(i: { quantity: number; unitPrice: number; discount: number; billing?: Billing | null; termMonths?: number | null }) {
  return round(i.quantity * i.unitPrice * (1 - i.discount / 100) * firstYearFactor(i.billing, i.termMonths));
}

export function quoteCode(year: number, number: number) {
  return `COT-${year}-${String(number).padStart(4, "0")}`;
}

export const QUOTE_STATUS = {
  EMITIDA: { label: "Emitida", className: "bg-slate-100 text-slate-700" },
  EN_REVISION: { label: "En revisión", className: "bg-amber-50 text-amber-800" },
  APROBADA: { label: "Aprobada", className: "bg-emerald-50 text-emerald-700" },
  NO_APROBADA: { label: "No aprobada", className: "bg-red-50 text-red-700" },
} as const;

export type QuoteStatusKey = keyof typeof QUOTE_STATUS;

/** Líneas de la cotización tal como llegan del formulario (JSON), validadas y limpias. */
export function parseQuoteLines(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const n = (v: unknown, def = 0) => {
        if (v === undefined || v === null || v === "") return def;
        const x = typeof v === "number" ? v : Number(String(v).replace(",", "."));
        return Number.isFinite(x) ? x : def;
      };
      const billing: Billing = isBilling(o.billing) ? o.billing : "UNICO";
      return {
        productId: typeof o.productId === "string" && o.productId ? o.productId : null,
        // Puede tener varias líneas: se unifican los saltos y se dejan como máximo una línea en blanco
        description: String(o.description ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1000),
        quantity: Math.max(0, n(o.quantity, 1)),
        unitPrice: Math.max(0, n(o.unitPrice)),
        discount: Math.min(100, Math.max(0, n(o.discount))),
        billing,
        // Plazo del contrato (meses) de los recurrentes; 12 si no se indica
        termMonths: billing === "UNICO" ? null : Math.min(120, Math.max(1, Math.round(n(o.termMonths, DEFAULT_TERM_MONTHS)))),
      };
    })
    .filter((l) => l.description && l.quantity > 0)
    .slice(0, 100);
}

/** Mensaje para compartir una cotización por WhatsApp. */
export function quoteWhatsappText(q: { code: string; firstName: string | null; dealName: string | null; validUntil: string; url: string }) {
  const hello = q.firstName ? `Hola ${q.firstName}` : "Hola";
  const what = q.dealName ? `la cotización de ${q.dealName} (${q.code})` : `la cotización ${q.code}`;
  return `${hello}, te comparto ${what}, válida hasta el ${q.validUntil}: ${q.url}`;
}

/** Cotización vigente de un negocio (la aceptada o, si no hay, la más reciente) y las anteriores, de la más nueva a la más antigua. */
export function splitQuoteVersions<T extends { status: string; createdAt: Date }>(quotes: T[]) {
  const sorted = [...quotes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const current = sorted.find((q) => q.status === "APROBADA") ?? sorted[0] ?? null;
  return { current, previous: sorted.filter((q) => q !== current) };
}

/** Asunto del correo con la cotización. */
export function quoteEmailSubject(q: { code: string; dealName: string | null; brandName: string | null }) {
  return `${q.brandName ? `${q.brandName} · ` : ""}Cotización ${q.code}${q.dealName ? ` – ${q.dealName}` : ""}`;
}

/** Mensaje sugerido del correo: saluda por el nombre y no supone el género de nadie. */
export function quoteEmailMessage(q: { code: string; firstName: string | null; dealName: string | null }) {
  const hello = q.firstName ? `Buen día, ${q.firstName}:` : "Buen día:";
  const what = q.dealName ? `la cotización ${q.code} para «${q.dealName}»` : `la cotización ${q.code}`;
  return `${hello}\n\nLe envío ${what}. Quedo a su disposición para cualquier comentario.\n\nSaludos cordiales.`;
}
