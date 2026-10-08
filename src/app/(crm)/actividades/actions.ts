"use server";

import { revalidatePath } from "next/cache";
import type { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { date, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";

export type ActivityTarget = { dealId?: string; contactId?: string; companyId?: string };

const TYPES: ActivityType[] = ["NOTA", "LLAMADA", "REUNION", "EMAIL", "TAREA"];

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
    const isTask = type === "TAREA";
    await prisma.$transaction(async (tx) => {
      await tx.activity.create({
        data: {
          type,
          subject: reqStr(form, "subject", "Asunto"),
          body: str(form, "body"),
          dueDate: date(form, "dueDate"),
          assigneeId: isTask ? (str(form, "assigneeId") ?? user.id) : null,
          completed: !isTask,
          completedAt: isTask ? null : new Date(),
          authorId: user.id,
          ...target,
        },
      });
      if (target.dealId) await tx.deal.update({ where: { id: target.dealId }, data: { lastActivityAt: new Date() } });
    });
    pathsFor(target).forEach((p) => revalidatePath(p));
  });
}

export async function toggleTask(id: string) {
  await requirePermission("activities:write");
  const a = await prisma.activity.findUniqueOrThrow({ where: { id } });
  const completed = !a.completed;
  await prisma.activity.update({ where: { id }, data: { completed, completedAt: completed ? new Date() : null } });
  if (completed && a.dealId) await prisma.deal.update({ where: { id: a.dealId }, data: { lastActivityAt: new Date() } });
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
