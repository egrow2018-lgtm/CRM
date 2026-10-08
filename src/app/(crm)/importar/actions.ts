"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { runHubspotImport, type ImportKind, type ImportResult } from "@/lib/hubspot-import";

export type ImportState = { error?: string; result?: ImportResult } | undefined;

export async function importCsv(_: ImportState, form: FormData): Promise<ImportState> {
  try {
    const user = await requirePermission("import:run");
    const kind = form.get("kind") as ImportKind;
    if (!["companies", "contacts", "deals"].includes(kind)) return { error: "Selecciona qué quieres importar." };
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Selecciona un archivo CSV." };
    if (file.size > 5 * 1024 * 1024) return { error: "El archivo supera los 5 MB." };
    const dryRun = form.get("dryRun") === "on";
    const result = await runHubspotImport(kind, await file.text(), dryRun, user.id);
    if (!dryRun) ["/", "/negocios", "/empresas", "/contactos"].forEach((p) => revalidatePath(p));
    return { result };
  } catch (e) {
    console.error(e);
    return { error: e instanceof Error ? e.message : "Error al importar." };
  }
}
