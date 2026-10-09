"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconSearch } from "./icons";
import { ViewToggle } from "./view-toggle";

type Options = {
  users: { id: string; name: string }[];
  lines: { id: string; name: string }[];
  products: { id: string; name: string; lineId: string; lineName: string }[];
  years: number[];
};

/**
 * Barra de filtros por año (fecha de cierre), línea de negocio, producto o servicio y propietario.
 * `variant="board"` agrega búsqueda, rango de fechas y el cambio de vista tablero/lista.
 */
export function DealFiltersBar({ options, variant = "board" }: { options: Options; variant?: "board" | "dashboard" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  useEffect(() => {
    if (variant !== "board") return;
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update({ q });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const line = params.get("line") ?? "";
  const product = params.get("product") ?? "";
  const products = line && line !== "none" ? options.products.filter((p) => p.lineId === line) : options.products;
  const groups = new Map<string, typeof products>();
  for (const p of products) groups.set(p.lineName, [...(groups.get(p.lineName) ?? []), p]);
  const active = ["year", "line", "product", "owner", "q", "from", "to"].some((k) => params.get(k));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {variant === "board" && (
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-2.5 top-2 text-slate-400" width={16} height={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar negocio, empresa o contacto" className="input w-64 pl-8" />
        </div>
      )}
      <select aria-label="Año de cierre" className="input w-auto" value={params.get("year") ?? ""} onChange={(e) => update({ year: e.target.value })}>
        <option value="">Todos los años</option>
        {options.years.map((y) => (
          <option key={y} value={y}>Cierre {y}</option>
        ))}
        <option value="none">Sin fecha de cierre</option>
      </select>
      <select
        aria-label="Línea de negocio"
        className="input w-auto"
        value={line}
        onChange={(e) => {
          const nextLine = e.target.value;
          const keepProduct = !product || options.products.some((p) => p.id === product && (!nextLine || p.lineId === nextLine));
          update({ line: nextLine, product: keepProduct ? product : "" });
        }}
      >
        <option value="">Todas las líneas</option>
        {options.lines.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
        <option value="none">Sin línea</option>
      </select>
      <select aria-label="Producto o servicio" className="input w-auto max-w-64" value={product} onChange={(e) => update({ product: e.target.value })}>
        <option value="">Todos los productos y servicios</option>
        {[...groups.entries()].map(([lineName, items]) => (
          <optgroup key={lineName} label={lineName}>
            {items.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <select aria-label="Propietario" className="input w-auto" value={params.get("owner") ?? ""} onChange={(e) => update({ owner: e.target.value })}>
        <option value="">Todos los propietarios</option>
        <option value="me">Mis negocios</option>
        {options.users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
        <option value="none">Sin propietario</option>
      </select>
      {variant === "board" && (
        <>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            Cierre desde
            <input type="date" className="input w-auto" value={params.get("from") ?? ""} onChange={(e) => update({ from: e.target.value })} />
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            hasta
            <input type="date" className="input w-auto" value={params.get("to") ?? ""} onChange={(e) => update({ to: e.target.value })} />
          </label>
        </>
      )}
      {active && (
        <button
          className="text-xs font-medium text-brand-600 hover:underline"
          onClick={() => {
            setQ("");
            update({ year: "", line: "", product: "", owner: "", q: "", from: "", to: "" });
          }}
        >
          Limpiar filtros
        </button>
      )}
      {variant === "board" && (
        <div className="ml-auto">
          <ViewToggle />
        </div>
      )}
    </div>
  );
}
