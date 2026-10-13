"use server";

import { revalidatePath } from "next/cache";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { num, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { checkZoomUser, zoomConfigured } from "@/lib/zoom";
import { saveCompanySettings } from "@/lib/settings";
import { emailConfigured, emailLayout, escapeHtml, sendEmail } from "@/lib/email";


export async function saveStage(id: string | null, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("pipeline:configure");
    const probability = Math.min(100, Math.max(0, Math.round(num(form, "probability") ?? 0)));
    const data = {
      name: reqStr(form, "name", "Nombre"),
      order: Math.round(num(form, "order") ?? 0),
      probability,
      isWon: str(form, "kind") === "won",
      isLost: str(form, "kind") === "lost",
    };
    if (id) await prisma.pipelineStage.update({ where: { id }, data });
    else await prisma.pipelineStage.create({ data });
    revalidatePath("/configuracion");
    revalidatePath("/negocios");
  });
}

export async function deleteStage(id: string) {
  await requirePermission("pipeline:configure");
  const count = await prisma.deal.count({ where: { stageId: id } });
  if (count > 0) throw new Error("No se puede eliminar una etapa con negocios. Muévelos primero.");
  await prisma.pipelineStage.delete({ where: { id } });
  revalidatePath("/configuracion");
  revalidatePath("/negocios");
}

export type ZoomTestState = { error?: string; results?: { name: string; email: string; status: string; ok: boolean }[] } | undefined;

/** Verifica las credenciales de Zoom y si cada usuario del CRM existe en la cuenta de Zoom. */
export async function testZoom(): Promise<ZoomTestState> {
  await requirePermission("pipeline:configure");
  if (!zoomConfigured()) return { error: "Faltan las variables ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID y ZOOM_CLIENT_SECRET." };
  try {
    const users = await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } });
    const results = [];
    for (const u of users) {
      const r = await checkZoomUser(u.email);
      results.push({
        name: u.name,
        email: u.email,
        ok: r.ok,
        status: r.ok
          ? r.licensed
            ? "Usuario con licencia: sus reuniones se crean a su nombre."
            : "Usuario básico: puede ser anfitrión, pero con límite de 40 min."
          : process.env.ZOOM_DEFAULT_HOST
            ? `No está en Zoom: sus reuniones se crearán con ${process.env.ZOOM_DEFAULT_HOST}.`
            : "No está en la cuenta de Zoom: agrégalo en Zoom o configura ZOOM_DEFAULT_HOST.",
      });
    }
    return { results };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo conectar con Zoom." };
  }
}

export async function saveCompany(_: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("pipeline:configure");
    await saveCompanySettings({
      name: reqStr(form, "name", "Nombre comercial"),
      legalName: str(form, "legalName") ?? "",
      taxId: str(form, "taxId") ?? "",
      address: str(form, "address") ?? "",
      phone: normalizePhone(str(form, "phone")) ?? "",
      email: str(form, "email") ?? "",
      website: str(form, "website") ?? "",
      ivaPercent: Math.min(100, Math.max(0, num(form, "ivaPercent") ?? 15)),
      validityDays: Math.min(365, Math.max(1, Math.round(num(form, "validityDays") ?? 15))),
      conditions: str(form, "conditions") ?? "",
    });
    revalidatePath("/configuracion");
  });
}

/** Envía un correo de prueba al administrador. */
export async function sendTestEmail() {
  return runAction(async () => {
    const me = await requirePermission("pipeline:configure");
    if (!emailConfigured()) throw new Error("Faltan RESEND_API_KEY y EMAIL_FROM.");
    await sendEmail({
      to: me.email,
      subject: "Prueba de correo del CRM de e-grow",
      html: emailLayout("¡El correo funciona!", `<p>Hola ${escapeHtml(me.name)}, este es un correo de prueba del CRM.</p>`),
    });
  });
}
