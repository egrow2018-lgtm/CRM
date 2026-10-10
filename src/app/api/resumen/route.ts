import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildDigest } from "@/lib/notifications";
import { emailLayout } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Vista previa del resumen diario de la persona que inició sesión. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return new Response("No autorizado", { status: 401 });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  const digest = await buildDigest(user);
  const html = digest?.html ?? emailLayout("Todo al día", "<p>Hoy no tienes pendientes: no se enviaría resumen.</p>");
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
