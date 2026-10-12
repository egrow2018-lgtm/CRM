import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export const TOKEN_RE = /^[A-Za-z0-9_-]{16,40}$/;

/** Enlace público rastreado (documento o cotización). */
export async function findLink(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  return prisma.documentLink.findUnique({
    where: { token },
    include: {
      document: true,
      quote: true,
      contact: { select: { firstName: true, lastName: true } },
    },
  });
}

export const consentCookie = (linkId: string) => `dc_${linkId}`;

/** Aceptación del aviso de datos: "1" o el correo que escribió el visitante. */
export async function readConsent(linkId: string) {
  return (await cookies()).get(consentCookie(linkId))?.value ?? null;
}

/** Quien tiene sesión en el CRM (el vendedor revisando su enlace) no cuenta como visita. */
export async function isCrmUser() {
  return !!(await verifySession((await cookies()).get(SESSION_COOKIE)?.value));
}
