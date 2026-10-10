"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";

function companyData(form: FormData) {
  return {
    name: reqStr(form, "name", "Nombre"),
    taxId: str(form, "taxId"),
    industry: str(form, "industry"),
    website: str(form, "website"),
    phone: str(form, "phone"),
    address: str(form, "address"),
    city: str(form, "city"),
    country: str(form, "country"),
    notes: str(form, "notes"),
    ownerId: str(form, "ownerId"),
  };
}

export async function createCompany(_: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("crm:write");
    const data = companyData(form);
    const company = await prisma.company.create({ data: { ...data, ownerId: data.ownerId ?? user.id } });
    revalidatePath("/empresas");
    return `/empresas/${company.id}`;
  });
}

export async function updateCompany(id: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("crm:write");
    await prisma.company.update({ where: { id }, data: companyData(form) });
    revalidatePath("/empresas");
    return `/empresas/${id}`;
  });
}

export async function deleteCompany(id: string) {
  await requirePermission("crm:delete");
  await prisma.company.delete({ where: { id } });
  revalidatePath("/empresas");
  redirect("/empresas");
}

const MERGE_FIELDS = ["taxId", "industry", "website", "phone", "address", "city", "country", "ownerId"] as const;

/** Une `sourceId` dentro de `targetId`: pasa contactos, negocios y actividades, completa datos vacíos y elimina el duplicado. */
export async function mergeCompany(targetId: string, sourceId: string) {
  await requirePermission("crm:delete");
  if (targetId === sourceId) return;
  await prisma.$transaction(async (tx) => {
    const [target, source] = await Promise.all([
      tx.company.findUniqueOrThrow({ where: { id: targetId } }),
      tx.company.findUniqueOrThrow({ where: { id: sourceId } }),
    ]);
    const data: Record<string, unknown> = {};
    for (const f of MERGE_FIELDS) if (!target[f] && source[f]) data[f] = source[f];
    if (source.notes && source.notes !== target.notes) data.notes = [target.notes, source.notes].filter(Boolean).join("\n\n");
    if (source.createdAt < target.createdAt) data.createdAt = source.createdAt;
    await tx.contact.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
    await tx.deal.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
    await tx.activity.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } });
    await tx.company.update({ where: { id: targetId }, data });
    await tx.company.delete({ where: { id: sourceId } });
  });
  revalidatePath("/empresas");
  redirect(`/empresas/${targetId}`);
}
