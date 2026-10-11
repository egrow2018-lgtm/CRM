"use client";

import { useState } from "react";
import { MAX_LOGO_CHARS } from "@/lib/forms-builder";

/** Reduce la imagen en el navegador (máx. 600×240 px) y la guarda como data URL en un campo oculto. */
async function shrink(file: File, pdf: boolean): Promise<string> {
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
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // PNG conserva la transparencia; si pesa mucho se usa WebP (o JPEG con fondo blanco para los PDF)
    let data = canvas.toDataURL("image/png");
    if (data.length > MAX_LOGO_CHARS) {
      if (pdf) {
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        data = canvas.toDataURL("image/jpeg", 0.85);
      } else data = canvas.toDataURL("image/webp", 0.85);
    }
    if (data.length > MAX_LOGO_CHARS) throw new Error("La imagen es muy pesada incluso reducida. Prueba con otra.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LogoInput({
  initial,
  name = "logo",
  pdf = false,
  emptyLabel = "Logo de e-grow",
}: {
  initial: string | null;
  name?: string;
  /** Para usar en PDF: solo PNG o JPEG */
  pdf?: boolean;
  emptyLabel?: string;
}) {
  const [logo, setLogo] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input type="hidden" name={name} value={logo} />
      <div
        className="flex h-16 w-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-1"
        // Cuadriculado para que también se vean los logos blancos o transparentes
        style={{ background: "repeating-conic-gradient(#e2e8f0 0 25%, #ffffff 0 50%) 0 0 / 12px 12px" }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="Logo del formulario" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-slate-400">{emptyLabel}</span>
        )}
      </div>
      <label className="btn btn-sm cursor-pointer">
        {logo ? "Cambiar imagen" : "Subir imagen"}
        <input
          type="file"
          accept={pdf ? "image/png,image/jpeg" : "image/png,image/jpeg,image/webp"}
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError(null);
            try {
              setLogo(await shrink(file, pdf));
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
