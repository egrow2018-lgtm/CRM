"use client";

import { useState } from "react";
import { normalize } from "@/lib/csv";

type Option = { id: string; name: string; email: string | null; company: string | null };

/** Buscador con casillas para elegir varios contactos (envía `contactIds`). */
export function ContactPicker({ contacts, suggested = [], name = "contactIds" }: { contacts: Option[]; suggested?: string[]; name?: string }) {
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const key = normalize(q);
  const sugg = new Set(suggested);
  const list = contacts
    .filter((c) => !key || normalize(`${c.name} ${c.email ?? ""} ${c.company ?? ""}`).includes(key))
    .sort((a, b) => Number(sugg.has(b.id)) - Number(sugg.has(a.id)));
  const shown = list.slice(0, 60);
  const toggle = (id: string) =>
    setChosen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="rounded-lg border border-slate-200">
      {[...chosen].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <div className="flex items-center gap-2 border-b border-slate-200 p-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, correo o empresa…" className="input" />
        {chosen.size > 0 && <span className="shrink-0 text-xs font-medium text-brand-700">{chosen.size} elegidos</span>}
      </div>
      <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto">
        {shown.length === 0 && <li className="p-3 text-sm text-slate-500">No hay contactos con esa búsqueda.</li>}
        {shown.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={chosen.has(c.id)} onChange={() => toggle(c.id)} />
              <span className="min-w-0 flex-1 truncate">
                {c.name}
                {c.email && <span className="ml-1 text-xs text-slate-500">{c.email}</span>}
              </span>
              {sugg.has(c.id) && <span className="badge bg-accent-100 text-brand-800">Sugerido</span>}
              {c.company && <span className="shrink-0 text-xs text-slate-400">ahora en {c.company}</span>}
            </label>
          </li>
        ))}
      </ul>
      {list.length > shown.length && <p className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500">Hay {list.length - shown.length} más: escribe para buscar.</p>}
    </div>
  );
}
