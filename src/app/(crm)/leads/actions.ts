"use server";

import { revalidatePath } from "next/cache";
import type { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { LEAD_STATUS } from "@/lib/leads";

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

export async function setLeadStatus(contactId: string, status: LeadStatus | null) {
  const user = await requirePermission("leads:take");
  await prisma.contact.update({ where: { id: contactId }, data: { leadStatus: status } });
  await prisma.activity.create({
    data: {
      type: "NOTA",
      subject: `Estado del lead: ${status ? LEAD_STATUS[status].label : "sin estado"}`,
      contactId,
      authorId: user.id,
      completed: true,
    },
  });
  refresh(contactId);
}

/** Usado por el tablero de contactos (arrastrar y soltar). */
export async function moveContactStatus(contactId: string, status: LeadStatus | null): Promise<{ error?: string }> {
  try {
    await setLeadStatus(contactId, status);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cambiar el estado." };
  }
}
