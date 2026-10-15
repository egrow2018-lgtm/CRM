"use server";

import { revalidatePath } from "next/cache";
import type { ProductType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { bool, num, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { DEFAULT_TERM_MONTHS, isBilling, type Billing } from "@/lib/quotes";
import { parseCustomFields, toKey } from "@/lib/custom-fields";
import { validLogo } from "@/lib/forms-builder";
import { EGROW_ACCENT, EGROW_PRIMARY, validHex } from "@/lib/brand";

export async function saveBusinessLine(id: string | null, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("catalog:manage");
    const data = {
      name: reqStr(form, "name", "Nombre"),
      description: str(form, "description"),
      color: str(form, "color") ?? "#1c315e",
      active: id ? bool(form, "active") : true,
      quoteWithoutDeal: bool(form, "quoteWithoutDeal"),
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
    const billing = isBilling(str(form, "billing")) ? (str(form, "billing") as Billing) : "UNICO";
    const data = {
      name: reqStr(form, "name", "Nombre"),
      description: str(form, "description"),
      sku: str(form, "sku"),
      type,
      unitPrice: num(form, "unitPrice") ?? 0,
      billing,
      // Recurrentes: plazo del contrato en meses (12 por defecto); al ganar el negocio se agenda la renovación
      renewalMonths: billing === "UNICO" ? null : Math.min(120, Math.max(1, Math.round(num(form, "renewalMonths") ?? DEFAULT_TERM_MONTHS))),
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

/** Marca propia de la línea para las cotizaciones (logo, colores, nombre y web). */
export async function saveLineBrand(id: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("catalog:manage");
    await prisma.businessLine.update({
      where: { id },
      data: {
        brandName: str(form, "brandName"),
        brandWebsite: str(form, "brandWebsite"),
        brandLogo: validLogo(str(form, "brandLogo"), { pdf: true }),
        brandPrimary: validHex(str(form, "brandPrimary"), EGROW_PRIMARY),
        brandAccent: validHex(str(form, "brandAccent"), EGROW_ACCENT),
        brandHeaderBg: form.get("darkHeader") === "on" ? validHex(str(form, "brandHeaderBg"), "#111827") : null,
      },
    });
    revalidatePath("/catalogo");
  });
}

/**
 * Elimina un producto del catálogo. Los negocios que ya lo tenían conservan la línea (con su descripción y precio)
 * y las cotizaciones emitidas no cambian: guardan su propia copia.
 */
export async function deleteProduct(id: string) {
  await requirePermission("catalog:manage");
  await prisma.product.delete({ where: { id } });
  revalidatePath("/catalogo");
}

/**
 * Elimina una línea de negocio junto con sus productos. Solo si no tiene negocios ni cotizaciones
 * (si los tiene, conviene desactivarla para no perder el historial).
 */
export async function deleteBusinessLine(id: string) {
  await requirePermission("catalog:manage");
  const line = await prisma.businessLine.findUniqueOrThrow({ where: { id }, include: { _count: { select: { deals: true, quotes: true } } } });
  if (line._count.deals > 0 || line._count.quotes > 0) {
    throw new Error(`La línea ${line.name} tiene negocios o cotizaciones: desactívala en lugar de eliminarla.`);
  }
  await prisma.$transaction([prisma.product.deleteMany({ where: { businessLineId: id } }), prisma.businessLine.delete({ where: { id } })]);
  revalidatePath("/catalogo");
}
