"use server";

import { revalidatePath } from "next/cache";
import type { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

function refresh(contactId: string) {
  ["/leads", "/contactos", `/contactos/${contactId}`, "/", "/tareas"].forEach((p) => revalidatePath(p));
}

/** Un usuario toma el lead: queda como propietario, pasa a "En seguimiento" y se le crea una tarea. */
export async function takeLead(contactId: string) {
  const user = await requirePermission("leads:take");
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await prisma.$transaction([
    prisma.contact.update({ where: { id: contactId }, data: { ownerId: user.id, leadStatus: "EN_SEGUIMIENTO" } }),
    prisma.activity.create({
      data: {
        type: "TAREA",
        subject: `Contactar a ${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ""}`,
        dueDate: new Date(`${tomorrow}T00:00:00Z`),
        contactId,
        assigneeId: user.id,
        authorId: user.id,
      },
    }),
    prisma.activity.create({ data: { type: "NOTA", subject: `${user.name} tomó el lead`, contactId, authorId: user.id } }),
  ]);
  refresh(contactId);
}

export async function setLeadStatus(contactId: string, status: LeadStatus) {
  const user = await requirePermission("leads:take");
  await prisma.contact.update({ where: { id: contactId }, data: { leadStatus: status } });
  await prisma.activity.create({
    data: { type: "NOTA", subject: `Estado del lead: ${status.replace("_", " ").toLowerCase()}`, contactId, authorId: user.id },
  });
  refresh(contactId);
}
