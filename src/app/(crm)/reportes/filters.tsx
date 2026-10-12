"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ReportFilters({ years, lines, year }: { years: number[]; lines: { id: string; name: string }[]; year: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Año" className="input w-auto" value={String(year)} onChange={(e) => update("year", e.target.value)}>
        {years.map((y) => (
          <option key={y} value={y}>Año {y}</option>
        ))}
      </select>
      <select aria-label="Línea de negocio" className="input w-auto" value={params.get("line") ?? ""} onChange={(e) => update("line", e.target.value)}>
        <option value="">Todas las líneas</option>
        {lines.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
    </div>
  );
}
