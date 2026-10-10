"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { bool, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { DEFAULT_FORM_FIELDS, parseFormFields, slugify } from "@/lib/forms-builder";
import { toKey } from "@/lib/custom-fields";

function readFields(form: FormData) {
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("fields") ?? "[]"));
  } catch {
    throw new Error("Configuración de campos inválida.");
  }
  const fields = parseFormFields(raw).map((f) => ({
    ...f,
    label: f.label.trim(),
    key: f.key || toKey(f.label),
    options: f.type === "select" ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined,
  }));
  if (fields.length === 0) throw new Error("El formulario necesita al menos un campo.");
  if (fields.some((f) => !f.label)) throw new Error("Todos los campos necesitan un nombre.");
  if (new Set(fields.map((f) => f.key)).size !== fields.length) throw new Error("Hay dos campos con el mismo nombre.");
  if (!fields.some((f) => f.map === "email" || f.map === "phone")) {
    throw new Error("Incluye al menos un campo de Email o Teléfono para poder contactar al lead.");
  }
  if (!fields.some((f) => f.map === "firstName")) throw new Error("Incluye un campo asociado al Nombre del contacto.");
  return fields;
}

async function uniqueSlug(base: string, excludeId?: string) {
  let slug = slugify(base);
  for (let i = 2; ; i++) {
    const existing = await prisma.form.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${slugify(base)}-${i}`;
  }
}

export async function createForm(_: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("forms:manage");
    const name = reqStr(form, "name", "Nombre interno");
    const created = await prisma.form.create({
      data: {
        name,
        slug: await uniqueSlug(name),
        title: str(form, "title") ?? name,
        description: str(form, "description"),
        businessLineId: str(form, "businessLineId"),
        assigneeId: str(form, "assigneeId"),
        fields: DEFAULT_FORM_FIELDS,
      },
    });
    revalidatePath("/formularios");
    return `/formularios/${created.id}`;
  });
}

export async function updateForm(id: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("forms:manage");
    const slugInput = str(form, "slug");
    await prisma.form.update({
      where: { id },
      data: {
        name: reqStr(form, "name", "Nombre interno"),
        title: reqStr(form, "title", "Título"),
        description: str(form, "description"),
        submitLabel: str(form, "submitLabel") ?? "Enviar",
        successMessage: str(form, "successMessage") ?? "¡Gracias! Te contactaremos pronto.",
        businessLineId: str(form, "businessLineId"),
        assigneeId: str(form, "assigneeId"),
        active: bool(form, "active"),
        fields: readFields(form),
        ...(slugInput ? { slug: await uniqueSlug(slugInput, id) } : {}),
      },
    });
    revalidatePath("/formularios");
    revalidatePath(`/formularios/${id}`);
  });
}

export async function deleteForm(id: string) {
  await requirePermission("forms:manage");
  await prisma.form.delete({ where: { id } });
  revalidatePath("/formularios");
  redirect("/formularios");
}
