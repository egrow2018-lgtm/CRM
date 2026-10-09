import Link from "next/link";

export const PAGE_SIZES = [25, 50, 100];

export function pageParams(sp: { page?: string; per?: string }) {
  const per = PAGE_SIZES.includes(Number(sp.per)) ? Number(sp.per) : 25;
  const page = Math.max(1, Number(sp.page) || 1);
  return { per, page, skip: (page - 1) * per };
}

/** Une los parámetros actuales con los cambios y arma la URL. */
export function hrefWith(path: string, sp: Record<string, string | undefined>, changes: Record<string, string | number | undefined>) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...changes })) if (v !== undefined && v !== "") next.set(k, String(v));
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Paginación estilo HubSpot: Anterior 1 2 3 … Siguiente · 25 por página. */
export function Pager({
  path,
  sp,
  total,
  page,
  per,
}: {
  path: string;
  sp: Record<string, string | undefined>;
  total: number;
  page: number;
  per: number;
}) {
  const pages = Math.max(1, Math.ceil(total / per));
  const start = Math.max(1, Math.min(page - 4, pages - 9));
  const nums = Array.from({ length: Math.min(10, pages) }, (_, i) => start + i);
  const link = (p: number) => hrefWith(path, sp, { page: p === 1 ? undefined : p });
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-1 text-sm">
      {page > 1 ? <Link href={link(page - 1)} className="px-2 py-1 text-brand-600 hover:underline">‹ Anterior</Link> : <span className="px-2 py-1 text-slate-300">‹ Anterior</span>}
      {nums.map((n) => (
        <Link
          key={n}
          href={link(n)}
          className={`min-w-8 rounded-full px-2 py-1 text-center ${n === page ? "border border-brand-700 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {n}
        </Link>
      ))}
      {page < pages ? <Link href={link(page + 1)} className="px-2 py-1 text-brand-600 hover:underline">Siguiente ›</Link> : <span className="px-2 py-1 text-slate-300">Siguiente ›</span>}
      <span className="ml-3 text-slate-400">|</span>
      {PAGE_SIZES.map((s) => (
        <Link key={s} href={hrefWith(path, sp, { per: s === 25 ? undefined : s, page: undefined })} className={`px-1.5 py-1 ${s === per ? "font-semibold text-brand-700" : "text-slate-500 hover:underline"}`}>
          {s}
        </Link>
      ))}
      <span className="text-slate-500">por página · {total} en total</span>
    </div>
  );
}

/** Encabezado de columna ordenable (?sort=campo_asc|campo_desc). */
export function SortHeader({
  label,
  field,
  path,
  sp,
  className,
}: {
  label: string;
  field: string;
  path: string;
  sp: Record<string, string | undefined>;
  className?: string;
}) {
  const [cur, dir] = (sp.sort ?? "").split("_");
  const active = cur === field;
  const next = active && dir === "asc" ? "desc" : "asc";
  return (
    <th className={className}>
      <Link href={hrefWith(path, sp, { sort: `${field}_${next}`, page: undefined })} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        <span className={active ? "text-brand-700" : "text-slate-300"}>{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </Link>
    </th>
  );
}
