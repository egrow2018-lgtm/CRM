"use server";

import { revalidatePath } from "next/cache";
import type { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { date, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";

export type ActivityTarget = { dealId?: string; contactId?: string; companyId?: string };

const TYPES: ActivityType[] = ["NOTA", "LLAMADA", "REUNION", "EMAIL", "TAREA"];

/** Actualiza la "última actividad" del negocio y del contacto (incluido el contacto principal del negocio). */
async function touch(db: Prisma.TransactionClient, t: ActivityTarget) {
  const now = new Date();
  let contactId = t.contactId;
  if (t.dealId) {
    const deal = await db.deal.update({ where: { id: t.dealId }, data: { lastActivityAt: now } });
    contactId ??= deal.contactId ?? undefined;
  }
  if (contactId) await db.contact.update({ where: { id: contactId }, data: { lastActivityAt: now } });
}

function pathsFor(t: ActivityTarget) {
  return [
    t.dealId && `/negocios/${t.dealId}`,
    t.contactId && `/contactos/${t.contactId}`,
    t.companyId && `/empresas/${t.companyId}`,
    "/tareas",
    "/",
  ].filter(Boolean) as string[];
}

export async function createActivity(target: ActivityTarget, _: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("activities:write");
    const type = str(form, "type") as ActivityType;
    if (!TYPES.includes(type)) throw new Error("Tipo de actividad inválido.");
    const dueDate = date(form, "dueDate");
    const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
    // Las tareas, y las llamadas o reuniones con fecha de hoy en adelante, quedan pendientes (programadas)
    const pending = type === "TAREA" || ((type === "LLAMADA" || type === "REUNION") && !!dueDate && dueDate >= today);
    await prisma.$transaction(async (tx) => {
      await tx.activity.create({
        data: {
          type,
          subject: reqStr(form, "subject", "Asunto"),
          body: str(form, "body"),
          dueDate,
          assigneeId: pending ? (str(form, "assigneeId") ?? user.id) : null,
          completed: !pending,
          completedAt: pending ? null : new Date(),
          authorId: user.id,
          ...target,
        },
      });
      await touch(tx, target);
    });
    pathsFor(target).forEach((p) => revalidatePath(p));
  });
}

export async function toggleTask(id: string) {
  await requirePermission("activities:write");
  const a = await prisma.activity.findUniqueOrThrow({ where: { id } });
  const completed = !a.completed;
  await prisma.activity.update({ where: { id }, data: { completed, completedAt: completed ? new Date() : null } });
  if (completed) await touch(prisma, { dealId: a.dealId ?? undefined, contactId: a.contactId ?? undefined });
  pathsFor({ dealId: a.dealId ?? undefined, contactId: a.contactId ?? undefined, companyId: a.companyId ?? undefined }).forEach((p) =>
    revalidatePath(p),
  );
}

export async function deleteActivity(id: string) {
  const user = await requireUser();
  const a = await prisma.activity.findUniqueOrThrow({ where: { id } });
  if (a.authorId !== user.id && !can(user.role, "crm:delete")) throw new Error("Solo puedes eliminar tus propias actividades.");
  await prisma.activity.delete({ where: { id } });
  pathsFor({ dealId: a.dealId ?? undefined, contactId: a.contactId ?? undefined, companyId: a.companyId ?? undefined }).forEach((p) =>
    revalidatePath(p),
  );
}
