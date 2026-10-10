import { prisma } from "@/lib/db";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { quoteCode } from "@/lib/quotes";

/** Enlace público de una cotización (para compartir por WhatsApp o correo). */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return new Response("No encontrada", { status: 404 });
  const quote = await prisma.quote.findUnique({ where: { publicToken: token } });
  if (!quote) return new Response("No encontrada", { status: 404 });
  const pdf = await renderQuotePdf(quote);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quoteCode(quote.year, quote.number)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
