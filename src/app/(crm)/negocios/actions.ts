"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
import { can, canMoveDeal } from "@/lib/permissions";
import { date, num, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";

function dealData(form: FormData) {
  return {
    name: reqStr(form, "name", "Nombre del negocio"),
    stageId: reqStr(form, "stageId", "Etapa"),
    businessLineId: str(form, "businessLineId"),
    companyId: str(form, "companyId"),
    contactId: str(form, "contactId"),
    ownerId: str(form, "ownerId"),
    closeDate: date(form, "closeDate"),
    description: str(form, "description"),
    lostReason: str(form, "lostReason"),
  };
}

export async function createDeal(_: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("crm:write");
    const data = dealData(form);
    const deal = await prisma.deal.create({
      data: {
        ...data,
        ownerId: data.ownerId ?? user.id,
        amount: num(form, "amount") ?? 0,
        activities: { create: { type: "NOTA", subject: "Negocio creado", authorId: user.id } },
      },
    });
    revalidatePath("/negocios");
    return `/negocios/${deal.id}`;
  });
}

export async function updateDeal(id: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("crm:write");
    const data = dealData(form);
    const current = await prisma.deal.findUniqueOrThrow({ where: { id }, include: { _count: { select: { items: true } } } });
    await prisma.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id },
        data: {
          ...data,
          // Si el negocio tiene productos, el valor se calcula a partir de ellos.
          ...(current._count.items === 0 ? { amount: num(form, "amount") ?? 0 } : {}),
          ...(current.stageId !== data.stageId ? { stageChangedAt: new Date() } : {}),
        },
      });
      if (current.stageId !== data.stageId) await logStageChange(tx, id, current.stageId, data.stageId, user.id);
    });
    revalidatePath("/negocios");
    return `/negocios/${id}`;
  });
}

async function logStageChange(tx: Prisma.TransactionClient, dealId: string, fromId: string, toId: string, userId: string) {
  const stages = await tx.pipelineStage.findMany({ where: { id: { in: [fromId, toId] } } });
  const name = (id: string) => stages.find((s) => s.id === id)?.name ?? "?";
  await tx.activity.create({
    data: { type: "CAMBIO_ETAPA", subject: `Etapa: ${name(fromId)} → ${name(toId)}`, dealId, authorId: userId },
  });
}

/** Usado por el tablero Kanban (arrastrar y soltar) y por la barra de etapas del detalle. */
export async function moveDeal(dealId: string, stageId: string): Promise<ActionState> {
  const user = await requireUser();
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { stage: true } });
  const target = await prisma.pipelineStage.findUnique({ where: { id: stageId } });
  if (!deal || !target) return { error: "Negocio o etapa no encontrada." };
  if (deal.stageId === stageId) return { ok: true };
  if (!canMoveDeal(user.role, deal.stage, target)) {
    return { error: "Tu perfil solo puede mover negocios entre Firma de Contrato, Producción y Ganado." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.deal.update({ where: { id: dealId }, data: { stageId, stageChangedAt: new Date() } });
    await logStageChange(tx, dealId, deal.stageId, stageId, user.id);
  });
  revalidatePath("/negocios");
  revalidatePath(`/negocios/${dealId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteDeal(id: string) {
  await requirePermission("crm:delete");
  await prisma.deal.delete({ where: { id } });
  revalidatePath("/negocios");
  redirect("/negocios");
}

async function recalcAmount(tx: Prisma.TransactionClient, dealId: string) {
  const items = await tx.dealItem.findMany({ where: { dealId } });
  const total = items.reduce(
    (sum, i) => sum + Number(i.quantity) * Number(i.unitPrice) * (1 - Number(i.discount) / 100),
    0,
  );
  await tx.deal.update({ where: { id: dealId }, data: { amount: Math.round(total * 100) / 100 } });
}

export async function addDealItem(dealId: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    if (!can(user.role, "crm:write")) throw new Error("No tienes permisos para editar productos del negocio.");
    const productId = str(form, "productId");
    const product = productId ? await prisma.product.findUnique({ where: { id: productId } }) : null;
    const description = str(form, "description") ?? product?.name;
    if (!description) throw new Error("Selecciona un producto o escribe una descripción.");
    const quantity = num(form, "quantity") ?? 1;
    const unitPrice = num(form, "unitPrice") ?? Number(product?.unitPrice ?? 0);
    const discount = Math.min(100, Math.max(0, num(form, "discount") ?? 0));
    await prisma.$transaction(async (tx) => {
      await tx.dealItem.create({ data: { dealId, productId: product?.id, description, quantity, unitPrice, discount } });
      await recalcAmount(tx, dealId);
    });
    revalidatePath(`/negocios/${dealId}`);
    revalidatePath("/negocios");
  });
}

export async function removeDealItem(itemId: string) {
  const user = await requireUser();
  if (!can(user.role, "crm:write")) throw new Error("No tienes permisos.");
  const item = await prisma.dealItem.delete({ where: { id: itemId } });
  await prisma.$transaction((tx) => recalcAmount(tx, item.dealId));
  revalidatePath(`/negocios/${item.dealId}`);
  revalidatePath("/negocios");
}
