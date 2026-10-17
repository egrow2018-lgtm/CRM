"use client";

import { useEffect, useRef, useState } from "react";
import { previewQuote } from "../actions";

/** Genera el PDF de vista previa con lo que hay en el formulario y devuelve su URL local. */
async function previewUrl(formId: string): Promise<{ url: string } | { error: string }> {
  const form = document.getElementById(formId) as HTMLFormElement | null;
  if (!form) return { error: "No se encontró el formulario." };
  const res = await previewQuote(new FormData(form));
  if ("error" in res) return res;
  const bytes = Uint8Array.from(atob(res.pdf), (c) => c.charCodeAt(0));
  return { url: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })) };
}

/**
 * En pantallas angostas (celular, tablet) el visor de PDF incrustado no funciona bien:
 * este botón abre la vista previa en una pestaña nueva.
 */
export function PreviewButton({ formId, ready }: { formId: string; ready: boolean }) {
  function open() {
    const source = document.getElementById(formId) as HTMLFormElement | null;
    if (!source) return;
    // Copia los datos en un formulario aparte y lo envía de verdad (el de la cotización se envía por JavaScript)
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/cotizaciones/vista-previa";
    form.target = "_blank";
    form.hidden = true;
    for (const [name, value] of new FormData(source)) {
      if (typeof value !== "string") continue;
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.append(input);
    }
    document.body.append(form);
    form.submit();
    form.remove();
  }

  return (
    <button type="button" className="btn xl:hidden" onClick={open} disabled={!ready}>
      Ver vista previa (PDF)
    </button>
  );
}

/**
 * Vista previa del PDF tal como lo recibirá el cliente, con lo que hay en el formulario.
 * Se actualiza sola un momento después de cada cambio (no guarda nada ni usa número).
 */
export function QuotePreview({ formId, ready, changed }: { formId: string; ready: boolean; changed: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  async function refresh() {
    if (!ready) return;
    const n = ++seq.current;
    setLoading(true);
    const res = await previewUrl(formId);
    if (n !== seq.current) return; // llegó una respuesta más nueva
    setLoading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setError(null);
    setUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return res.url;
    });
  }

  useEffect(() => {
    if (!ready || !window.matchMedia("(min-width: 1280px)").matches) return;
    const t = setTimeout(refresh, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changed, ready]);

  return (
    <div className="hidden xl:sticky xl:top-4 xl:block xl:self-start">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
          <h2 className="text-base">Vista previa</h2>
          <span className="flex items-center gap-2 text-xs text-slate-500">
            {loading ? "Actualizando…" : url ? "Así la verá el cliente · se actualiza sola" : null}
            <button type="button" className="btn btn-sm" onClick={refresh} disabled={!ready || loading}>
              ↻ Actualizar
            </button>
          </span>
        </div>
        {error && <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
        {url ? (
          <iframe title="Vista previa de la cotización" src={`${url}#view=FitH&toolbar=0`} className="h-[75vh] w-full bg-slate-100" />
        ) : (
          <p className="px-4 py-16 text-center text-sm text-slate-500">
            {ready ? "Preparando la vista previa…" : "Elige el negocio (o el contacto) y agrega al menos un producto para ver la vista previa."}
          </p>
        )}
      </div>
    </div>
  );
}
