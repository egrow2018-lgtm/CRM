import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { quoteCode } from "@/lib/quotes";

export const maxDuration = 60;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new Response("No autorizado", { status: 401 });
  const quote = await prisma.quote.findUnique({ where: { id: (await params).id } });
  if (!quote) return new Response("No encontrada", { status: 404 });
  let pdf: Buffer;
  try {
    pdf = await renderQuotePdf(quote);
  } catch (e) {
    console.error("No se pudo generar el PDF de la cotización", quote.id, e);
    const detail = e instanceof Error ? e.message : String(e);
    return new Response(`No se pudo generar el PDF de ${quoteCode(quote.year, quote.number)}.\n\nDetalle técnico (envíalo a soporte): ${detail}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quoteCode(quote.year, quote.number)}.pdf"`,
    },
  });
}
