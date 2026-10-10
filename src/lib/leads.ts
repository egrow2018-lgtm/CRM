import type { LeadStatus } from "@prisma/client";

export const LEAD_STATUS: Record<LeadStatus, { label: string; className: string }> = {
  NUEVO: { label: "Nuevo", className: "bg-accent-500 text-brand-800" },
  EN_SEGUIMIENTO: { label: "En seguimiento", className: "bg-amber-100 text-amber-800" },
  CALIFICADO: { label: "Calificado", className: "bg-brand-700 text-white" },
  DESCARTADO: { label: "Descartado", className: "bg-slate-200 text-slate-600" },
};
