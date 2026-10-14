import "server-only";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { ActionState } from "./forms";

/**
 * Ejecuta una server action devolviendo los errores como estado del formulario.
 * Si la función devuelve una ruta, redirige allí al terminar.
 */
export async function runAction(fn: () => Promise<string | void>): Promise<ActionState> {
  let target: string | void;
  try {
    target = await fn();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ya existe un registro con ese valor único (por ejemplo, el email o el nombre)." };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { error: "No se puede eliminar porque otros registros dependen de este." };
    }
    console.error(e);
    // Los errores internos de la base de datos no se muestran tal cual (son largos y técnicos)
    if (e instanceof Prisma.PrismaClientValidationError || e instanceof Prisma.PrismaClientKnownRequestError || e instanceof Prisma.PrismaClientUnknownRequestError) {
      return { error: "No se pudo guardar por un error interno. Intenta de nuevo y, si se repite, avisa al administrador." };
    }
    return { error: e instanceof Error ? e.message : "Ocurrió un error inesperado." };
  }
  if (target) redirect(target);
  return { ok: true };
}
