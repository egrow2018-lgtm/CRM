/** Cálculos y formato de las cotizaciones (sin dependencias de servidor, para poder probarlos). */
export type QuoteItem = {
  description: string;
  detail?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number; // porcentaje
  subtotal: number;
};

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
