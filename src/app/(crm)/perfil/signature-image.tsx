"use client";

import { useState } from "react";
import { shrinkImage } from "@/lib/shrink-image";
import { signatureWidth } from "@/lib/email-compose";
import { uploadSignatureImage } from "./actions";

/** Imagen de firma del correo: se sube, se ve como quedará y se ajusta el ancho (o automático). */
export function SignatureImageInput({ initial }: { initial: { id: string; naturalWidth: number | null; width: number | null } | null }) {
  const [img, setImg] = useState(initial ? { id: initial.id, naturalWidth: initial.naturalWidth } : null);
  const [auto, setAuto] = useState(!initial?.width);
  const [width, setWidth] = useState(initial?.width ?? signatureWidth(null, initial?.naturalWidth));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = auto ? signatureWidth(null, img?.naturalWidth) : width;

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const { data, width: w, height } = await shrinkImage(file);
      const res = await uploadSignatureImage({ name: `Firma ${file.name.replace(/\.[^.]+$/, "")}`, data, width: w, height });
      if ("error" in res) throw new Error(res.error);
      setImg({ id: res.id, naturalWidth: res.width });
      setWidth(signatureWidth(null, res.width));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="signatureImageId" value={img?.id ?? ""} />
      <input type="hidden" name="signatureImageWidth" value={img && !auto ? String(width) : ""} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn btn-sm cursor-pointer">
          {busy ? "Subiendo…" : img ? "Cambiar imagen" : "Subir imagen de firma"}
          <input type="file" accept="image/png,image/jpeg,image/gif" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {img && (
          <button type="button" className="btn btn-sm" onClick={() => setImg(null)}>
            Quitar
          </button>
        )}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
      {img && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Tamaño automático
            </label>
            {!auto && (
              <label className="flex items-center gap-2">
                Ancho
                <input type="range" min={200} max={700} step={10} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
                <span className="w-14 tabular-nums">{width} px</span>
              </label>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-2 text-xs text-slate-400">Así se verá al final de tus correos (el correo mide unos 600 px de ancho):</p>
            <div className="max-w-[640px] border-t border-slate-200 pt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/img/${img.id}`} alt="Firma" style={{ width: shown, maxWidth: "100%", height: "auto" }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
