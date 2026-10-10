import { companyKey, websiteDomain } from "./csv";

/**
 * Agrupa empresas que probablemente son la misma: igual nombre sin sufijos legales
 * ("Siemens" = "Siemens AG") o igual dominio web. Devuelve los grupos con 2 o más empresas.
 */
export function duplicateGroups<T extends { id: string; name: string; website?: string | null }>(companies: T[]): T[][] {
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
  }
  const groups = new Map<string, T[]>();
  for (const c of companies) {
    const root = find(c.id);
    groups.set(root, [...(groups.get(root) ?? []), c]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
