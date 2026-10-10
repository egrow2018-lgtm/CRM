"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LEAD_STATUS } from "@/lib/leads";
import { IconSearch } from "@/components/icons";

export const ACTIVITY_RANGES: Record<string, string> = {
  "7": "Últimos 7 días",
  "30": "Últimos 30 días",
  "90": "Últimos 90 días",
  "mas-90": "Hace más de 90 días",
  ninguna: "Sin actividad",
};

export function CompanyFilters({ users }: { users: { id: string; name: string }[] }) {
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

  const keys = ["q", "owner", "lead", "activity", "from", "to", "dup"];
  const active = keys.some((k) => params.get(k));
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-2.5 top-2 text-slate-400" width={16} height={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, RUC o ciudad" className="input w-64 pl-8" />
      </div>
      <select aria-label="Propietario" className="input w-auto" value={params.get("owner") ?? ""} onChange={(e) => update({ owner: e.target.value })}>
        <option value="">Propietario: todos</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
        <option value="none">Sin propietario</option>
      </select>
      <select aria-label="Estado del lead" className="input w-auto" value={params.get("lead") ?? ""} onChange={(e) => update({ lead: e.target.value })}>
        <option value="">Estado del lead: todos</option>
        {Object.entries(LEAD_STATUS).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
        <option value="none">Sin estado</option>
      </select>
      <select aria-label="Última actividad" className="input w-auto" value={params.get("activity") ?? ""} onChange={(e) => update({ activity: e.target.value })}>
        <option value="">Última actividad: cualquiera</option>
        {Object.entries(ACTIVITY_RANGES).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-sm text-slate-600">
        Creada desde
        <input type="date" aria-label="Creada desde" className="input w-auto" value={params.get("from") ?? ""} onChange={(e) => update({ from: e.target.value })} />
      </label>
      <label className="flex items-center gap-1 text-sm text-slate-600">
        hasta
        <input type="date" aria-label="Creada hasta" className="input w-auto" value={params.get("to") ?? ""} onChange={(e) => update({ to: e.target.value })} />
      </label>
      <label className="flex items-center gap-1.5 text-sm text-slate-700">
        <input type="checkbox" checked={params.get("dup") === "1"} onChange={(e) => update({ dup: e.target.checked ? "1" : "" })} />
        Solo posibles duplicados
      </label>
      {active && (
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
