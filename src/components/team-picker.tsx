"use client";

import { useEffect, useRef, useState } from "react";

type Member = { id: string; name: string; specialty: string | null; active: boolean };

/**
 * Lista desplegable con casillas para elegir a los integrantes del equipo de desarrollo.
 * Los inactivos solo aparecen si ya estaban elegidos. Envía un `name` por cada integrante marcado.
 */
export function TeamPicker({ name, initial, legacy, team }: { name: string; initial: string[]; legacy: string | null; team: Member[] }) {
  const [chosen, setChosen] = useState<Set<string>>(new Set(initial));
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const shown = team.filter((m) => m.active || initial.includes(m.id));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = (id: string) =>
    setChosen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selected = shown.filter((m) => chosen.has(m.id));

  return (
    <div ref={box} className="relative mt-1">
      {[...chosen].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {legacy && <input type="hidden" name={`${name}_legacy`} value={legacy} />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="input flex min-h-9 items-center justify-between gap-2 text-left"
      >
        <span className={`min-w-0 flex-1 truncate ${selected.length ? "text-slate-800" : "text-slate-400"}`}>
          {selected.length ? selected.map((m) => m.name).join(", ") : "— Elige el equipo —"}
        </span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-500" aria-hidden>
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {legacy && selected.length === 0 && (
        <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Registro anterior: <span className="whitespace-pre-line">{legacy}</span>. Elige los integrantes de la lista para reemplazarlo.
        </p>
      )}
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {shown.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">Aún no hay integrantes. El administrador los agrega en Configuración → Equipo de desarrollo.</p>
          ) : (
            shown.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={chosen.has(m.id)} onChange={() => toggle(m.id)} />
                <span className="min-w-0 flex-1">
                  {m.name}
                  {m.specialty && <span className="text-xs text-slate-500"> · {m.specialty}</span>}
                  {!m.active && <span className="text-xs text-slate-400"> (inactivo)</span>}
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
