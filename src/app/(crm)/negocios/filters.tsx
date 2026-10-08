"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconBoard, IconList, IconSearch } from "@/components/icons";

type Opt = { id: string; name: string };

export function DealFiltersBar({ users, lines }: { users: Opt[]; lines: Opt[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  // Búsqueda con pequeña espera para no recargar en cada tecla
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) set("q", q);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const view = params.get("view") ?? "board";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-2.5 top-2 text-slate-400" width={16} height={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar negocio, empresa o contacto" className="input w-72 pl-8" />
      </div>
      <select className="input w-auto" value={params.get("owner") ?? ""} onChange={(e) => set("owner", e.target.value)}>
        <option value="">Todos los propietarios</option>
        <option value="me">Mis negocios</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
        <option value="none">Sin propietario</option>
      </select>
      <select className="input w-auto" value={params.get("line") ?? ""} onChange={(e) => set("line", e.target.value)}>
        <option value="">Todas las líneas de negocio</option>
        {lines.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
        <option value="none">Sin línea</option>
      </select>
      <label className="flex items-center gap-1 text-xs text-slate-500">
        Cierre desde
        <input type="date" className="input w-auto" value={params.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} />
      </label>
      <label className="flex items-center gap-1 text-xs text-slate-500">
        hasta
        <input type="date" className="input w-auto" value={params.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} />
      </label>
      <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-300 bg-white">
        <button title="Tablero" onClick={() => set("view", "")} className={`px-2.5 py-1.5 ${view === "board" ? "bg-brand-50 text-brand-700" : "text-slate-500"}`}>
          <IconBoard />
        </button>
        <button title="Lista" onClick={() => set("view", "list")} className={`border-l border-slate-300 px-2.5 py-1.5 ${view === "list" ? "bg-brand-50 text-brand-700" : "text-slate-500"}`}>
          <IconList />
        </button>
      </div>
    </div>
  );
}
