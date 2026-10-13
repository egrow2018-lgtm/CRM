"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { bool, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { createEmailImage } from "@/lib/email-images";

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
      data: {
        name: reqStr(form, "name", "Nombre"),
        digestEnabled: bool(form, "digestEnabled"),
        trackingAlerts: bool(form, "trackingAlerts"),
        signature: str(form, "signature")?.slice(0, 1000) ?? null,
        ...(await signatureImageData(form, me.id)),
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    revalidatePath("/", "layout");
  });
}

/** Imagen de firma elegida en el perfil (solo una imagen que exista) y su ancho (vacío = automático). */
async function signatureImageData(form: FormData, userId: string) {
  const id = str(form, "signatureImageId");
  const img = id ? await prisma.emailImage.findUnique({ where: { id }, select: { id: true, createdById: true } }) : null;
  const width = Number(str(form, "signatureImageWidth"));
  return {
    signatureImageId: img && (img.createdById === userId || img.createdById === null) ? img.id : null,
    signatureImageWidth: Number.isFinite(width) && width >= 120 && width <= 700 ? Math.round(width) : null,
  };
}

/** Sube la imagen de firma (ya reducida en el navegador). */
export async function uploadSignatureImage(input: { name: string; data: string; width?: number; height?: number }) {
  try {
    const me = await requireUser();
    const img = await createEmailImage(input, me.id);
    return { id: img.id, width: img.width };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo subir la imagen." };
  }
}
