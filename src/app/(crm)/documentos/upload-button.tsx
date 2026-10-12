"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createDocument, prepareUpload } from "./actions";

/** Miniatura de la primera página y número de páginas de un PDF (se calculan en el navegador). */
async function pdfInfo(file: File) {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 320 / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    const info = { pageCount: doc.numPages, thumbnail: canvas.toDataURL("image/jpeg", 0.7) };
    await doc.destroy();
    return info;
  } catch {
    return { pageCount: null, thumbnail: null };
  }
}

export function UploadButton({ folders, defaultFolderId }: { folders: { id: string; name: string }[]; defaultFolderId?: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [folderId, setFolderId] = useState(defaultFolderId ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    dialog.current?.close();
    setFile(null);
    setName("");
    setError(null);
    setStatus(null);
  }

  async function upload() {
    if (!file) return setError("Elige un archivo.");
    setBusy(true);
    setError(null);
    try {
      setStatus("Preparando…");
      const prep = await prepareUpload({ name: file.name, size: file.size, type: file.type });
      if ("error" in prep) throw new Error(prep.error);
      setStatus("Subiendo archivo…");
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      const res = await fetch(prep.url, { method: "PUT", body, headers: { "x-upsert": "false" } });
      if (!res.ok) throw new Error(`No se pudo subir el archivo (${res.status}).`);
      setStatus("Generando miniatura…");
      const info = file.type === "application/pdf" ? await pdfInfo(file) : { pageCount: null, thumbnail: null };
      const created = await createDocument({
        path: prep.path,
        name: name.trim() || file.name.replace(/\.[^.]+$/, ""),
        fileName: file.name,
        size: file.size,
        mimeType: file.type,
        folderId: folderId || null,
        ...info,
      });
      if ("error" in created) throw new Error(created.error);
      close();
      router.push(`/documentos/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el archivo.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => dialog.current?.showModal()}>
        Subir documento
      </button>
      <dialog ref={dialog} className="m-auto w-full max-w-md rounded-xl p-0 shadow-xl backdrop:bg-slate-900/40" onClose={close}>
        <div className="p-5">
          <h2 className="mb-4 text-base">Subir documento</h2>
          {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="space-y-3">
            <label className="block text-xs text-slate-500">
              Archivo (PDF recomendado: permite ver el tiempo por página; máx. 50 MB)
              <input
                type="file"
                accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
                className="input mt-1"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f && !name) setName(f.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " "));
                }}
              />
            </label>
            <label className="block text-xs text-slate-500">
              Nombre que verá el cliente
              <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" placeholder="Ej. Presentación Rutalink 2026" />
            </label>
            <label className="block text-xs text-slate-500">
              Carpeta
              <select data-native value={folderId} onChange={(e) => setFolderId(e.target.value)} className="input mt-1">
                <option value="">Sin carpeta</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            {status && <span className="mr-auto text-xs text-slate-500">{status}</span>}
            <button type="button" className="btn" onClick={close} disabled={busy}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={upload} disabled={busy || !file}>
              {busy ? "Subiendo…" : "Subir"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
