import { prisma } from "@/lib/db";

/** Imagen de una plantilla o correo (pública: la ven los clientes en su correo). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return new Response("No encontrada", { status: 404 });
  const img = await prisma.emailImage.findUnique({ where: { id }, select: { data: true, mimeType: true } });
  if (!img) return new Response("No encontrada", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: { "Content-Type": img.mimeType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
