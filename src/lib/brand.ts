/** Marca con la que se emite una cotización (e-grow por defecto, o la de una línea como Rutalink). */
export type QuoteBrand = {
  name: string;
  logo: string | null; // data URL; null = logo de e-grow
  primary: string;
  accent: string;
  website: string | null;
  /** Fondo del encabezado (para logos claros); null = blanco */
  headerBg?: string | null;
};

export const EGROW_PRIMARY = "#1c315e";
export const EGROW_ACCENT = "#b9d43a";

const HEX = /^#[0-9a-f]{6}$/i;
export const validHex = (v: string | null | undefined, fallback: string) => (v && HEX.test(v) ? v : fallback);

/** La línea tiene marca propia si tiene logo. */
export function lineBrand(line: {
  name: string;
  brandName: string | null;
  brandLogo: string | null;
  brandPrimary: string | null;
  brandAccent: string | null;
  brandWebsite: string | null;
  brandHeaderBg?: string | null;
}): QuoteBrand | null {
  if (!line.brandLogo) return null;
  return {
    name: line.brandName || line.name,
    logo: line.brandLogo,
    primary: validHex(line.brandPrimary, EGROW_PRIMARY),
    accent: validHex(line.brandAccent, EGROW_ACCENT),
    website: line.brandWebsite,
    headerBg: line.brandHeaderBg && HEX.test(line.brandHeaderBg) ? line.brandHeaderBg : null,
  };
}

type BrandLine = Parameters<typeof lineBrand>[0] & { id: string };

/** Marca de un negocio: la de su línea o, si no tiene, la línea común a todos sus productos. */
export function dealBrand(deal: { businessLine: BrandLine | null; items: { product: { businessLine: BrandLine } | null }[] }) {
  if (deal.businessLine) return lineBrand(deal.businessLine);
  const lines = new Map(deal.items.flatMap((i) => (i.product ? [[i.product.businessLine.id, i.product.businessLine] as const] : [])));
  return lines.size === 1 ? lineBrand([...lines.values()][0]!) : null;
}

/** Texto blanco o casi negro según qué se lea mejor sobre el color de fondo. */
export function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return lum > 0.4 ? "#0f172a" : "#ffffff";
}
