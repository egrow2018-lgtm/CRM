"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LEAD_STATUS } from "@/lib/leads";
import { IconSearch } from "@/components/icons";
import { ViewToggle } from "@/components/view-toggle";

export function ContactFilters({ users }: { users: { id: string; name: string }[] }) {
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

  const active = ["q", "owner", "lead", "issue"].some((k) => params.get(k));
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-2.5 top-2 text-slate-400" width={16} height={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, email, teléfono o empresa" className="input w-72 pl-8" />
      </div>
      <select aria-label="Propietario del contacto" className="input w-auto" value={params.get("owner") ?? ""} onChange={(e) => update({ owner: e.target.value })}>
        <option value="">Propietario: todos</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
      <select aria-label="Estado del lead" className="input w-auto" value={params.get("lead") ?? ""} onChange={(e) => update({ lead: e.target.value })}>
        <option value="">Estado del lead: todos</option>
        {Object.entries(LEAD_STATUS).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
        <option value="none">Sin estado</option>
      </select>
      {active && (
        <button
          className="text-xs font-medium text-brand-600 hover:underline"
          onClick={() => {
            setQ("");
            update({ q: "", owner: "", lead: "", issue: "" });
          }}
        >
          Borrar todo
        </button>
      )}
      <div className="ml-auto">
        <ViewToggle defaultView="list" />
      </div>
    </div>
  );
}
