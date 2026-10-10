"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseFormFields } from "@/lib/forms-builder";
import { captureLead, LeadValidationError, readAnswers } from "@/lib/lead-capture";
import { notifyNewLead } from "@/lib/notifications";

export type PublicFormState = { error?: string; done?: boolean } | undefined;

export async function submitPublicForm(slug: string, _: PublicFormState, data: FormData): Promise<PublicFormState> {
  const form = await prisma.form.findUnique({ where: { slug } });
  if (!form || !form.active) return { error: "Este formulario ya no está disponible." };

  // Antispam: campo trampa invisible y tiempo mínimo de llenado
  const startedAt = Number(data.get("_t"));
  if (data.get("website") || !startedAt || Date.now() - startedAt < 2000) return { done: true };

  try {
    const fields = parseFormFields(form.fields);
    const answers = readAnswers(fields, data);
    const contactId = await captureLead(form, answers);
    // El aviso por correo no debe impedir que la respuesta quede registrada
    await notifyNewLead(form, contactId, answers, Object.fromEntries(fields.map((f) => [f.key, f.label]))).catch((e) =>
      console.error("No se pudo enviar el aviso del lead", e),
    );
  } catch (e) {
    if (e instanceof LeadValidationError) return { error: e.message };
    console.error(e);
    return { error: "No pudimos enviar tu información. Intenta nuevamente en unos minutos." };
  }
  revalidatePath("/leads");
  revalidatePath("/contactos");
  return { done: true };
}
