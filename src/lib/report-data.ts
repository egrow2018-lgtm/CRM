import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { toNumber } from "./format";
import type { RDeal, RLead, RQuote } from "./reports";

/** Carga los negocios, cotizaciones y leads para los reportes (opcionalmente de una sola línea). */
export async function loadReportData(lineId?: string) {
  // Línea: la del negocio o la de alguno de sus productos
  const dealLine: Prisma.DealWhereInput = lineId
    ? { OR: [{ businessLineId: lineId }, { items: { some: { product: { businessLineId: lineId } } } }] }
    : {};
  const [deals, quotes, leads, lines] = await Promise.all([
    prisma.deal.findMany({
      where: dealLine,
      select: {
        id: true,
        name: true,
        amount: true,
        createdAt: true,
        closeDate: true,
        stageChangedAt: true,
        lostReason: true,
        businessLineId: true,
        ownerId: true,
        owner: { select: { name: true } },
        company: { select: { name: true } },
        stage: { select: { name: true, order: true, probability: true, isWon: true, isLost: true } },
        items: { select: { description: true, quantity: true, unitPrice: true, discount: true, product: { select: { name: true } } } },
      },
    }),
    prisma.quote.findMany({
      where: lineId ? { deal: dealLine } : {},
      select: { createdAt: true, total: true, deal: { select: { businessLineId: true, ownerId: true, stage: { select: { isWon: true } } } } },
    }),
    prisma.contact.findMany({ select: { createdAt: true, source: true } }),
    prisma.businessLine.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
  ]);
  const rDeals: RDeal[] = deals.map((d) => ({
    id: d.id,
    name: d.name,
    amount: toNumber(d.amount),
    createdAt: d.createdAt,
    closeDate: d.closeDate,
    stageChangedAt: d.stageChangedAt,
    stage: d.stage,
    lineId: d.businessLineId,
    ownerId: d.ownerId,
    ownerName: d.owner?.name ?? null,
    companyName: d.company?.name ?? null,
    lostReason: d.lostReason,
    items: d.items.map((i) => {
      const quantity = toNumber(i.quantity);
      return {
        product: i.product?.name ?? i.description,
        quantity,
        subtotal: Math.round(quantity * toNumber(i.unitPrice) * (1 - toNumber(i.discount) / 100) * 100) / 100,
      };
    }),
  }));
  const rQuotes: RQuote[] = quotes.map((q) => ({
    createdAt: q.createdAt,
    total: toNumber(q.total),
    lineId: q.deal.businessLineId,
    ownerId: q.deal.ownerId,
    dealWon: q.deal.stage.isWon,
  }));
  const rLeads: RLead[] = leads;
  return { deals: rDeals, quotes: rQuotes, leads: rLeads, lines: lineId ? lines.filter((l) => l.id === lineId) : lines, allLines: lines };
}
