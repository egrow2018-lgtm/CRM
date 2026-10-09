import type { LeadStatus } from "@prisma/client";

export const LEAD_STATUS: Record<LeadStatus, { label: string; className: string }> = {
  NUEVO: { label: "Nuevo", className: "bg-pink-100 text-pink-800" },
  EN_SEGUIMIENTO: { label: "En seguimiento", className: "bg-amber-100 text-amber-800" },
  CALIFICADO: { label: "Calificado", className: "bg-emerald-100 text-emerald-800" },
  DESCARTADO: { label: "Descartado", className: "bg-slate-200 text-slate-600" },
};
