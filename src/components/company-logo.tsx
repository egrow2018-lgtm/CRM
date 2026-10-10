"use client";

import { useEffect, useRef, useState } from "react";
import { initials } from "@/lib/format";

/**
 * Logo de la empresa a partir de su sitio web (ícono del dominio vía el servicio de favicons de Google).
 * Si no hay web o el sitio no tiene ícono propio (Google devuelve un globo de 16 px), muestra las iniciales.
 */
export function CompanyLogo({ name, domain, size = "sm" }: { name: string; domain?: string | null; size?: "sm" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // La imagen puede terminar de cargar (o fallar) antes de que React conecte los eventos: se revisa al montar
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth <= 16) setFailed(true);
  }, []);
  const cls = size === "sm" ? "h-6 w-6 text-[10px]" : "h-12 w-12 text-sm";
  if (!domain || failed) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center rounded-md bg-brand-50 font-semibold text-brand-700 ${cls}`}>
        {initials(name)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`shrink-0 rounded-md border border-slate-200 bg-white object-contain p-0.5 ${cls}`}
      onLoad={(e) => e.currentTarget.naturalWidth <= 16 && setFailed(true)}
      onError={() => setFailed(true)}
    />
  );
}
