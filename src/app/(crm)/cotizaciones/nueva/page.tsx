import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { contactName, toNumber } from "@/lib/format";
import { getCompanySettings } from "@/lib/settings";
import { DEFAULT_TERM_MONTHS, quoteCode, type QuoteSnapshot } from "@/lib/quotes";
import { quoteEditable } from "@/lib/quote-edit";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { QuoteForm } from "./quote-form";

type SP = { dealId?: string; desde?: string; contactId?: string; editar?: string };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePagePermission("deals:write");
  const sp = await searchParams;
  // Corregir una cotización que el cliente aún no recibió (mantiene su número)
  if (sp.editar && !(await quoteEditable(sp.editar))) redirect(`/cotizaciones/${sp.editar}`);
  const sourceId = sp.editar ?? sp.desde;
  const [deals, products, brandLines, company, source, quoteLines, contacts] = await Promise.all([
    prisma.deal.findMany({
      where: { OR: [{ stage: { isLost: false } }, ...(sp.dealId ? [{ id: sp.dealId }] : [])] },
      select: { id: true, name: true, businessLineId: true, company: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } },
      orderBy: { updatedAt: "desc" },
      take: 3000,
    }),
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, unitPrice: true, billing: true, renewalMonths: true, businessLineId: true, businessLine: { select: { name: true } } },
      orderBy: [{ businessLine: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.businessLine.findMany({ where: { brandLogo: { not: null } }, select: { id: true, name: true, brandName: true } }),
    getCompanySettings(),
    // Nueva versión de una cotización, o la última del negocio para no volver a escribir los productos
    sourceId
      ? prisma.quote.findUnique({ where: { id: sourceId } })
      : sp.dealId
        ? prisma.quote.findFirst({ where: { dealId: sp.dealId }, orderBy: { createdAt: "desc" } })
        : null,
    // Líneas que permiten cotizar directo a un contacto, sin negocio (ej. Rutalink para personas naturales)
    prisma.businessLine.findMany({ where: { quoteWithoutDeal: true, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, company: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
  ]);
  const dealId = sp.dealId ?? source?.dealId ?? "";
  const contactMode = quoteLines.length > 0 && !dealId && (!!sp.contactId || (!!source && !source.dealId));
  const dealItems = dealId ? await prisma.dealItem.findMany({ where: { dealId }, orderBy: { id: "asc" } }) : [];
  const snap = source ? (source.snapshot as unknown as Partial<QuoteSnapshot>) : null;

  const lines = snap?.items?.length
    ? snap.items.map((i) => ({
        productId: i.productId ?? "",
        description: i.description,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        discount: String(i.discount),
        billing: i.billing ?? ("UNICO" as const),
        termMonths: String(i.termMonths ?? DEFAULT_TERM_MONTHS),
      }))
    : dealItems.map((i) => ({
        productId: i.productId ?? "",
        description: i.description,
        quantity: String(toNumber(i.quantity)),
        unitPrice: String(toNumber(i.unitPrice)),
        discount: String(toNumber(i.discount)),
        billing: i.billing,
        termMonths: String(i.termMonths ?? DEFAULT_TERM_MONTHS),
      }));

  return (
    <div className="max-w-[96rem]">
      <div className="mb-2 text-sm">
        <Link href={dealId ? `/negocios/${dealId}` : "/cotizaciones"} className="text-slate-500 hover:underline">
          ← {dealId ? "Volver al negocio" : "Cotizaciones"}
        </Link>
      </div>
      <PageHeader
        title={sp.editar && source ? `Corregir ${quoteCode(source.year, source.number)}` : "Nueva cotización"}
        subtitle={
          sp.editar && source
            ? `Corrige lo que haga falta y revisa la vista previa: se mantiene el número ${quoteCode(source.year, source.number)}.`
            : sp.desde && source
            ? `Basada en ${quoteCode(source.year, source.number)}: ajusta lo que cambió y genera la nueva versión.`
            : "Se genera el PDF con número correlativo y queda atada al negocio (o al contacto, en las líneas que cotizan sin negocio)."
        }
      />
      <QuoteForm
        key={`${dealId}-${source?.id ?? ""}-${sp.contactId ?? ""}`}
        deals={deals.map((d) => ({
          id: d.id,
          label: [d.name, d.company?.name ?? (d.contact ? contactName(d.contact) : null)].filter(Boolean).join(" · "),
          lineId: d.businessLineId,
        }))}
        products={products.map((p) => ({ id: p.id, name: p.name, price: toNumber(p.unitPrice), lineId: p.businessLineId, lineName: p.businessLine.name, billing: p.billing, term: p.renewalMonths }))}
        brandByLine={Object.fromEntries(brandLines.map((l) => [l.id, l.brandName || l.name]))}
        quoteLines={quoteLines}
        contacts={contacts.map((c) => ({ id: c.id, label: [contactName(c), c.email, c.company?.name].filter(Boolean).join(" · ") }))}
        editId={sp.editar && source ? source.id : null}
        initial={{
          mode: contactMode ? "contacto" : "negocio",
          contactId: sp.contactId ?? source?.contactId ?? "",
          lineId: (source && !source.dealId ? source.businessLineId : null) ?? quoteLines[0]?.id ?? "",
          taxId: (!source?.dealId && snap?.client?.taxId) || "",
          address: (!source?.dealId && snap?.client?.address) || "",
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
