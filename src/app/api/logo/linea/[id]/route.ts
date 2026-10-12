import { prisma } from "@/lib/db";

/** Logo de la marca de una línea (ej. Rutalink), para el encabezado de los correos a clientes. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return new Response("No encontrado", { status: 404 });
  const line = await prisma.businessLine.findUnique({ where: { id }, select: { brandLogo: true } });
  const m = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(line?.brandLogo ?? "");
  if (!m) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(m[2]!, "base64")), {
    headers: { "Content-Type": m[1]!, "Cache-Control": "public, max-age=3600" },
  });
}
