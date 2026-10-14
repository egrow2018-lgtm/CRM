import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { toNumber } from "./format";
import { itemFirstYear } from "./quotes";
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
        items: { select: { description: true, quantity: true, unitPrice: true, discount: true, billing: true, termMonths: true, product: { select: { name: true } } } },
      },
    }),
    prisma.quote.findMany({
      where: lineId ? { OR: [{ deal: dealLine }, { dealId: null, businessLineId: lineId }] } : {},
      select: {
        createdAt: true,
        total: true,
        businessLineId: true,
        createdById: true,
        contact: { select: { ownerId: true } },
        deal: { select: { businessLineId: true, ownerId: true, stage: { select: { isWon: true } } } },
      },
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
        // Valor del primer año (las mensualidades cuentan por los meses del contrato, hasta 12)
        subtotal: itemFirstYear({ quantity, unitPrice: toNumber(i.unitPrice), discount: toNumber(i.discount), billing: i.billing, termMonths: i.termMonths }),
      };
    }),
  }));
  const rQuotes: RQuote[] = quotes.map((q) => ({
    createdAt: q.createdAt,
    total: toNumber(q.total),
    // Sin negocio (cotización directa a un contacto): la línea de la cotización y el dueño del contacto
    lineId: q.deal ? q.deal.businessLineId : q.businessLineId,
    ownerId: q.deal ? q.deal.ownerId : (q.contact?.ownerId ?? q.createdById),
    dealWon: q.deal?.stage.isWon ?? false,
  }));
  const rLeads: RLead[] = leads;
  return { deals: rDeals, quotes: rQuotes, leads: rLeads, lines: lineId ? lines.filter((l) => l.id === lineId) : lines, allLines: lines };
}
