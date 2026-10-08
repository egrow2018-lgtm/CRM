"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { bool, num, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { ROLE_LABELS } from "@/lib/permissions";

function role(form: FormData): Role {
  const r = str(form, "role") as Role;
  if (!(r in ROLE_LABELS)) throw new Error("Perfil inválido.");
  return r;
}

function password(form: FormData, required: boolean) {
  const p = str(form, "password");
  if (!p) {
    if (required) throw new Error("La contraseña es obligatoria.");
    return undefined;
  }
  if (p.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  return p;
}

export async function createUser(_: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("users:manage");
    const pwd = password(form, true)!;
    await prisma.user.create({
      data: {
        name: reqStr(form, "name", "Nombre"),
        email: reqStr(form, "email", "Email").toLowerCase(),
        role: role(form),
        passwordHash: await bcrypt.hash(pwd, 10),
      },
    });
    revalidatePath("/configuracion");
  });
}

export async function updateUser(id: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    const me = await requirePermission("users:manage");
    const active = bool(form, "active");
    const newRole = role(form);
    if (id === me.id && (!active || newRole !== "ADMIN")) {
      throw new Error("No puedes desactivarte ni quitarte el perfil de administrador a ti mismo.");
    }
    const pwd = password(form, false);
    await prisma.user.update({
      where: { id },
      data: {
        name: reqStr(form, "name", "Nombre"),
        email: reqStr(form, "email", "Email").toLowerCase(),
        role: newRole,
        active,
        ...(pwd ? { passwordHash: await bcrypt.hash(pwd, 10) } : {}),
      },
    });
    revalidatePath("/configuracion");
  });
}

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
