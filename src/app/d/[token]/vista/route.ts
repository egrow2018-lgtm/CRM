import { after } from "next/server";
import { prisma } from "@/lib/db";
import { findLink, isCrmUser, readConsent } from "@/lib/doc-links";
import { mergePageTimes } from "@/lib/doc-stats";
import { notifyDocumentView } from "@/lib/client-email";
import { isEmail } from "@/lib/email-compose";

export const dynamic = "force-dynamic";

type Body = { op?: string; viewId?: string; delta?: Record<string, number>; seconds?: number };

/**
 * Seguimiento del visor: "start" abre una visita, "ping" suma el tiempo por página
 * (cada pocos segundos y al cerrar, con sendBeacon) y "download" marca la descarga.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const link = await findLink((await params).token);
  if (!link) return Response.json({ error: "No encontrado" }, { status: 404 });
  let body: Body;
  try {
    body = JSON.parse(await req.text()) as Body;
  } catch {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  if (body.op === "start") {
    // El equipo revisando sus propios enlaces no cuenta como visita del cliente
    if (await isCrmUser()) return Response.json({ viewId: null, preview: true });
    const consent = await readConsent(link.id);
    if (link.document?.consentRequired && !consent) return Response.json({ error: "Falta aceptar el aviso de datos" }, { status: 403 });
    const view = await prisma.documentView.create({
      data: {
        linkId: link.id,
        userAgent: req.headers.get("user-agent")?.slice(0, 300),
        viewerEmail: consent && isEmail(consent) ? consent.toLowerCase() : null,
        consentAt: consent ? new Date() : null,
      },
    });
    after(() => notifyDocumentView(link.id, view.viewerEmail).catch((e) => console.error("Aviso de vista", e)));
    // El cliente abrió la cotización: pasa a «En revisión»
    if (link.quoteId) {
      await prisma.quote.updateMany({ where: { id: link.quoteId, status: "EMITIDA" }, data: { status: "EN_REVISION", statusChangedAt: new Date() } });
    }
    return Response.json({ viewId: view.id });
  }

  if (!body.viewId || typeof body.viewId !== "string") return Response.json({ ok: true });
  const view = await prisma.documentView.findUnique({ where: { id: body.viewId } });
  if (!view || view.linkId !== link.id) return Response.json({ error: "Visita no encontrada" }, { status: 404 });

  if (body.op === "download") {
    await prisma.documentView.update({ where: { id: view.id }, data: { downloaded: true, lastSeenAt: new Date() } });
    return Response.json({ ok: true });
  }
  if (body.op === "ping") {
    const seconds = Math.min(Math.max(Number(body.seconds) || 0, 0), 300);
    await prisma.documentView.update({
      where: { id: view.id },
      data: { pageTimes: mergePageTimes(view.pageTimes, body.delta), durationSec: { increment: Math.round(seconds) }, lastSeenAt: new Date() },
    });
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Operación desconocida" }, { status: 400 });
}
