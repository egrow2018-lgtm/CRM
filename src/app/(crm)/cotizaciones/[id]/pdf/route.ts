import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { quoteCode } from "@/lib/quotes";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new Response("No autorizado", { status: 401 });
  const quote = await prisma.quote.findUnique({ where: { id: (await params).id } });
  if (!quote) return new Response("No encontrada", { status: 404 });
  const pdf = await renderQuotePdf(quote);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quoteCode(quote.year, quote.number)}.pdf"`,
    },
  });
}
