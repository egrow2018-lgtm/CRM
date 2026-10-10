"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { bool, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { ALL_PERMISSIONS, ROLE_LABELS } from "@/lib/permissions";

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
    revalidatePath("/usuarios");
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
    revalidatePath("/usuarios");
  });
}

/** Guarda los permisos marcados para un usuario, o vuelve a los de su perfil. */
export async function saveUserPermissions(id: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("users:manage");
    const useRole = form.get("mode") === "role";
    const chosen = ALL_PERMISSIONS.filter((p) => form.get(`perm:${p}`) === "on");
    await prisma.user.update({
      where: { id },
      data: useRole ? { customPermissions: false, permissions: [] } : { customPermissions: true, permissions: chosen },
    });
    revalidatePath("/usuarios");
  });
}
