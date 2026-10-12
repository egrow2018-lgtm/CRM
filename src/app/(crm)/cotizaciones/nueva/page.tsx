import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { contactName, toNumber } from "@/lib/format";
import { getCompanySettings } from "@/lib/settings";
import { quoteCode, type QuoteSnapshot } from "@/lib/quotes";
import { PageHeader } from "@/components/ui";
import { QuoteForm } from "./quote-form";

type SP = { dealId?: string; desde?: string };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePagePermission("deals:write");
  const sp = await searchParams;
  const [deals, products, brandLines, company, source] = await Promise.all([
    prisma.deal.findMany({
      where: { OR: [{ stage: { isLost: false } }, ...(sp.dealId ? [{ id: sp.dealId }] : [])] },
      select: { id: true, name: true, businessLineId: true, company: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } },
      orderBy: { updatedAt: "desc" },
      take: 3000,
    }),
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, unitPrice: true, businessLineId: true, businessLine: { select: { name: true } } },
      orderBy: [{ businessLine: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.businessLine.findMany({ where: { brandLogo: { not: null } }, select: { id: true, name: true, brandName: true } }),
    getCompanySettings(),
    // Nueva versión de una cotización, o la última del negocio para no volver a escribir los productos
    sp.desde
      ? prisma.quote.findUnique({ where: { id: sp.desde } })
      : sp.dealId
        ? prisma.quote.findFirst({ where: { dealId: sp.dealId }, orderBy: { createdAt: "desc" } })
        : null,
  ]);
  const dealId = sp.dealId ?? source?.dealId ?? "";
  const dealItems = dealId ? await prisma.dealItem.findMany({ where: { dealId }, orderBy: { id: "asc" } }) : [];
  const snap = source ? (source.snapshot as unknown as Partial<QuoteSnapshot>) : null;

  const lines = snap?.items?.length
    ? snap.items.map((i) => ({
        productId: i.productId ?? "",
        description: i.description,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        discount: String(i.discount),
      }))
    : dealItems.map((i) => ({
        productId: i.productId ?? "",
        description: i.description,
        quantity: String(toNumber(i.quantity)),
        unitPrice: String(toNumber(i.unitPrice)),
        discount: String(toNumber(i.discount)),
      }));

  return (
    <div className="max-w-5xl">
      <div className="mb-2 text-sm">
        <Link href={dealId ? `/negocios/${dealId}` : "/cotizaciones"} className="text-slate-500 hover:underline">
          ← {dealId ? "Volver al negocio" : "Cotizaciones"}
        </Link>
      </div>
      <PageHeader
        title="Nueva cotización"
        subtitle={sp.desde && source ? `Basada en ${quoteCode(source.year, source.number)}: ajusta lo que cambió y genera la nueva versión.` : "Se genera el PDF con número correlativo y queda atada al negocio."}
      />
      <QuoteForm
        key={`${dealId}-${source?.id ?? ""}`}
        deals={deals.map((d) => ({
          id: d.id,
          label: [d.name, d.company?.name ?? (d.contact ? contactName(d.contact) : null)].filter(Boolean).join(" · "),
          lineId: d.businessLineId,
        }))}
        products={products.map((p) => ({ id: p.id, name: p.name, price: toNumber(p.unitPrice), lineId: p.businessLineId, lineName: p.businessLine.name }))}
        brandByLine={Object.fromEntries(brandLines.map((l) => [l.id, l.brandName || l.name]))}
        initial={{
          dealId,
          lines,
          validityDays: snap?.validityDays ?? company.validityDays,
          ivaPercent: snap?.ivaPercent ?? company.ivaPercent,
          notes: snap?.notes ?? "",
          conditions: snap?.conditions ?? company.conditions,
        }}
      />
    </div>
  );
}
