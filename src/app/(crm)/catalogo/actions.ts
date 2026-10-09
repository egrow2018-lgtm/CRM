"use server";

import { revalidatePath } from "next/cache";
import type { ProductType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { bool, num, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { parseCustomFields, toKey } from "@/lib/custom-fields";

export async function saveBusinessLine(id: string | null, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("catalog:manage");
    const data = {
      name: reqStr(form, "name", "Nombre"),
      description: str(form, "description"),
      color: str(form, "color") ?? "#1c315e",
      active: id ? bool(form, "active") : true,
    };
    if (id) await prisma.businessLine.update({ where: { id }, data });
    else await prisma.businessLine.create({ data });
    revalidatePath("/catalogo");
  });
}

export async function saveProduct(id: string | null, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("catalog:manage");
    const type = str(form, "type") === "PRODUCTO" ? "PRODUCTO" : ("SERVICIO" as ProductType);
    const data = {
      name: reqStr(form, "name", "Nombre"),
      description: str(form, "description"),
      sku: str(form, "sku"),
      type,
      unitPrice: num(form, "unitPrice") ?? 0,
      // Servicio recurrente: se renueva cada N meses (vacío = no recurrente)
      renewalMonths: (() => {
        const m = Math.round(num(form, "renewalMonths") ?? 0);
        return m > 0 ? Math.min(m, 120) : null;
      })(),
      businessLineId: reqStr(form, "businessLineId", "Línea de negocio"),
      active: id ? bool(form, "active") : true,
    };
    if (id) await prisma.product.update({ where: { id }, data });
    else await prisma.product.create({ data });
    revalidatePath("/catalogo");
  });
}

/** Guarda los campos adicionales que la línea activa en sus negocios. */
export async function saveLineFields(id: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("catalog:manage");
    let raw: unknown;
    try {
      raw = JSON.parse(String(form.get("fields") ?? "[]"));
    } catch {
      throw new Error("Configuración de campos inválida.");
    }
    const fields = parseCustomFields(raw).map((f) => ({
      ...f,
      key: f.key || toKey(f.label),
      label: f.label.trim(),
      options: f.type === "select" ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined,
    }));
    if (fields.some((f) => !f.label)) throw new Error("Todos los campos necesitan un nombre.");
    if (new Set(fields.map((f) => f.key)).size !== fields.length) throw new Error("Hay campos con el mismo nombre.");
    await prisma.businessLine.update({ where: { id }, data: { customFields: fields } });
    revalidatePath("/catalogo");
  });
}
