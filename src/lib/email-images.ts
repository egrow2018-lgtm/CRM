import "server-only";
import { prisma } from "./db";

/** Guarda una imagen (data URL ya reducida en el navegador) para usarla en correos, plantillas o firmas. */
export async function createEmailImage(input: { name: string; data: string; width?: number; height?: number }, userId: string) {
  const m = /^data:(image\/(?:png|jpeg|gif));base64,([A-Za-z0-9+/=]+)$/.exec(input.data ?? "");
  if (!m) throw new Error("Usa una imagen PNG, JPG o GIF.");
  const bytes = Buffer.from(m[2]!, "base64");
  if (bytes.length > 1_500_000) throw new Error("La imagen pesa más de 1,5 MB incluso reducida. Prueba con otra.");
  // Nombre único (en el editor la imagen se identifica por su nombre)
  const base = (input.name || "imagen").replace(/[\]\n→[]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "imagen";
  const taken = new Set((await prisma.emailImage.findMany({ where: { name: { startsWith: base } }, select: { name: true } })).map((i) => i.name));
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base} (${n})`;
  return prisma.emailImage.create({
    data: { name, mimeType: m[1]!, data: bytes, width: input.width ?? null, height: input.height ?? null, createdById: userId },
    select: { id: true, name: true, width: true },
  });
}
