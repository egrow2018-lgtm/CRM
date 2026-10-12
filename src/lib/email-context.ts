import "server-only";
import { prisma } from "./db";
import type { TemplateValues } from "./email-compose";
import { senderFor } from "./email-compose";

/** Datos para las variables de las plantillas ({{nombre}}, {{empresa}}…) a partir del contacto y el negocio. */
export async function templateValues(p: {
  contactId?: string | null;
  dealId?: string | null;
  user: { name: string; email: string; senderEmail?: string | null };
}): Promise<TemplateValues & { companyId: string | null; contactEmail: string | null }> {
  const deal = p.dealId
    ? await prisma.deal.findUnique({ where: { id: p.dealId }, select: { name: true, contactId: true, companyId: true, company: { select: { name: true } } } })
    : null;
  const contactId = p.contactId ?? deal?.contactId ?? null;
  const contact = contactId
    ? await prisma.contact.findUnique({ where: { id: contactId }, select: { firstName: true, lastName: true, jobTitle: true, email: true, companyId: true, company: { select: { name: true } } } })
    : null;
  const sender = senderFor(p.user, process.env.EMAIL_FROM ?? "");
  return {
    nombre: contact?.firstName ?? null,
    apellido: contact?.lastName ?? null,
    nombre_completo: contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") : null,
    empresa: contact?.company?.name ?? deal?.company?.name ?? null,
    cargo: contact?.jobTitle ?? null,
    negocio: deal?.name ?? null,
    vendedor: p.user.name,
    mi_correo: sender.replyTo,
    companyId: contact?.companyId ?? deal?.companyId ?? null,
    contactEmail: contact?.email ?? null,
  };
}
