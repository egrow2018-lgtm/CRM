"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";

export async function updateProfile(_: ActionState, form: FormData) {
  return runAction(async () => {
    const me = await requireUser();
    const current = str(form, "currentPassword");
    const next = str(form, "newPassword");
    let passwordHash: string | undefined;
    if (next) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
      if (!current || !(await bcrypt.compare(current, user.passwordHash))) {
        throw new Error("La contraseña actual no es correcta.");
      }
      if (next.length < 8) throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
      if (next !== str(form, "confirmPassword")) throw new Error("Las contraseñas nuevas no coinciden.");
      passwordHash = await bcrypt.hash(next, 10);
    }
    await prisma.user.update({
      where: { id: me.id },
      data: { name: reqStr(form, "name", "Nombre"), ...(passwordHash ? { passwordHash } : {}) },
    });
    revalidatePath("/", "layout");
  });
}
