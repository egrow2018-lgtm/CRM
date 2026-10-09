"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
import { can, canMoveDeal } from "@/lib/permissions";
import { date, num, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { parseCustomData, parseCustomFields } from "@/lib/custom-fields";
import { createRenewalDeal, setRenewalOnWin } from "@/lib/renewals";

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
    renewalDate: date(form, "renewalDate"),
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
    // Un lead que pasa a negocio queda como calificado
    if (data.contactId) {
      await prisma.contact.updateMany({
        where: { id: data.contactId, leadStatus: { in: ["NUEVO", "EN_SEGUIMIENTO"] } },
        data: { leadStatus: "CALIFICADO" },
      });
    }
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
      if (current.stageId !== data.stageId) {
        await logStageChange(tx, id, current.stageId, data.stageId, user.id);
        await onStageChanged(tx, id, data.stageId);
      }
    });
    revalidatePath("/negocios");
    return `/negocios/${id}`;
  });
}

/** Al pasar a ganado se calcula la fecha de renovación de los productos recurrentes. */
async function onStageChanged(tx: Prisma.TransactionClient, dealId: string, stageId: string) {
  const stage = await tx.pipelineStage.findUnique({ where: { id: stageId } });
  if (stage?.isWon) await setRenewalOnWin(tx, dealId);
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
    await onStageChanged(tx, dealId, stageId);
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

/** Guarda los campos adicionales de la línea de negocio (ej. datos del proyecto E-learning). */
export async function updateDealCustomData(dealId: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    if (!can(user.role, "crm:write") && !can(user.role, "deals:production")) {
      throw new Error("No tienes permisos para editar los datos del proyecto.");
    }
    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId }, include: { businessLine: true } });
    const fields = parseCustomFields(deal.businessLine?.customFields);
    const data: Record<string, string> = { ...parseCustomData(deal.customData) };
    for (const f of fields) {
      const v = str(form, `cf_${f.key}`);
      if (v && f.type === "number" && !Number.isFinite(Number(v.replace(",", ".")))) {
        throw new Error(`"${f.label}" debe ser un número.`);
      }
      if (v) data[f.key] = f.type === "number" ? String(Number(v.replace(",", "."))) : v;
      else delete data[f.key];
    }
    await prisma.deal.update({ where: { id: dealId }, data: { customData: data } });
    revalidatePath(`/negocios/${dealId}`);
    revalidatePath("/negocios");
  });
}

/** Crea ahora el negocio de renovación (sin esperar el aviso automático). */
export async function createRenewalNow(dealId: string) {
  const user = await requirePermission("crm:write");
  const existing = await prisma.deal.count({ where: { renewalOfId: dealId } });
  if (existing > 0) throw new Error("Este negocio ya tiene un negocio de renovación.");
  const renewal = await prisma.$transaction((tx) => createRenewalDeal(tx, dealId, user.id));
  revalidatePath("/negocios");
  revalidatePath("/");
  redirect(`/negocios/${renewal.id}`);
}
