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
import { appUrl, emailButton, emailConfigured, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { normalize } from "@/lib/csv";

export async function createQuote(dealId: string, _: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("crm:write");
    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: dealId },
      include: {
        items: { include: { product: { include: { businessLine: true } } }, orderBy: { id: "asc" } },
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
    const user = await requirePermission("crm:write");
    if (!emailConfigured()) throw new Error("El correo aún no está configurado (RESEND_API_KEY y EMAIL_FROM).");
    const to = reqStr(form, "to", "Para")
      .split(/[,;\s]+/)
      .filter(Boolean);
    if (to.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) throw new Error("Revisa los correos del destinatario.");
    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { deal: true } });
    const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const code = quoteCode(quote.year, quote.number);
    const message = str(form, "message") ?? "";
    const pdf = await renderQuotePdf(quote);
    await sendEmail({
      to,
      cc: [me.email],
      replyTo: me.email,
      subject: `Cotización ${code} – ${quote.deal.name}`,
      html: emailLayout(
        `Cotización ${code}`,
        `${message ? `<p style="white-space:pre-line">${escapeHtml(message)}</p>` : ""}
         <p>Adjuntamos la cotización <b>${code}</b> por <b>US$ ${toNumber(quote.total).toFixed(2)}</b>.</p>
         <p>${emailButton(`${appUrl()}/c/${quote.publicToken}`, "Ver cotización en línea")}</p>
         <p style="color:#64748b">${escapeHtml(me.name)} · ${escapeHtml(me.email)}</p>`,
      ),
      attachments: [{ filename: `${code}.pdf`, content: Buffer.from(pdf) }],
    });
    await prisma.$transaction([
      prisma.quote.update({ where: { id: quoteId }, data: { sentAt: new Date() } }),
      prisma.activity.create({
        data: { type: "EMAIL", subject: `Cotización ${code} enviada a ${to.join(", ")}`, body: message || null, dealId: quote.dealId, authorId: user.id, completed: true },
      }),
      prisma.deal.update({ where: { id: quote.dealId }, data: { lastActivityAt: new Date() } }),
    ]);
    revalidatePath(`/negocios/${quote.dealId}`);
  });
}
