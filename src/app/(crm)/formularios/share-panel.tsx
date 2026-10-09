"use client";

import { useState } from "react";

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm shrink-0"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "¡Copiado!" : label}
    </button>
  );
}

export function SharePanel({ url, title, qrSvg }: { url: string; title: string; qrSvg: string }) {
  const text = encodeURIComponent(`${title} ${url}`);
  const u = encodeURIComponent(url);
  const embed = `<iframe src="${url}?embed=1" width="100%" height="720" style="border:0" title="${title.replace(/"/g, "&quot;")}"></iframe>`;
  const qrHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
  return (
    <div className="space-y-4">
      <div>
        <div className="label">Enlace para compartir</div>
        <div className="flex gap-2">
          <input readOnly value={url} className="input" onFocus={(e) => e.currentTarget.select()} />
          <CopyButton text={url} />
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand-600 hover:underline">
          Abrir formulario ↗
        </a>
      </div>
      <div>
        <div className="label">Compartir en</div>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${text}`}>WhatsApp</a>
          <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`}>LinkedIn</a>
          <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${u}`}>Facebook</a>
          <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${text}`}>X</a>
        </div>
        <p className="mt-1 text-xs text-slate-500">Para Instagram o TikTok, pega el enlace en la biografía o en una historia con enlace.</p>
      </div>
      <div>
        <div className="label">Código QR (para piezas gráficas o eventos)</div>
        <div className="flex items-end gap-3">
          <div className="h-32 w-32 rounded-lg border border-slate-200 bg-white p-1" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <a className="btn btn-sm" href={qrHref} download="formulario-qr.svg">Descargar QR</a>
        </div>
      </div>
      <div>
        <div className="label">Insertar en un sitio web</div>
        <div className="flex gap-2">
          <textarea readOnly rows={3} value={embed} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <CopyButton text={embed} />
        </div>
      </div>
    </div>
  );
}
