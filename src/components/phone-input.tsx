"use client";

import { useEffect, useRef, useState } from "react";
import { normalize } from "@/lib/csv";
import { COUNTRIES, countryByIso, flagUrl, groupNational, parsePhone } from "@/lib/phone";

/**
 * Teléfono con lista de países (bandera y código) y formato automático: +593 99 543 9203.
 * Envía el número completo en el campo `name`.
 */
export function PhoneInput({
  name = "phone",
  defaultValue,
  required,
  placeholder = "99 543 9203",
  className = "",
}: {
  name?: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const initial = parsePhone(defaultValue);
  const [iso, setIso] = useState(initial.iso);
  const [national, setNational] = useState(initial.national ? groupNational(initial.national, initial.iso) : "");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const country = countryByIso(iso);
  const digits = national.replace(/\D/g, "");
  const value = digits ? `+${country.dial} ${groupNational(digits, iso)}` : "";

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const key = normalize(q);
  const list = COUNTRIES.filter((c) => !key || normalize(`${c.name} ${c.dial} ${c.iso}`).includes(key.replace(/^\+/, "")));

  return (
    <div ref={box} className={`relative flex w-full ${className}`}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex shrink-0 items-center gap-1 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-2 text-sm text-slate-700 hover:bg-slate-100"
        aria-label={`País: ${country.name}`}
        title={country.name}
      >
        <Flag iso={iso} />
        <span className="tabular-nums">+{country.dial}</span>
      </button>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        required={required}
        value={national}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          // Si pegan el número completo con "+", se detecta el país
          if (raw.trim().startsWith("+")) {
            const p = parsePhone(raw);
            setIso(p.iso);
            setNational(groupNational(p.national, p.iso));
            return;
          }
          const d = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 13);
          setNational(groupNational(d, iso));
        }}
        className="input min-w-0 flex-1 rounded-l-none px-2"
      />
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar país o código…" className="input py-1 text-sm" />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1 text-sm">
            {list.map((c) => (
              <li key={c.iso}>
                <button
                  type="button"
                  onClick={() => {
                    setIso(c.iso);
                    setNational(groupNational(digits, c.iso));
                    setOpen(false);
                    setQ("");
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 ${c.iso === iso ? "bg-brand-50 font-medium" : ""}`}
                >
                  <Flag iso={c.iso} />
                  <span className="flex-1">{c.name}</span>
                  <span className="tabular-nums text-slate-500">+{c.dial}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-2 text-slate-500">Sin resultados</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Bandera del país; si la imagen no carga (sin internet o bloqueada) se muestra el código del país. */
function Flag({ iso }: { iso: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // Si falló antes de que React se conectara, onError no se dispara: se revisa al montar
  useEffect(() => {
    setFailed(false);
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, [iso]);
  if (failed) return <span className="inline-block w-5 text-center text-[10px] font-semibold text-slate-500">{iso}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={flagUrl(iso)} alt="" width={20} height={15} className="rounded-sm" onError={() => setFailed(true)} />;
}
