"use server";

import { revalidatePath } from "next/cache";
import type { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { bool, date, num, reqStr, str, type ActionState } from "@/lib/forms";
import { zonedToUtc } from "@/lib/timezone";
import { createZoomMeeting, deleteZoomMeeting, zoomConfigured } from "@/lib/zoom";
import { runAction } from "@/lib/run-action";

export type ActivityTarget = { dealId?: string; contactId?: string; companyId?: string };

const TYPES: ActivityType[] = ["NOTA", "LLAMADA", "REUNION", "EMAIL", "TAREA"];

/** Actualiza la "última actividad" del negocio, del contacto (incluido el principal del negocio) y de su empresa. */
async function touch(db: Prisma.TransactionClient, t: ActivityTarget) {
  const now = new Date();
  let contactId = t.contactId;
  let companyId = t.companyId;
  if (t.dealId) {
    const deal = await db.deal.update({ where: { id: t.dealId }, data: { lastActivityAt: now } });
    contactId ??= deal.contactId ?? undefined;
    companyId ??= deal.companyId ?? undefined;
  }
  if (contactId) {
    const contact = await db.contact.update({ where: { id: contactId }, data: { lastActivityAt: now } });
    companyId ??= contact.companyId ?? undefined;
  }
  if (companyId) await db.company.update({ where: { id: companyId }, data: { lastActivityAt: now } });
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
  if (completed) await touch(prisma, { dealId: a.dealId ?? undefined, contactId: a.contactId ?? undefined, companyId: a.companyId ?? undefined });
  pathsFor({ dealId: a.dealId ?? undefined, contactId: a.contactId ?? undefined, companyId: a.companyId ?? undefined }).forEach((p) =>
    revalidatePath(p),
  );
}

export async function deleteActivity(id: string) {
  const user = await requireUser();
  const a = await prisma.activity.findUniqueOrThrow({ where: { id } });
  const isOwn = a.authorId === user.id || a.assigneeId === user.id;
  if (!isOwn && !can(user.role, "crm:delete")) throw new Error("Solo puedes eliminar tus propias actividades.");
  // Si es una reunión de Zoom, también se cancela en Zoom
  if (a.zoomMeetingId) await deleteZoomMeeting(a.zoomMeetingId);
  await prisma.activity.delete({ where: { id } });
  if (a.type === "REUNION" && !a.completed) {
    await prisma.activity.create({
      data: {
        type: "NOTA",
        subject: `Reunión cancelada: ${a.subject}`,
        completed: true,
        authorId: user.id,
        dealId: a.dealId,
        contactId: a.contactId,
        companyId: a.companyId,
      },
    });
  }
  [...pathsFor({ dealId: a.dealId ?? undefined, contactId: a.contactId ?? undefined, companyId: a.companyId ?? undefined }), "/agenda"].forEach(
    (p) => revalidatePath(p),
  );
}

/**
 * Agenda una reunión (opcionalmente con Zoom). Si viene de la Agenda, la relación con
 * negocio, contacto o empresa llega en el formulario.
 */
export async function scheduleMeeting(target: ActivityTarget, _: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("activities:write");
    const rel: ActivityTarget = {
      dealId: target.dealId ?? str(form, "dealId") ?? undefined,
      contactId: target.contactId ?? str(form, "contactId") ?? undefined,
      companyId: target.companyId ?? str(form, "companyId") ?? undefined,
    };
    const subject = reqStr(form, "subject", "Tema de la reunión");
    const day = reqStr(form, "date", "Fecha");
    const time = reqStr(form, "time", "Hora");
    const duration = Math.min(480, Math.max(15, Math.round(num(form, "duration") ?? 30)));
    const startAt = zonedToUtc(day, time);
    const body = str(form, "body");
    const hostId = str(form, "assigneeId") ?? user.id;
    const host = await prisma.user.findUniqueOrThrow({ where: { id: hostId } });
    const upcoming = startAt.getTime() + duration * 60000 > Date.now();
    const wantsZoom = bool(form, "zoom") && upcoming;
    if (wantsZoom && !zoomConfigured()) throw new Error("Zoom aún no está conectado. Pide al administrador que lo configure.");

    const zoom = wantsZoom
      ? await createZoomMeeting({ hostEmail: host.email, topic: subject, agenda: body, start: startAt, durationMinutes: duration })
      : null;
    const manualUrl = str(form, "meetingUrl");
    if (manualUrl && !/^https?:\/\//i.test(manualUrl)) throw new Error("El enlace de la reunión debe empezar con https://");

    try {
      await prisma.$transaction(async (tx) => {
        await tx.activity.create({
          data: {
            type: "REUNION",
            subject,
            body,
            dueDate: new Date(`${day}T00:00:00Z`),
            startAt,
            durationMinutes: duration,
            meetingUrl: zoom?.joinUrl ?? manualUrl,
            hostUrl: zoom?.startUrl ?? null,
            meetingPassword: zoom?.password ?? null,
            zoomMeetingId: zoom?.id ?? null,
            assigneeId: hostId,
            authorId: user.id,
            completed: !upcoming,
            completedAt: upcoming ? null : new Date(),
            ...rel,
          },
        });
        await touch(tx, rel);
      });
    } catch (e) {
      if (zoom) await deleteZoomMeeting(zoom.id).catch(() => undefined);
      throw e;
    }
    [...pathsFor(rel), "/agenda"].forEach((p) => revalidatePath(p));
  });
}
