"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { emailConfigured, type EmailBrand } from "@/lib/email";
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

    const docs = await prisma.document.findMany({ select: { id: true, name: true } });
    const subject = fillTemplate(reqStr(form, "subject", "Asunto"), values);
    const body = fillTemplate(fromEditable(String(form.get("body") ?? ""), docs), values);

    const brandChoice = str(form, "brand");
    let brand: EmailBrand | "egrow" | null = null;
    if (brandChoice === "egrow") brand = "egrow";
    else if (brandChoice) {
      const line = await prisma.businessLine.findUnique({ where: { id: brandChoice } });
      const b = line && lineBrand(line);
      if (b) brand = { name: b.name, primary: b.primary, accent: b.accent };
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
    const docs = await prisma.document.findMany({ select: { id: true, name: true } });
    const data = {
      name: reqStr(form, "name", "Nombre de la plantilla").slice(0, 120),
      subject: reqStr(form, "subject", "Asunto").slice(0, 200),
      body: fromEditable(reqStr(form, "body", "Mensaje"), docs),
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
