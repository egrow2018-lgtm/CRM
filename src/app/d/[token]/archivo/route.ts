import { notFound } from "next/navigation";
import { findLink, readConsent } from "@/lib/doc-links";
import { signedFileUrl } from "@/lib/storage";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { quoteCode } from "@/lib/quotes";

export const maxDuration = 60;

export const dynamic = "force-dynamic";

/** Archivo de un enlace rastreado: el visor lo lee de aquí (y el botón Descargar). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const link = await findLink((await params).token);
  if (!link) notFound();
  const download = new URL(req.url).searchParams.has("descargar");

  if (link.quote) {
    const pdf = await renderQuotePdf(link.quote);
    const name = `${quoteCode(link.quote.year, link.quote.number)}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  }

  const doc = link.document;
  if (!doc) notFound();
  if (doc.consentRequired && !(await readConsent(link.id))) return new Response("Debes aceptar el aviso de datos", { status: 403 });
  if (download && !doc.allowDownload) return new Response("La descarga de este documento no está permitida", { status: 403 });
  const url = await signedFileUrl(doc.storagePath, { expiresIn: 300, download: download ? doc.fileName : undefined });
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
