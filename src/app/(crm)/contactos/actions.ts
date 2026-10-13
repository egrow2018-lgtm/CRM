"use server";

import { revalidatePath } from "next/cache";
import { normalizePhone } from "@/lib/phone";
import type { LeadStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";

function contactData(form: FormData) {
  return {
    firstName: reqStr(form, "firstName", "Nombre"),
    lastName: str(form, "lastName"),
    email: str(form, "email")?.toLowerCase() ?? null,
    phone: normalizePhone(str(form, "phone")),
    jobTitle: str(form, "jobTitle"),
    source: str(form, "source"),
    notes: str(form, "notes"),
    companyId: str(form, "companyId"),
    ownerId: str(form, "ownerId"),
    leadStatus: (str(form, "leadStatus") as LeadStatus | null) ?? null,
  };
}

/** No se permiten dos contactos con el mismo correo. */
async function assertUniqueEmail(email: string | null, excludeId?: string) {
  if (!email) return;
  const other = await prisma.contact.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { firstName: true, lastName: true, company: { select: { name: true } } },
  });
  if (other) {
    const who = [other.firstName, other.lastName].filter(Boolean).join(" ");
    throw new Error(`Ya existe el contacto «${who}»${other.company ? ` (${other.company.name})` : ""} con el correo ${email}. Búscalo en Contactos en lugar de crearlo de nuevo.`);
  }
}

export async function createContact(_: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("contacts:write");
    const data = contactData(form);
    await assertUniqueEmail(data.email);
    const contact = await prisma.contact.create({ data: { ...data, ownerId: data.ownerId ?? user.id } });
    revalidatePath("/contactos");
    return `/contactos/${contact.id}`;
  });
}

export async function updateContact(id: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("contacts:write");
    const data = contactData(form);
    await assertUniqueEmail(data.email, id);
    await prisma.contact.update({ where: { id }, data });
    revalidatePath("/contactos");
    return `/contactos/${id}`;
  });
}

export async function deleteContact(id: string) {
  await requirePermission("contacts:delete");
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/contactos");
  redirect("/contactos");
}

/** Elimina varios contactos. */
export async function deleteContacts(ids: string[]) {
  try {
    await requirePermission("contacts:delete");
    const { count } = await prisma.contact.deleteMany({ where: { id: { in: ids.filter((x) => typeof x === "string").slice(0, 500) } } });
    revalidatePath("/contactos");
    return { deleted: count };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudieron eliminar." };
  }
}
