import "server-only";
import { prisma } from "./db";

/**
 * Una cotización se puede corregir (manteniendo su número) mientras el cliente no la haya recibido:
 * sigue «Emitida», no se envió por correo y nadie abrió su enlace.
 */
export async function quoteEditable(quoteId: string) {
  const q = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { status: true, sentAt: true, _count: { select: { emails: true } }, links: { select: { _count: { select: { views: true } } } } },
  });
  if (!q) return false;
  return q.status === "EMITIDA" && !q.sentAt && q._count.emails === 0 && q.links.every((l) => l._count.views === 0);
}
