"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

const PING_EVERY_S = 15;
/** Sin mover el ratón, desplazarse ni tocar la pantalla por más de esto, no se cuenta el tiempo */
const IDLE_AFTER_MS = 90_000;

/**
 * Visor de PDF con seguimiento: mide cuánto tiempo pasa el visitante en cada página
 * (solo con la pestaña visible y mientras interactúa) y lo envía al CRM.
 */
export function DocumentViewer({
  token,
  title,
  color,
  brandName,
  isPdf,
  fileName,
  allowDownload,
}: {
  token: string;
  title: string;
  color: string;
  brandName: string | null;
  isPdf: boolean;
  fileName: string;
  allowDownload: boolean;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState(1.414);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(1);
  const view = useRef<{ id: string | null; started: boolean }>({ id: null, started: false });
  const pending = useRef<{ delta: Record<string, number>; seconds: number }>({ delta: {}, seconds: 0 });
  const currentRef = useRef(1);
  const lastInteraction = useRef(Date.now());
  const fileUrl = `/d/${token}/archivo`;
  const api = `/d/${token}/vista`;

  async function start() {
    if (view.current.started) return;
    view.current.started = true;
    try {
      const res = await fetch(api, { method: "POST", body: JSON.stringify({ op: "start" }) });
      const data = (await res.json()) as { viewId?: string | null };
      view.current.id = data.viewId ?? null;
    } catch {
      /* sin conexión: el documento se ve igual */
    }
  }

  function flush(beacon = false) {
    const { delta, seconds } = pending.current;
    if (!view.current.id || seconds <= 0) return;
    pending.current = { delta: {}, seconds: 0 };
    const body = JSON.stringify({ op: "ping", viewId: view.current.id, delta, seconds });
    if (beacon && navigator.sendBeacon) navigator.sendBeacon(api, new Blob([body], { type: "text/plain" }));
    else fetch(api, { method: "POST", body, keepalive: true }).catch(() => {});
  }

  // Carga del PDF
  useEffect(() => {
    if (!isPdf) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        const doc = await pdfjs.getDocument({ url: fileUrl, disableAutoFetch: true }).promise;
        if (cancelled) return;
        const first = await doc.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        setRatio(vp.height / vp.width);
        setPdf(doc);
        start();
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("No se pudo abrir el documento. Revisa tu conexión e intenta de nuevo.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPdf, fileUrl]);

  // Reloj: suma un segundo a la página visible si la pestaña está activa y hay interacción reciente
  useEffect(() => {
    if (!pdf) return;
    const touch = () => (lastInteraction.current = Date.now());
    const events = ["mousemove", "scroll", "keydown", "touchstart", "wheel", "click"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    let sinceFlush = 0;
    const tick = setInterval(() => {
      if (document.visibilityState !== "visible" || Date.now() - lastInteraction.current > IDLE_AFTER_MS) return;
      const p = String(currentRef.current);
      pending.current.delta[p] = (pending.current.delta[p] ?? 0) + 1;
      pending.current.seconds += 1;
      if (++sinceFlush >= PING_EVERY_S) {
        sinceFlush = 0;
        flush();
      }
    }, 1000);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onLeave = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onLeave);
    return () => {
      clearInterval(tick);
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf]);

  function onDownload() {
    if (!isPdf) start().then(() => send("download"));
    else send("download");
  }
  function send(op: string) {
    if (view.current.id) fetch(api, { method: "POST", body: JSON.stringify({ op, viewId: view.current.id }), keepalive: true }).catch(() => {});
  }

  const pages = pdf?.numPages ?? 0;
  return (
    <main className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2.5 text-white shadow" style={{ backgroundColor: color }}>
        <span className="truncate font-semibold">{title}</span>
        <span className="ml-auto shrink-0 text-sm opacity-80">{pages > 0 && `Página ${current} de ${pages}`}</span>
        {allowDownload && (
          <a href={`${fileUrl}?descargar=1`} onClick={onDownload} className="shrink-0 rounded-md bg-white/15 px-3 py-1 text-sm font-medium hover:bg-white/25" download={fileName}>
            Descargar
          </a>
        )}
      </header>

      {!isPdf ? (
        <div className="mx-auto mt-16 max-w-md rounded-xl bg-white p-8 text-center shadow">
          <div className="text-4xl">📄</div>
          <h1 className="mt-3 text-lg font-semibold text-slate-800">{fileName}</h1>
          <p className="mt-2 text-sm text-slate-500">Este archivo se abre en tu computador.</p>
          {allowDownload ? (
            <a href={`${fileUrl}?descargar=1`} onClick={onDownload} className="btn btn-primary mt-5" style={{ backgroundColor: color, borderColor: color }}>
              Descargar archivo
            </a>
          ) : (
            <p className="mt-4 text-sm text-slate-500">La descarga no está habilitada; pide el archivo a tu asesor.</p>
          )}
        </div>
      ) : error ? (
        <p className="mx-auto mt-16 max-w-md rounded-xl bg-white p-6 text-center text-sm text-red-700 shadow">{error}</p>
      ) : !pdf ? (
        <p className="mt-16 text-center text-sm text-slate-500">Cargando documento…</p>
      ) : (
        <div className="mx-auto max-w-4xl space-y-3 px-2 py-4 sm:px-4">
          {Array.from({ length: pages }, (_, i) => (
            <PdfPage
              key={i}
              pdf={pdf}
              number={i + 1}
              ratio={ratio}
              onVisible={(n) => {
                currentRef.current = n;
                setCurrent(n);
              }}
            />
          ))}
        </div>
      )}
      <footer className="pb-6 text-center text-xs text-slate-400">{brandName ? `${brandName} · una marca de e-grow` : "Compartido por e-grow"}</footer>
    </main>
  );
}

/** Página del PDF: se dibuja cuando se acerca a la pantalla y avisa cuando ocupa la mayor parte de la vista. */
function PdfPage({ pdf, number, ratio, onVisible }: { pdf: PDFDocumentProxy; number: number; ratio: number; onVisible: (n: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = box.current!;
    let rendering = false;
    const near = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || rendering) return;
        rendering = true;
        near.disconnect();
        const page = await pdf.getPage(number);
        const width = el.clientWidth;
        const scale = (width / page.getViewport({ scale: 1 }).width) * Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale });
        const c = canvas.current!;
        c.width = Math.floor(viewport.width);
        c.height = Math.floor(viewport.height);
        await page.render({ canvasContext: c.getContext("2d")!, viewport }).promise;
        setDrawn(true);
      },
      { rootMargin: "1200px 0px" },
    );
    near.observe(el);
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onVisible(number);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    seen.observe(el);
    return () => {
      near.disconnect();
      seen.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, number]);

  return (
    <div ref={box} className="relative w-full overflow-hidden rounded bg-white shadow" style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas ref={canvas} className="block h-full w-full" />
      {!drawn && <span className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">Página {number}</span>}
    </div>
  );
}
