import "server-only";
import type { Form, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { companyKey, corporateDomain, websiteDomain } from "./csv";
import { parseFormFields, type FormField } from "./forms-builder";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class LeadValidationError extends Error {}

/** Lee y valida las respuestas del formulario. */
export function readAnswers(fields: FormField[], form: FormData) {
  const answers: Record<string, string> = {};
  for (const f of fields) {
    const raw = form.get(f.key);
    let value = f.type === "checkbox" ? (raw === "on" ? "Sí" : "") : typeof raw === "string" ? raw.trim().slice(0, 5000) : "";
    if (f.type === "select" && value && !(f.options ?? []).includes(value)) value = "";
    if (f.required && !value) throw new LeadValidationError(`Completa el campo "${f.label}".`);
    if (value && f.type === "email" && !EMAIL_RE.test(value)) throw new LeadValidationError("Escribe un email válido.");
    if (value) answers[f.key] = value;
  }
  return answers;
}

/**
 * Registra una respuesta: crea o actualiza el contacto (por email), lo asocia a su empresa,
 * deja una nota con las respuestas y lo envía a la bandeja de leads o al usuario asignado.
 */
export async function captureLead(form: Form, answers: Record<string, string>) {
  const fields = parseFormFields(form.fields);
  const mapped = (m: FormField["map"]) => {
    const f = fields.find((x) => x.map === m);
    return f ? answers[f.key] : undefined;
  };
  const email = mapped("email")?.toLowerCase();
  const firstName = mapped("firstName") ?? email?.split("@")[0] ?? "Lead";
  const companyName = mapped("company");
  const summary = fields
    .filter((f) => answers[f.key])
    .map((f) => `${f.label}: ${answers[f.key]}`)
    .join("\n");

  return prisma.$transaction(async (tx) => {
    // Empresa: por dominio corporativo del email o por nombre; si no existe y la escribió, se crea
    let companyId: string | null = null;
    const domain = corporateDomain(email);
    if (domain || companyName) {
      const companies = await tx.company.findMany({ select: { id: true, name: true, website: true } });
      companyId =
        (domain && companies.find((c) => websiteDomain(c.website) === domain)?.id) ||
        (companyName && companies.find((c) => companyKey(c.name) === companyKey(companyName))?.id) ||
        null;
      if (!companyId && companyName) {
        companyId = (await tx.company.create({ data: { name: companyName, ownerId: form.assigneeId } })).id;
      }
    }

    const existing = email ? await tx.contact.findFirst({ where: { email } }) : null;
    let contactId: string;
    if (existing) {
      // No se sobrescriben datos existentes; solo se completan los vacíos
      const patch: Prisma.ContactUncheckedUpdateInput = {};
      if (!existing.lastName && mapped("lastName")) patch.lastName = mapped("lastName");
      if (!existing.phone && mapped("phone")) patch.phone = mapped("phone");
      if (!existing.jobTitle && mapped("jobTitle")) patch.jobTitle = mapped("jobTitle");
      if (!existing.companyId && companyId) patch.companyId = companyId;
      if (!existing.ownerId && form.assigneeId) patch.ownerId = form.assigneeId;
      patch.lastActivityAt = new Date();
      // Si estaba descartado o sin estado, vuelve a la bandeja
      if (!existing.leadStatus || existing.leadStatus === "DESCARTADO") {
        patch.leadStatus = existing.ownerId || form.assigneeId ? "EN_SEGUIMIENTO" : "NUEVO";
      }
      await tx.contact.update({ where: { id: existing.id }, data: patch });
      contactId = existing.id;
    } else {
      const created = await tx.contact.create({
        data: {
          firstName,
          lastName: mapped("lastName"),
          email,
          phone: mapped("phone"),
          jobTitle: mapped("jobTitle"),
          source: `Formulario: ${form.name}`,
          companyId,
          ownerId: form.assigneeId,
          leadStatus: form.assigneeId ? "EN_SEGUIMIENTO" : "NUEVO",
          lastActivityAt: new Date(),
        },
      });
      contactId = created.id;
    }

    await tx.formSubmission.create({ data: { formId: form.id, contactId, data: answers } });
    await tx.activity.create({
      data: { type: "NOTA", subject: `Respuesta al formulario "${form.name}"`, body: summary, contactId },
    });
    if (form.assigneeId) {
      const tomorrow = new Date(Date.now() + 86400000);
      await tx.activity.create({
        data: {
          type: "TAREA",
          subject: `Dar seguimiento al lead de "${form.name}"`,
          body: summary,
          dueDate: new Date(tomorrow.toISOString().slice(0, 10) + "T00:00:00Z"),
          contactId,
          assigneeId: form.assigneeId,
        },
      });
    }
    return contactId;
  });
}
