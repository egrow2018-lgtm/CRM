"use server";

import { revalidatePath } from "next/cache";
import { normalizePhone } from "@/lib/phone";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { findCompanyDuplicate } from "@/lib/duplicates";

function companyData(form: FormData) {
  return {
    name: reqStr(form, "name", "Nombre"),
    taxId: str(form, "taxId"),
    industry: str(form, "industry"),
    website: str(form, "website"),
    phone: normalizePhone(str(form, "phone")),
    address: str(form, "address"),
    city: str(form, "city"),
    country: str(form, "country"),
    notes: str(form, "notes"),
    ownerId: str(form, "ownerId"),
  };
}

/** No se permiten dos empresas con el mismo RUC o el mismo sitio web. */
async function assertNoDuplicate(data: { taxId: string | null; website: string | null }, excludeId?: string) {
  if (!data.taxId && !data.website) return;
  const companies = await prisma.company.findMany({
    where: { OR: [{ taxId: { not: null } }, { website: { not: null } }] },
    select: { id: true, name: true, taxId: true, website: true },
  });
  const dup = findCompanyDuplicate(data, companies, excludeId);
  if (dup) {
    throw new Error(
      `Ya existe la empresa «${dup.company.name}» con ${dup.reason === "ruc" ? `el RUC ${dup.company.taxId}` : `el sitio web ${dup.company.website}`}. ` +
        "Búscala en Empresas en lugar de crearla de nuevo.",
    );
  }
}

/** Contactos elegidos en el formulario para vincularlos a la empresa. */
function contactIds(form: FormData) {
  return form
    .getAll("contactIds")
    .filter((v): v is string => typeof v === "string" && !!v)
    .slice(0, 500);
}

export async function createCompany(_: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("companies:write");
    const data = companyData(form);
    await assertNoDuplicate(data);
    const ids = contactIds(form);
    const company = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({ data: { ...data, ownerId: data.ownerId ?? user.id } });
      if (ids.length) await tx.contact.updateMany({ where: { id: { in: ids } }, data: { companyId: created.id } });
      return created;
    });
    revalidatePath("/empresas");
    revalidatePath("/contactos");
    return `/empresas/${company.id}`;
  });
}

/** Vincula contactos existentes a la empresa (por ejemplo, los que quedaron sin empresa). */
export async function linkContacts(companyId: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("contacts:write");
    const ids = contactIds(form);
    if (!ids.length) throw new Error("Elige al menos un contacto.");
    await prisma.contact.updateMany({ where: { id: { in: ids } }, data: { companyId } });
    revalidatePath(`/empresas/${companyId}`);
    revalidatePath("/contactos");
  });
}

export async function updateCompany(id: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("companies:write");
    const data = companyData(form);
    await assertNoDuplicate(data, id);
    await prisma.company.update({ where: { id }, data });
    revalidatePath("/empresas");
    return `/empresas/${id}`;
  });
}

export async function deleteCompany(id: string) {
  await requirePermission("companies:delete");
  await prisma.company.delete({ where: { id } });
  revalidatePath("/empresas");
  redirect("/empresas");
}

const MERGE_FIELDS = ["taxId", "industry", "website", "phone", "address", "city", "country", "ownerId"] as const;

/** Une `sourceId` dentro de `targetId`: pasa contactos, negocios y actividades, completa datos vacíos y elimina el duplicado. */
export async function mergeCompany(targetId: string, sourceId: string) {
  await requirePermission("companies:delete");
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

/** Elimina varias empresas (sus contactos y negocios quedan sin empresa). */
export async function deleteCompanies(ids: string[]) {
  try {
    await requirePermission("companies:delete");
    const { count } = await prisma.company.deleteMany({ where: { id: { in: ids.filter((x) => typeof x === "string").slice(0, 500) } } });
    revalidatePath("/empresas");
    return { deleted: count };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudieron eliminar." };
  }
}
