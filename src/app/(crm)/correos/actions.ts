"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { appUrl, emailConfigured, type EmailBrand } from "@/lib/email";
import { sendClientEmail } from "@/lib/client-email";
import { fillTemplate, fromEditable, splitEmails } from "@/lib/email-compose";
import { templateValues } from "@/lib/email-context";
import { lineBrand } from "@/lib/brand";

export async function sendEmailAction(_: ActionState, form: FormData) {
  return runAction(async () => {
    const current = await requirePermission("emails:send");
    if (!emailConfigured()) throw new Error("El correo aún no está configurado (RESEND_API_KEY y EMAIL_FROM).");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: current.id } });
    const to = splitEmails(reqStr(form, "to", "Para"));
    const cc = splitEmails(str(form, "cc") ?? "");
    let contactId = str(form, "contactId");
    const dealId = str(form, "dealId");
    let companyId = str(form, "companyId");

    // Si no viene de un contacto, se busca por el correo del destinatario
    if (!contactId) {
      const found = await prisma.contact.findFirst({ where: { email: { equals: to[0], mode: "insensitive" } }, select: { id: true, companyId: true } });
      if (found) {
        contactId = found.id;
        companyId ??= found.companyId;
      }
    }
    const values = await templateValues({ contactId, dealId, user });
    companyId ??= values.companyId;

    const [docs, images] = await Promise.all([
      prisma.document.findMany({ select: { id: true, name: true } }),
      prisma.emailImage.findMany({ select: { id: true, name: true } }),
    ]);
    const subject = fillTemplate(reqStr(form, "subject", "Asunto"), values);
    const body = fillTemplate(fromEditable(String(form.get("body") ?? ""), docs, images), values);

    const brandChoice = str(form, "brand");
    let brand: EmailBrand | "egrow" | null = null;
    if (brandChoice === "egrow") brand = "egrow";
    else if (brandChoice) {
      const line = await prisma.businessLine.findUnique({ where: { id: brandChoice } });
      const b = line && lineBrand(line);
      if (b) brand = { name: b.name, primary: b.primary, accent: b.accent, logoUrl: `${appUrl()}/api/logo/linea/${line.id}` };
    }

    const id = await sendClientEmail({
      user,
      to,
      cc,
      subject,
      body,
      contactId,
      dealId,
      companyId,
      templateId: str(form, "templateId"),
      brand,
    });
    if (contactId) revalidatePath(`/contactos/${contactId}`);
    if (dealId) revalidatePath(`/negocios/${dealId}`);
    revalidatePath("/correos");
    return `/correos/${id}?enviado=1`;
  });
}

export async function saveTemplate(id: string | null, _: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("docs:manage");
    const [docs, images] = await Promise.all([
      prisma.document.findMany({ select: { id: true, name: true } }),
      prisma.emailImage.findMany({ select: { id: true, name: true } }),
    ]);
    const data = {
      name: reqStr(form, "name", "Nombre de la plantilla").slice(0, 120),
      subject: reqStr(form, "subject", "Asunto").slice(0, 200),
      body: fromEditable(reqStr(form, "body", "Mensaje"), docs, images),
      businessLineId: str(form, "businessLineId"),
    };
    if (id) await prisma.emailTemplate.update({ where: { id }, data });
    else await prisma.emailTemplate.create({ data: { ...data, createdById: user.id } });
    revalidatePath("/correos/plantillas");
    return "/correos/plantillas";
  });
}

export async function deleteTemplate(id: string) {
  await requirePermission("docs:manage");
  await prisma.emailTemplate.delete({ where: { id } });
  revalidatePath("/correos/plantillas");
  redirect("/correos/plantillas");
}

/** Borra correos del registro (el historial del contacto conserva la actividad, sin seguimiento). */
export async function deleteEmails(ids: string[]) {
  try {
    const user = await requirePermission("emails:send");
    const all = can(user, "docs:manage");
    const { count } = await prisma.emailMessage.deleteMany({
      where: { id: { in: ids.filter((x) => typeof x === "string").slice(0, 500) }, ...(all ? {} : { fromUserId: user.id }) },
    });
    revalidatePath("/correos");
    return { deleted: count };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudieron eliminar." };
  }
}

/** Sube una imagen para usarla en correos y plantillas (ya reducida en el navegador). */
export async function uploadEmailImage(input: { name: string; data: string; width?: number; height?: number }) {
  try {
    const user = await requirePermission("emails:send");
    const m = /^data:(image\/(?:png|jpeg|gif));base64,([A-Za-z0-9+/=]+)$/.exec(input.data ?? "");
    if (!m) throw new Error("Usa una imagen PNG, JPG o GIF.");
    const bytes = Buffer.from(m[2]!, "base64");
    if (bytes.length > 1_500_000) throw new Error("La imagen pesa más de 1,5 MB incluso reducida. Prueba con otra.");
    // Nombre único (en el editor la imagen se identifica por su nombre)
    const base = (input.name || "imagen").replace(/[\]\n→\[]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "imagen";
    const taken = new Set((await prisma.emailImage.findMany({ where: { name: { startsWith: base } }, select: { name: true } })).map((i) => i.name));
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base} (${n})`;
    const img = await prisma.emailImage.create({
      data: { name, mimeType: m[1]!, data: bytes, width: input.width ?? null, height: input.height ?? null, createdById: user.id },
      select: { id: true, name: true },
    });
    return img;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo subir la imagen." };
  }
}
