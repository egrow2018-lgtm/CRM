"use client";

import { useState } from "react";
import { MAX_LOGO_CHARS } from "@/lib/forms-builder";

/** Reduce la imagen en el navegador (máx. 600×240 px) y la guarda como data URL en un campo oculto. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo leer la imagen."));
      i.src = url;
    });
    const scale = Math.min(1, 600 / img.naturalWidth, 240 / img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    // PNG conserva la transparencia; si pesa mucho se usa WebP
    let data = canvas.toDataURL("image/png");
    if (data.length > MAX_LOGO_CHARS) data = canvas.toDataURL("image/webp", 0.85);
    if (data.length > MAX_LOGO_CHARS) throw new Error("La imagen es muy pesada incluso reducida. Prueba con otra.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LogoInput({ initial }: { initial: string | null }) {
  const [logo, setLogo] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="logo" value={logo} />
      <div className="flex h-16 w-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-1">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="Logo del formulario" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-slate-400">Logo de e-grow</span>
        )}
      </div>
      <label className="btn btn-sm cursor-pointer">
        {logo ? "Cambiar imagen" : "Subir imagen"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError(null);
            try {
              setLogo(await shrink(file));
            } catch (err) {
              setError(err instanceof Error ? err.message : "No se pudo cargar la imagen.");
            }
          }}
        />
      </label>
      {logo && (
        <button type="button" className="btn btn-sm" onClick={() => setLogo("")}>
          Quitar
        </button>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
