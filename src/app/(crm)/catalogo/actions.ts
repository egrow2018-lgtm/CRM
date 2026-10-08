"use server";

import { revalidatePath } from "next/cache";
import type { ProductType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { bool, num, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";

export async function saveBusinessLine(id: string | null, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("catalog:manage");
    const data = {
      name: reqStr(form, "name", "Nombre"),
      description: str(form, "description"),
      color: str(form, "color") ?? "#1f305e",
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
      businessLineId: reqStr(form, "businessLineId", "Línea de negocio"),
      active: id ? bool(form, "active") : true,
    };
    if (id) await prisma.product.update({ where: { id }, data });
    else await prisma.product.create({ data });
    revalidatePath("/catalogo");
  });
}
