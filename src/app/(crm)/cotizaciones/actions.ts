"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { num, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { contactName, toNumber } from "@/lib/format";
import { computeTotals, quoteCode, type QuoteSnapshot } from "@/lib/quotes";
import { getCompanySettings } from "@/lib/settings";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { emailConfigured } from "@/lib/email";
import { sendClientEmail } from "@/lib/client-email";
import { splitEmails } from "@/lib/email-compose";
import { randomToken } from "@/lib/doc-stats";
import { normalize } from "@/lib/csv";
import { dealBrand } from "@/lib/brand";

export async function createQuote(dealId: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("deals:write");
    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: dealId },
      include: {
        items: { include: { product: { include: { businessLine: true } } }, orderBy: { id: "asc" } },
        businessLine: true,
        company: true,
        contact: true,
        owner: true,
        stage: true,
      },
    });
    if (deal.items.length === 0) throw new Error("Agrega productos o servicios al negocio antes de generar la cotización.");
    const company = await getCompanySettings();
    const ivaPercent = Math.min(100, Math.max(0, num(form, "ivaPercent") ?? company.ivaPercent));
    const validityDays = Math.min(365, Math.max(1, Math.round(num(form, "validityDays") ?? company.validityDays)));
    const items = deal.items.map((i) => ({ quantity: toNumber(i.quantity), unitPrice: toNumber(i.unitPrice), discount: toNumber(i.discount) }));
    const totals = computeTotals(items, ivaPercent);
    const owner = deal.owner ?? (await prisma.user.findUnique({ where: { id: user.id } }));

    const snapshot: QuoteSnapshot = {
      company: {
        name: company.name,
        legalName: company.legalName,
        taxId: company.taxId,
        address: company.address,
        phone: company.phone,
        email: company.email,
        website: company.website,
      },
      client: {
        company: deal.company?.name ?? null,
        contact: deal.contact ? contactName(deal.contact) : null,
        email: deal.contact?.email ?? null,
        phone: deal.contact?.phone ?? deal.company?.phone ?? null,
        taxId: deal.company?.taxId ?? null,
        address: deal.company?.address ?? null,
      },
      dealName: deal.name,
      owner: owner ? { name: owner.name, email: owner.email } : null,
      items: deal.items.map((i, idx) => ({
        description: i.description,
        detail: i.product?.businessLine.name ?? null,
        ...items[idx]!,
        subtotal: totals.lines[idx]!,
      })),
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      ivaPercent,
      iva: totals.iva,
      total: totals.total,
      conditions: str(form, "conditions") ?? company.conditions,
      notes: str(form, "notes"),
      validityDays,
      brand: form.get("useBrand") === "on" ? dealBrand(deal) : null,
    };

    const year = new Date().getFullYear();
    const validUntil = new Date(Date.now() + validityDays * 86400000);
    // Número correlativo por año (se reintenta si dos personas generan a la vez)
    let quote;
    for (let attempt = 0; ; attempt++) {
      try {
        quote = await prisma.$transaction(async (tx) => {
          const last = await tx.quote.aggregate({ where: { year }, _max: { number: true } });
          return tx.quote.create({
            data: {
              year,
              number: (last._max.number ?? 0) + 1,
              dealId,
              createdById: user.id,
              publicToken: randomBytes(18).toString("base64url"),
              validUntil,
              snapshot,
              total: totals.total,
            },
          });
        });
        break;
      } catch (e) {
        if (attempt < 3 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    // Enlace rastreado para compartir por WhatsApp o copiarlo (cuenta las vistas de la propuesta)
    await prisma.documentLink.create({
      data: { token: randomToken(), quoteId: quote.id, contactId: deal.contactId, label: "Enlace para compartir", createdById: user.id },
    });

    // El negocio avanza a la etapa de cotización si aún no llegó a ella
    const stages = await prisma.pipelineStage.findMany({ orderBy: { order: "asc" } });
    const quoteStage = stages.find((s) => normalize(s.name).startsWith("cotiz"));
    const moved = quoteStage && !deal.stage.isWon && !deal.stage.isLost && deal.stage.order < quoteStage.order;
    await prisma.$transaction([
      ...(moved
        ? [
            prisma.deal.update({ where: { id: dealId }, data: { stageId: quoteStage.id, stageChangedAt: new Date(), lastActivityAt: new Date() } }),
            prisma.activity.create({
              data: { type: "CAMBIO_ETAPA", subject: `Etapa: ${deal.stage.name} → ${quoteStage.name}`, dealId, authorId: user.id, completed: true },
            }),
          ]
        : [prisma.deal.update({ where: { id: dealId }, data: { lastActivityAt: new Date() } })]),
      prisma.activity.create({
        data: {
          type: "NOTA",
          subject: `Cotización ${quoteCode(quote.year, quote.number)} generada por US$ ${totals.total.toFixed(2)}`,
          dealId,
          authorId: user.id,
          completed: true,
        },
      }),
    ]);
    revalidatePath(`/negocios/${dealId}`);
    revalidatePath("/negocios");
  });
}

export async function sendQuoteEmail(quoteId: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    const current = await requirePermission("deals:write");
    if (!emailConfigured()) throw new Error("El correo aún no está configurado (RESEND_API_KEY y EMAIL_FROM).");
    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { deal: true } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: current.id } });
    const to = splitEmails(reqStr(form, "to", "Para"));
    const code = quoteCode(quote.year, quote.number);
    const message = str(form, "message") ?? "";
    const pdf = await renderQuotePdf(quote);
    const brand = (quote.snapshot as unknown as QuoteSnapshot).brand ?? null;
    // El contacto: el del negocio o, si no, quien tenga el correo del destinatario
    const contactId =
      quote.deal.contactId ??
      (await prisma.contact.findFirst({ where: { email: { equals: to[0], mode: "insensitive" } }, select: { id: true } }))?.id ??
      null;
    await sendClientEmail({
      user,
      to,
      subject: `${brand ? `${brand.name} · ` : ""}Cotización ${code} – ${quote.deal.name}`,
      body: message,
      contactId,
      dealId: quote.dealId,
      companyId: quote.deal.companyId,
      brand: brand ? { name: brand.name, primary: brand.primary, accent: brand.accent } : "egrow",
      quote: { id: quote.id, code, total: toNumber(quote.total).toFixed(2) },
      attachments: [{ filename: `${code}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }],
      activitySubject: `Cotización ${code} enviada a ${to.join(", ")}`,
    });
    await prisma.quote.update({ where: { id: quoteId }, data: { sentAt: new Date() } });
    revalidatePath(`/negocios/${quote.dealId}`);
  });
}
