import { companyKey, websiteDomain } from "./csv";

/**
 * Agrupa empresas que probablemente son la misma: igual nombre sin sufijos legales
 * ("Siemens" = "Siemens AG"), igual dominio web o igual RUC. Devuelve los grupos con 2 o más empresas.
 */
export function duplicateGroups<T extends { id: string; name: string; website?: string | null; taxId?: string | null }>(companies: T[]): T[][] {
  // Unión de conjuntos: dos empresas quedan en el mismo grupo si comparten nombre o dominio
  const parent = new Map(companies.map((c) => [c.id, c.id]));
  const find = (id: string): string => {
    const p = parent.get(id)!;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const firstByKey = new Map<string, string>();
  const link = (key: string | null, id: string) => {
    if (!key) return;
    const other = firstByKey.get(key);
    if (other) parent.set(find(id), find(other));
    else firstByKey.set(key, id);
  };
  for (const c of companies) {
    link(`n:${companyKey(c.name)}`, c.id);
    const d = websiteDomain(c.website);
    if (d) link(`d:${d}`, c.id);
    const t = taxIdKey(c.taxId);
    if (t) link(`t:${t}`, c.id);
  }
  const groups = new Map<string, T[]>();
  for (const c of companies) {
    const root = find(c.id);
    groups.set(root, [...(groups.get(root) ?? []), c]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** RUC / cédula comparable: solo dígitos y letras ("1792-146739-001" = "1792146739001"). Muy corto = no sirve para comparar. */
export function taxIdKey(taxId: string | null | undefined) {
  const k = (taxId ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  return k.length >= 6 ? k : null;
}

/** Dominio comparable del sitio web (sin redes sociales ni sitios genéricos, que comparten muchas empresas). */
const SHARED_SITES = new Set(["facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "google.com", "wix.com", "wixsite.com", "sites.google.com", "blogspot.com", "wordpress.com"]);
export function websiteKey(website: string | null | undefined) {
  const d = websiteDomain(website);
  return d && !SHARED_SITES.has(d) && d.includes(".") ? d : null;
}

/** ¿Qué empresa de la lista ya tiene el mismo RUC o el mismo sitio web? */
export function findCompanyDuplicate<T extends { id: string; taxId: string | null; website: string | null }>(
  data: { taxId?: string | null; website?: string | null },
  companies: T[],
  excludeId?: string,
): { company: T; reason: "ruc" | "web" } | null {
  const tax = taxIdKey(data.taxId);
  const web = websiteKey(data.website);
  for (const c of companies) {
    if (c.id === excludeId) continue;
    if (tax && taxIdKey(c.taxId) === tax) return { company: c, reason: "ruc" };
  }
  for (const c of companies) {
    if (c.id === excludeId) continue;
    if (web && websiteKey(c.website) === web) return { company: c, reason: "web" };
  }
  return null;
}
