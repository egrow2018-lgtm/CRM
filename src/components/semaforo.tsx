import type { AlertLevel } from "@/lib/alerts";

/** Estilos del semáforo. Cada nivel tiene color, símbolo y texto (no depende solo del color). */
export const SEMAFORO: Record<AlertLevel, { dot: string; chip: string; border: string; symbol: string; name: string }> = {
  rojo: { dot: "bg-alert-red text-white", chip: "border-red-200 bg-red-50 text-red-800", border: "border-l-alert-red", symbol: "✕", name: "Vencido" },
  amarillo: { dot: "bg-alert-amber text-slate-900", chip: "border-amber-200 bg-amber-50 text-amber-900", border: "border-l-alert-amber", symbol: "!", name: "Atención" },
  verde: { dot: "bg-alert-green text-white", chip: "border-green-200 bg-green-50 text-green-800", border: "border-l-alert-green", symbol: "✓", name: "Al día" },
};

export function SemaforoDot({ level, title }: { level: AlertLevel; title?: string }) {
  const s = SEMAFORO[level];
  return (
    <span
      title={title ?? s.name}
      aria-label={title ?? s.name}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold leading-none ${s.dot}`}
    >
      {s.symbol}
    </span>
  );
}

/** Píldora con el punto del semáforo y un texto. */
export function Semaforo({ level, label, className = "" }: { level: AlertLevel; label: string; className?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs ${SEMAFORO[level].chip} ${className}`}>
      <SemaforoDot level={level} title={label} />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function SemaforoLegend() {
  return (
    <span className="inline-flex flex-wrap items-center gap-3 text-xs text-slate-500">
      {(["rojo", "amarillo", "verde"] as const).map((l) => (
        <span key={l} className="inline-flex items-center gap-1">
          <SemaforoDot level={l} /> {SEMAFORO[l].name}
        </span>
      ))}
    </span>
  );
}
