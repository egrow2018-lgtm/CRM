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
import { parseEmails } from "@/lib/ics";
import { sendMeetingInvite } from "@/lib/meeting-invites";
import { emailConfigured } from "@/lib/email";

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
  if (completed) await prisma.$transaction((tx) => touch(tx, { dealId: a.dealId ?? undefined, contactId: a.contactId ?? undefined, companyId: a.companyId ?? undefined }));
  pathsFor({ dealId: a.dealId ?? undefined, contactId: a.contactId ?? undefined, companyId: a.companyId ?? undefined }).forEach((p) =>
    revalidatePath(p),
  );
}

export async function deleteActivity(id: string) {
  const user = await requireUser();
  const a = await prisma.activity.findUniqueOrThrow({ where: { id } });
  const isOwn = a.authorId === user.id || a.assigneeId === user.id;
  if (!isOwn && !(["contacts:delete", "companies:delete", "deals:delete"] as const).some((p) => can(user, p))) throw new Error("Solo puedes eliminar tus propias actividades.");
  // Si es una reunión de Zoom, también se cancela en Zoom
  if (a.zoomMeetingId) await deleteZoomMeeting(a.zoomMeetingId);
  // Si ya se había enviado la invitación, se avisa la cancelación (también quita el evento de los calendarios)
  if (a.type === "REUNION" && a.invitedAt && a.startAt && a.startAt > new Date()) {
    await sendMeetingInvite(a.id, "CANCEL").catch((e) => console.error("No se pudo enviar la cancelación", e));
  }
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
    const user = await requirePermission("meetings:schedule");
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
    // Modalidad: Zoom, presencial o en línea con otro enlace (Meet, Teams…)
    const mode = str(form, "mode") ?? (bool(form, "zoom") ? "zoom" : "online");
    const wantsZoom = mode === "zoom" && upcoming;
    const location = mode === "presencial" ? str(form, "location") : null;
    if (mode === "presencial" && !location) throw new Error("Indica el lugar de la reunión presencial.");
    const { emails: guests, invalid } = parseEmails(str(form, "guests"));
    if (invalid.length) throw new Error(`Revisa estos correos de invitados: ${invalid.join(", ")}`);
    if (wantsZoom && !zoomConfigured()) throw new Error("Zoom aún no está conectado. Pide al administrador que lo configure.");

    const zoom = wantsZoom
      ? await createZoomMeeting({ hostEmail: host.email, topic: subject, agenda: body, start: startAt, durationMinutes: duration })
      : null;
    const manualUrl = mode === "online" ? str(form, "meetingUrl") : null;
    if (manualUrl && !/^https?:\/\//i.test(manualUrl)) throw new Error("El enlace de la reunión debe empezar con https://");

    let activityId: string;
    try {
      activityId = await prisma.$transaction(async (tx) => {
        const created = await tx.activity.create({
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
            location,
            guests,
            assigneeId: hostId,
            authorId: user.id,
            completed: !upcoming,
            completedAt: upcoming ? null : new Date(),
            ...rel,
          },
        });
        await touch(tx, rel);
        return created.id;
      });
    } catch (e) {
      if (zoom) await deleteZoomMeeting(zoom.id).catch(() => undefined);
      throw e;
    }
    [...pathsFor(rel), "/agenda"].forEach((p) => revalidatePath(p));
    // Invitación por correo (con .ics) a los invitados, al anfitrión y a sus correos adicionales
    if (upcoming && bool(form, "sendInvite")) {
      if (!emailConfigured()) throw new Error("La reunión se creó, pero el correo aún no está configurado para enviar la invitación.");
      await sendMeetingInvite(activityId).catch((e) => {
        console.error(e);
        throw new Error("La reunión se creó, pero no se pudo enviar la invitación por correo. Usa «Reenviar invitación».");
      });
    }
  });
}

/** Vuelve a enviar la invitación de una reunión por correo (por ejemplo, tras agregar invitados). */
export async function resendInvite(id: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("meetings:schedule");
    if (!emailConfigured()) throw new Error("El correo aún no está configurado.");
    const { emails, invalid } = parseEmails(str(form, "guests"));
    if (invalid.length) throw new Error(`Revisa estos correos: ${invalid.join(", ")}`);
    const a = await prisma.activity.findUniqueOrThrow({ where: { id } });
    if (a.type !== "REUNION") throw new Error("Solo las reuniones tienen invitación.");
    await prisma.activity.update({ where: { id }, data: { guests: [...new Set([...a.guests, ...emails])] } });
    await sendMeetingInvite(id);
    revalidatePath("/agenda");
    [...pathsFor({ dealId: a.dealId ?? undefined, contactId: a.contactId ?? undefined, companyId: a.companyId ?? undefined })].forEach((p) => revalidatePath(p));
  });
}

/**
 * Edita una tarea o llamada pendiente (asunto, detalle, fecha, responsable).
 * Si cambia la fecha hay que indicar el motivo: queda en el detalle de la tarea y en el historial.
 */
export async function updateTask(id: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("activities:write");
    const a = await prisma.activity.findUniqueOrThrow({ where: { id } });
    if (a.type !== "TAREA" && a.type !== "LLAMADA") throw new Error("Solo se pueden editar tareas y llamadas.");
    const subject = reqStr(form, "subject", "Asunto");
    const dueDate = date(form, "dueDate");
    const reason = str(form, "reason");
    const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
    const moved = day(a.dueDate) !== day(dueDate);
    if (moved && !reason) throw new Error("Indica el motivo del cambio de fecha (ej. «El cliente pidió reunirse el viernes»).");
    const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : "sin fecha");
    const change = moved ? `↻ Reprogramada del ${fmt(a.dueDate)} al ${fmt(dueDate)}: ${reason}` : reason ? `✎ ${reason}` : null;
    const body = [str(form, "body"), change].filter(Boolean).join("\n") || null;
    const assigneeId = form.has("assigneeId") ? (str(form, "assigneeId") ?? user.id) : a.assigneeId;
    await prisma.$transaction(async (tx) => {
      await tx.activity.update({ where: { id }, data: { subject, body, dueDate, assigneeId } });
      // El cambio de fecha también queda en el historial del negocio, contacto o empresa
      if (moved && (a.dealId || a.contactId || a.companyId)) {
        await tx.activity.create({
          data: {
            type: "NOTA",
            subject: `Tarea «${subject}» reprogramada del ${fmt(a.dueDate)} al ${fmt(dueDate)}`,
            body: `Motivo: ${reason}`,
            completed: true,
            completedAt: new Date(),
            authorId: user.id,
            dealId: a.dealId,
            contactId: a.contactId,
            companyId: a.companyId,
          },
        });
      }
    });
    pathsFor({ dealId: a.dealId ?? undefined, contactId: a.contactId ?? undefined, companyId: a.companyId ?? undefined }).forEach((p) => revalidatePath(p));
  });
}
