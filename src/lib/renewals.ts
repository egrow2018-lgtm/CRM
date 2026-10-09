import "server-only";
import type { Prisma } from "@prisma/client";
import { normalize } from "./csv";

/** Suma meses a una fecha (UTC, ajustando fin de mes). */
export function addMonths(date: Date, months: number) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return d;
}

/**
 * Al ganar un negocio: si tiene productos recurrentes (licencias, monitoreo…) y aún no tiene
 * fecha de renovación, se calcula con el plazo más corto de esos productos.
 */
export async function setRenewalOnWin(tx: Prisma.TransactionClient, dealId: string) {
  const deal = await tx.deal.findUniqueOrThrow({ where: { id: dealId }, include: { items: { include: { product: true } } } });
  if (deal.renewalDate) return;
  const months = deal.items.map((i) => i.product?.renewalMonths).filter((m): m is number => !!m && m > 0);
  if (months.length === 0) return;
  // Se cuenta desde el día en que se gana (la fecha de cierre planificada puede estar desactualizada)
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  await tx.deal.update({ where: { id: dealId }, data: { renewalDate: addMonths(today, Math.min(...months)) } });
}

/** Crea el negocio de renovación (copia productos, empresa, contacto y responsable) y una tarea de seguimiento. */
export async function createRenewalDeal(tx: Prisma.TransactionClient, dealId: string, authorId: string | null) {
  const deal = await tx.deal.findUniqueOrThrow({ where: { id: dealId }, include: { items: true } });
  if (!deal.renewalDate) throw new Error("El negocio no tiene fecha de renovación.");
  const stages = await tx.pipelineStage.findMany({ where: { isWon: false, isLost: false }, orderBy: { order: "asc" } });
  const stage = stages.find((s) => normalize(s.name).startsWith("cotiz")) ?? stages[0];
  if (!stage) throw new Error("No hay etapas abiertas en el pipeline.");
  const baseName = deal.name.replace(/^Renovación \d{4} – /, "");
  const renewal = await tx.deal.create({
    data: {
      name: `Renovación ${deal.renewalDate.getUTCFullYear()} – ${baseName}`,
      amount: deal.amount,
      currency: deal.currency,
      stageId: stage.id,
      businessLineId: deal.businessLineId,
      companyId: deal.companyId,
      contactId: deal.contactId,
      ownerId: deal.ownerId,
      closeDate: deal.renewalDate,
      renewalOfId: deal.id,
      description: `Renovación de "${deal.name}".`,
      items: {
        create: deal.items.map((i) => ({
          productId: i.productId,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
        })),
      },
    },
  });
  // Tarea para el responsable: 15 días antes de la renovación (o hoy si ya está cerca)
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const due = new Date(Math.max(today.getTime(), deal.renewalDate.getTime() - 15 * 86400000));
  await tx.activity.createMany({
    data: [
      { type: "NOTA", subject: `Negocio de renovación creado`, dealId: renewal.id, authorId, completed: true },
      { type: "NOTA", subject: `Se creó la renovación "${renewal.name}"`, dealId: deal.id, authorId, completed: true },
      ...(deal.ownerId
        ? [{ type: "TAREA" as const, subject: `Gestionar renovación con el cliente`, dueDate: due, dealId: renewal.id, assigneeId: deal.ownerId, authorId }]
        : []),
    ],
  });
  return renewal;
}
