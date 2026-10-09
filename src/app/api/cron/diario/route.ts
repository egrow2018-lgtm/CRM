import { runDailyJobs } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tarea diaria (Vercel Cron, ver vercel.json): crea renovaciones y envía el resumen por correo.
 * Vercel envía "Authorization: Bearer <CRON_SECRET>" automáticamente.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET no está configurado" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "No autorizado" }, { status: 401 });
  const result = await runDailyJobs();
  return Response.json({ ok: true, ...result });
}
