/**
 * Semáforo de alertas del CRM.
 *  - rojo: vencido o urgente
 *  - amarillo: requiere atención (por vencer o sin seguimiento)
 *  - verde: al día
 */
import { utcToZoned } from "./timezone";

export type AlertLevel = "rojo" | "amarillo" | "verde";

const ORDER: Record<AlertLevel, number> = { verde: 0, amarillo: 1, rojo: 2 };

export function worst(...levels: (AlertLevel | null | undefined)[]): AlertLevel | null {
  return levels.reduce<AlertLevel | null>((acc, l) => (l && (!acc || ORDER[l] > ORDER[acc]) ? l : acc), null);
}

const DAY = 86400000;

/** Días desde hoy (zona horaria de e-grow) hasta la fecha: negativo = pasado. */
export function daysFromToday(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = Date.parse(`${utcToZoned(new Date()).date}T00:00:00Z`);
  const target = Date.parse(`${d.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((target - today) / DAY);
}

/** Próxima actividad de un negocio o contacto. */
export function nextActivityAlert(dueDate: Date | string | null | undefined, hasNext: boolean): { level: AlertLevel; label: string } {
  if (!hasNext) return { level: "amarillo", label: "Sin próximas actividades" };
  if (!dueDate) return { level: "verde", label: "Actividad pendiente sin fecha" };
  const d = daysFromToday(dueDate);
  if (d < 0) return { level: "rojo", label: `Vencida hace ${-d} día${d === -1 ? "" : "s"}` };
  if (d === 0) return { level: "amarillo", label: "Vence hoy" };
  return { level: "verde", label: d === 1 ? "Mañana" : `En ${d} días` };
}

/** Fecha de cierre de un negocio abierto. */
export function closeDateAlert(closeDate: Date | string | null | undefined, open: boolean): { level: AlertLevel; label: string } | null {
  if (!open || !closeDate) return null;
  const d = daysFromToday(closeDate);
  if (d < 0) return { level: "rojo", label: "Fecha de cierre vencida" };
  if (d <= 30) return { level: "amarillo", label: d === 0 ? "Cierra hoy" : `Cierra en ${d} días` };
  return { level: "verde", label: "Cierre a tiempo" };
}

/** Última actividad: amarillo después de `warnDays`, rojo después de `dangerDays`. */
export function lastActivityAlert(
  date: Date | string | null | undefined,
  { warnDays = 30, dangerDays = 60 } = {},
): { level: AlertLevel; label: string } {
  if (!date) return { level: "rojo", label: "Sin actividad registrada" };
  const ago = -daysFromToday(date);
  if (ago > dangerDays) return { level: "rojo", label: `Sin actividad hace ${ago} días` };
  if (ago > warnDays) return { level: "amarillo", label: `Sin actividad hace ${ago} días` };
  return { level: "verde", label: "Actividad reciente" };
}

/** Entrega de un proyecto (ej. E-learning) según fecha de entrega y avance. */
export function deliveryAlert(fechaEntrega: string | undefined, avance: string | undefined): { level: AlertLevel; label: string } | null {
  if (!fechaEntrega) return null;
  if (Number(avance) >= 100) return { level: "verde", label: "Proyecto completado" };
  const d = daysFromToday(`${fechaEntrega}T00:00:00Z`);
  if (d < 0) return { level: "rojo", label: `Entrega atrasada ${-d} días` };
  if (d <= 7) return { level: "amarillo", label: d === 0 ? "Se entrega hoy" : `Entrega en ${d} días` };
  return { level: "verde", label: "Entrega a tiempo" };
}

/** Lead sin atender: amarillo el primer día, rojo después de 24 horas. */
export function leadAlert(receivedAt: Date | string, status: string | null): { level: AlertLevel; label: string } | null {
  if (status !== "NUEVO") return null;
  const hours = (Date.now() - new Date(receivedAt).getTime()) / 3600000;
  if (hours > 24) return { level: "rojo", label: `Sin atender hace ${Math.floor(hours / 24)} día${hours >= 48 ? "s" : ""}` };
  return { level: "amarillo", label: "Lead nuevo: atender hoy" };
}

/** Todas las alertas de un negocio y su estado general (la más grave). */
export function dealAlerts(d: {
  open: boolean;
  closeDate: Date | string | null;
  next: { dueDate: Date | string | null } | null;
  entrega?: string;
  avance?: string;
}) {
  const next = d.open ? nextActivityAlert(d.next?.dueDate ?? null, !!d.next) : null;
  const close = closeDateAlert(d.closeDate, d.open);
  const delivery = deliveryAlert(d.entrega, d.avance);
  return { next, close, delivery, health: worst(next?.level, close?.level, delivery?.level) };
}

/** Renovación de un negocio ganado: rojo si ya venció, amarillo si faltan 30 días o menos. */
export function renewalAlert(renewalDate: Date | string | null | undefined): { level: AlertLevel; label: string } | null {
  if (!renewalDate) return null;
  const d = daysFromToday(renewalDate);
  if (d < 0) return { level: "rojo", label: `Renovación vencida hace ${-d} días` };
  if (d <= 30) return { level: "amarillo", label: d === 0 ? "Renueva hoy" : `Renueva en ${d} días` };
  return { level: "verde", label: "Renovación a tiempo" };
}
