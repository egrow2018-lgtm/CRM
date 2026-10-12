/** Cálculos y formato de las cotizaciones (sin dependencias de servidor, para poder probarlos). */
export type QuoteItem = {
  /** Producto del catálogo (para pasarlo a los productos del negocio al aceptarla) */
  productId?: string | null;
  description: string;
  detail?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number; // porcentaje
  subtotal: number;
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
  /** Marca de la línea (ej. Rutalink); sin ella se usa la de e-grow. Las cotizaciones antiguas no la tienen. */
  brand?: QuoteBrand | null;
};

const round = (n: number) => Math.round(n * 100) / 100;

export function computeTotals(
  items: { quantity: number; unitPrice: number; discount: number }[],
  ivaPercent: number,
) {
  const gross = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const lines = items.map((i) => round(i.quantity * i.unitPrice * (1 - i.discount / 100)));
  const subtotal = round(lines.reduce((s, l) => s + l, 0));
  const iva = round((subtotal * ivaPercent) / 100);
  return { lines, subtotal, discountTotal: round(gross - subtotal), iva, total: round(subtotal + iva) };
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
        const x = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
        return Number.isFinite(x) ? x : def;
      };
      return {
        productId: typeof o.productId === "string" && o.productId ? o.productId : null,
        description: String(o.description ?? "").trim().slice(0, 300),
        quantity: Math.max(0, n(o.quantity, 1)),
        unitPrice: Math.max(0, n(o.unitPrice)),
        discount: Math.min(100, Math.max(0, n(o.discount))),
      };
    })
    .filter((l) => l.description && l.quantity > 0)
    .slice(0, 100);
}
