"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { bool, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { deleteFiles, fileExists, MAX_FILE_MB, signedUploadUrl, storageConfigured } from "@/lib/storage";
import { randomToken } from "@/lib/doc-stats";
import { appUrl } from "@/lib/email";

const THUMB_MAX = 200_000; // ~150 KB de imagen

function safeName(name: string) {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return clean || "archivo";
}

/** Paso 1 de la subida: reserva la ruta y devuelve la URL firmada a la que el navegador sube el archivo. */
export async function prepareUpload(file: { name: string; size: number; type: string }) {
  try {
    await requirePermission("docs:manage");
    if (!storageConfigured()) throw new Error("Falta conectar el espacio de archivos (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel).");
    if (!file?.name || !(file.size > 0)) throw new Error("Elige un archivo.");
    if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`El archivo pesa más de ${MAX_FILE_MB} MB.`);
    const path = `${new Date().getFullYear()}/${randomToken(9)}-${safeName(file.name)}`;
    return { path, url: await signedUploadUrl(path) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo preparar la subida." };
  }
}

/** Paso 2: el archivo ya está en Supabase; se registra en la biblioteca. */
export async function createDocument(input: {
  path: string;
  name: string;
  fileName: string;
  size: number;
  mimeType: string;
  pageCount?: number | null;
  thumbnail?: string | null;
  folderId?: string | null;
}) {
  try {
    const user = await requirePermission("docs:manage");
    if (!/^\d{4}\/[A-Za-z0-9_-]{12}-[A-Za-z0-9._-]+$/.test(input.path)) throw new Error("Ruta de archivo inválida.");
    if (!(await fileExists(input.path))) throw new Error("El archivo no terminó de subirse. Intenta de nuevo.");
    const thumbnail = input.thumbnail && /^data:image\/(jpeg|png);base64,/.test(input.thumbnail) && input.thumbnail.length < THUMB_MAX ? input.thumbnail : null;
    const doc = await prisma.document.create({
      data: {
        name: (input.name || input.fileName).trim().slice(0, 200),
        fileName: input.fileName.slice(0, 200),
        size: Math.round(input.size),
        mimeType: (input.mimeType || "application/octet-stream").slice(0, 100),
        storagePath: input.path,
        pageCount: input.pageCount && input.pageCount > 0 ? Math.round(input.pageCount) : null,
        thumbnail,
        folderId: input.folderId || null,
        ownerId: user.id,
      },
    });
    revalidatePath("/documentos");
    return { id: doc.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar el documento." };
  }
}

export async function updateDocument(id: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("docs:manage");
    await prisma.document.update({
      where: { id },
      data: {
        name: reqStr(form, "name", "Nombre").slice(0, 200),
        description: str(form, "description"),
        folderId: str(form, "folderId"),
        allowDownload: bool(form, "allowDownload"),
        consentRequired: bool(form, "consentRequired"),
      },
    });
    revalidatePath(`/documentos/${id}`);
    revalidatePath("/documentos");
  });
}

export async function deleteDocuments(ids: string[]) {
  try {
    await requirePermission("docs:manage");
    const docs = await prisma.document.findMany({ where: { id: { in: ids.filter((x) => typeof x === "string").slice(0, 200) } }, select: { id: true, storagePath: true } });
    await prisma.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
    await deleteFiles(docs.map((d) => d.storagePath));
    revalidatePath("/documentos");
    return { deleted: docs.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudieron eliminar." };
  }
}

export async function deleteDocument(id: string) {
  const res = await deleteDocuments([id]);
  if (res.error) throw new Error(res.error);
  redirect("/documentos");
}

export async function createFolder(_: ActionState, form: FormData) {
  return runAction(async () => {
    await requirePermission("docs:manage");
    await prisma.documentFolder.create({ data: { name: reqStr(form, "name", "Nombre de la carpeta").slice(0, 80) } });
    revalidatePath("/documentos");
  });
}

export async function deleteFolder(id: string) {
  await requirePermission("docs:manage");
  await prisma.documentFolder.delete({ where: { id } });
  revalidatePath("/documentos");
}

/** Enlace rastreado para compartir por WhatsApp, Outlook, etc. (para un contacto o con una etiqueta). */
export async function createShareLink(documentId: string, _: ActionState, form: FormData): Promise<ActionState & { url?: string }> {
  try {
    const user = await requirePermission("emails:send");
    const contactId = str(form, "contactId");
    const label = str(form, "label");
    if (!contactId && !label) throw new Error("Elige el contacto o escribe para quién es el enlace.");
    const link = await prisma.documentLink.create({
      data: { token: randomToken(), documentId, contactId, label: contactId ? null : label, createdById: user.id },
    });
    revalidatePath(`/documentos/${documentId}`);
    return { ok: true, url: `${appUrl()}/d/${link.token}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear el enlace." };
  }
}

export async function deleteShareLink(id: string) {
  await requirePermission("emails:send");
  const link = await prisma.documentLink.delete({ where: { id } });
  if (link.documentId) revalidatePath(`/documentos/${link.documentId}`);
}
