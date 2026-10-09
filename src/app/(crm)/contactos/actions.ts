"use server";

import { revalidatePath } from "next/cache";
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
    phone: str(form, "phone"),
    jobTitle: str(form, "jobTitle"),
    source: str(form, "source"),
    notes: str(form, "notes"),
    companyId: str(form, "companyId"),
    ownerId: str(form, "ownerId"),
    leadStatus: (str(form, "leadStatus") as LeadStatus | null) ?? null,
  };
}

export async function createContact(_: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("crm:write");
    const data = contactData(form);
    const contact = await prisma.contact.create({ data: { ...data, ownerId: data.ownerId ?? user.id } });
    revalidatePath("/contactos");
    return `/contactos/${contact.id}`;
  });
}

export async function updateContact(id: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("crm:write");
    await prisma.contact.update({ where: { id }, data: contactData(form) });
    revalidatePath("/contactos");
    return `/contactos/${id}`;
  });
}

export async function deleteContact(id: string) {
  await requirePermission("crm:delete");
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/contactos");
  redirect("/contactos");
}
