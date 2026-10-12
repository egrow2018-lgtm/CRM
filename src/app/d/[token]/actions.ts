"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { consentCookie, findLink } from "@/lib/doc-links";
import { isEmail } from "@/lib/email-compose";
import type { ActionState } from "@/lib/forms";

/** El visitante acepta el aviso de datos antes de ver el documento. */
export async function acceptDocumentConsent(token: string, _: ActionState, form: FormData): Promise<ActionState> {
  const link = await findLink(token);
  if (!link) return { error: "El enlace ya no existe." };
  if (form.get("consent") !== "on") return { error: "Para ver el documento debes aceptar el aviso." };
  let value = "1";
  if (!link.contactId) {
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!isEmail(email)) return { error: "Escribe un correo válido." };
    value = email;
  }
  (await cookies()).set(consentCookie(link.id), value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: `/d/${token}`, maxAge: 60 * 60 * 24 * 365 });
  redirect(`/d/${token}`);
}
