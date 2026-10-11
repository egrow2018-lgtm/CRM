"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconSearch } from "@/components/icons";

export const QUOTE_STATUS: Record<string, string> = {
  vigente: "Vigentes",
  vencida: "Vencidas",
  enviada: "Enviadas por correo",
  "sin-enviar": "Sin enviar por correo",
  ganada: "Negocio ganado",
};

export function QuoteFilters({
  lines,
  users,
  years,
}: {
  lines: { id: string; name: string }[];
  users: { id: string; name: string }[];
  years: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update({ q });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const keys = ["q", "line", "year", "status", "owner"];
  const select = (key: string, label: string, options: [string, string][]) => (
    <select aria-label={label} className="input w-auto" value={params.get(key) ?? ""} onChange={(e) => update({ [key]: e.target.value })}>
      <option value="">{label}: todos</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-2.5 top-2 text-slate-400" width={16} height={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar número, negocio o cliente" className="input w-64 pl-8" />
      </div>
      {select("line", "Línea de negocio", lines.map((l) => [l.id, l.name]))}
      {select("year", "Año", years.map((y) => [String(y), String(y)]))}
      {select("status", "Estado", Object.entries(QUOTE_STATUS))}
      {select("owner", "Responsable", users.map((u) => [u.id, u.name]))}
      {keys.some((k) => params.get(k)) && (
        <button
          className="text-xs font-medium text-brand-600 hover:underline"
          onClick={() => {
            setQ("");
            update(Object.fromEntries(keys.map((k) => [k, ""])));
          }}
        >
          Borrar todo
        </button>
      )}
    </div>
  );
}
