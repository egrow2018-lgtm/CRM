"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { num, reqStr, str, type ActionState } from "@/lib/forms";
import { runAction } from "@/lib/run-action";
import { contactName, toNumber } from "@/lib/format";
import { QUOTE_STATUS, computeTotals, parseQuoteLines, quoteCode, type QuoteSnapshot } from "@/lib/quotes";
import { getCompanySettings } from "@/lib/settings";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { appUrl, emailConfigured } from "@/lib/email";
import { sendClientEmail } from "@/lib/client-email";
import { splitEmails } from "@/lib/email-compose";
import { randomToken } from "@/lib/doc-stats";
import { normalize } from "@/lib/csv";
import { dealBrand } from "@/lib/brand";

/** Crea la cotización desde el módulo de Cotizaciones, atada a un negocio. */
export async function createQuote(_: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("deals:write");
    const dealId = reqStr(form, "dealId", "Negocio");
    const requestKey = str(form, "requestKey");
    // Doble clic o reintento: si esta solicitud ya creó la cotización, se abre esa
    if (requestKey) {
      const done = await prisma.quote.findUnique({ where: { requestKey }, select: { id: true } });
      if (done) return `/cotizaciones/${done.id}`;
    }
    let lines: ReturnType<typeof parseQuoteLines>;
    try {
      lines = parseQuoteLines(JSON.parse(String(form.get("lines") ?? "[]")));
    } catch {
      lines = [];
    }
    if (lines.length === 0) throw new Error("Agrega al menos un producto o servicio con su descripción.");

    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: dealId },
      include: { businessLine: true, company: true, contact: true, owner: true, stage: true },
    });
    const products = await prisma.product.findMany({
      where: { id: { in: lines.flatMap((l) => (l.productId ? [l.productId] : [])) } },
      include: { businessLine: true },
    });
    const productOf = (id: string | null) => products.find((p) => p.id === id) ?? null;

    const company = await getCompanySettings();
    const ivaPercent = Math.min(100, Math.max(0, num(form, "ivaPercent") ?? company.ivaPercent));
    const validityDays = Math.min(365, Math.max(1, Math.round(num(form, "validityDays") ?? company.validityDays)));
    const totals = computeTotals(lines, ivaPercent);
    const owner = deal.owner ?? (await prisma.user.findUnique({ where: { id: user.id } }));
    // Marca: la de la línea del negocio o, si no tiene, la línea común de los productos cotizados
    const brand =
      form.get("useBrand") === "on"
        ? dealBrand({ businessLine: deal.businessLine, items: lines.map((l) => ({ product: productOf(l.productId) })) })
        : null;

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
      items: lines.map((l, idx) => ({
        ...l,
        detail: productOf(l.productId)?.businessLine.name ?? null,
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
      brand,
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
              requestKey,
            },
          });
        });
        break;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          // La misma solicitud llegó dos veces al mismo tiempo: se usa la que ya se creó
          const target = String(e.meta?.target ?? "");
          if (requestKey && target.includes("requestKey")) {
            const done = await prisma.quote.findUnique({ where: { requestKey }, select: { id: true } });
            if (done) return `/cotizaciones/${done.id}`;
          }
          if (attempt < 3) continue;
        }
        throw e;
      }
    }
    // Enlace rastreado para compartir por WhatsApp o copiarlo (cuenta las vistas de la propuesta)
    await prisma.documentLink.create({
      data: { token: randomToken(), quoteId: quote.id, contactId: deal.contactId, label: "Enlace para compartir", createdById: user.id },
    });

    // Los productos del negocio y su valor quedan como en la última cotización
    // (así siguen funcionando los reportes por producto y las renovaciones)
    const stages = await prisma.pipelineStage.findMany({ orderBy: { order: "asc" } });
    const quoteStage = stages.find((s) => normalize(s.name).startsWith("cotiz"));
    const moved = quoteStage && !deal.stage.isWon && !deal.stage.isLost && deal.stage.order < quoteStage.order;
    const now = new Date();
    await prisma.$transaction([
      prisma.dealItem.deleteMany({ where: { dealId } }),
      prisma.dealItem.createMany({
        data: lines.map((l) => ({ dealId, productId: productOf(l.productId)?.id ?? null, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount })),
      }),
      prisma.deal.update({
        where: { id: dealId },
        data: { amount: totals.subtotal, lastActivityAt: now, ...(moved ? { stageId: quoteStage.id, stageChangedAt: now } : {}) },
      }),
      ...(moved
        ? [prisma.activity.create({ data: { type: "CAMBIO_ETAPA", subject: `Etapa: ${deal.stage.name} → ${quoteStage.name}`, dealId, authorId: user.id, completed: true } })]
        : []),
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
    revalidatePath("/cotizaciones");
    return `/cotizaciones/${quote.id}`;
  });
}

export async function setQuoteStatus(quoteId: string, status: QuoteStatus) {
  await requirePermission("deals:write");
  if (!(status in QUOTE_STATUS)) throw new Error("Estado inválido.");
  const quote = await prisma.quote.update({ where: { id: quoteId }, data: { status, statusChangedAt: new Date() } });
  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${quoteId}`);
  revalidatePath(`/negocios/${quote.dealId}`);
}

/**
 * El cliente aceptó la cotización: queda «Aprobada», sus productos pasan a ser los del negocio
 * y el negocio avanza a «En Producción».
 */
export async function acceptQuote(quoteId: string) {
  const user = await requireUser();
  if (!can(user, "deals:write") && !can(user, "deals:production")) throw new Error("No tienes permisos para aceptar cotizaciones.");
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { deal: { include: { stage: true } } } });
  const snap = quote.snapshot as unknown as QuoteSnapshot;
  const stages = await prisma.pipelineStage.findMany({ orderBy: { order: "asc" } });
  const production = stages.find((s) => normalize(s.name).includes("produccion"));
  const deal = quote.deal;
  const moved = production && !deal.stage.isWon && !deal.stage.isLost && deal.stage.order < production.order;
  const validProducts = new Set(
    (await prisma.product.findMany({ where: { id: { in: (snap.items ?? []).flatMap((i) => (i.productId ? [i.productId] : [])) } }, select: { id: true } })).map((p) => p.id),
  );
  const code = quoteCode(quote.year, quote.number);
  const now = new Date();
  await prisma.$transaction([
    prisma.quote.update({ where: { id: quoteId }, data: { status: "APROBADA", statusChangedAt: now } }),
    prisma.dealItem.deleteMany({ where: { dealId: deal.id } }),
    prisma.dealItem.createMany({
      data: (snap.items ?? []).map((i) => ({
        dealId: deal.id,
        productId: i.productId && validProducts.has(i.productId) ? i.productId : null,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
      })),
    }),
    prisma.deal.update({
      where: { id: deal.id },
      data: { amount: snap.subtotal, lastActivityAt: now, ...(moved ? { stageId: production.id, stageChangedAt: now } : {}) },
    }),
    ...(moved
      ? [prisma.activity.create({ data: { type: "CAMBIO_ETAPA", subject: `Etapa: ${deal.stage.name} → ${production.name}`, dealId: deal.id, authorId: user.id, completed: true } })]
      : []),
    prisma.activity.create({
      data: { type: "NOTA", subject: `Cotización ${code} aceptada por el cliente (US$ ${toNumber(quote.total).toFixed(2)})`, dealId: deal.id, authorId: user.id, completed: true },
    }),
  ]);
  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${quoteId}`);
  revalidatePath(`/negocios/${deal.id}`);
  revalidatePath("/negocios");
}

/** Borra cotizaciones (por ejemplo, duplicadas). */
export async function deleteQuotes(ids: string[]) {
  try {
    await requirePermission("deals:write");
    const valid = ids.filter((x) => typeof x === "string").slice(0, 200);
    const deals = await prisma.quote.findMany({ where: { id: { in: valid } }, select: { dealId: true } });
    const { count } = await prisma.quote.deleteMany({ where: { id: { in: valid } } });
    revalidatePath("/cotizaciones");
    for (const d of new Set(deals.map((x) => x.dealId))) revalidatePath(`/negocios/${d}`);
    return { deleted: count };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudieron eliminar." };
  }
}

export async function deleteQuote(id: string) {
  const res = await deleteQuotes([id]);
  if (res.error) throw new Error(res.error);
  redirect("/cotizaciones");
}

/** URL pública del logo de la marca de la cotización (la línea del negocio o la que tenga ese nombre de marca). */
async function brandLogoUrl(lineId: string | null, brandName: string) {
  const lines = await prisma.businessLine.findMany({ where: { brandLogo: { not: null } }, select: { id: true, name: true, brandName: true } });
  const line = lines.find((l) => l.id === lineId) ?? lines.find((l) => (l.brandName || l.name) === brandName);
  return line ? `${appUrl()}/api/logo/linea/${line.id}` : null;
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
      brand: brand ? { name: brand.name, primary: brand.primary, accent: brand.accent, logoUrl: await brandLogoUrl(quote.deal.businessLineId, brand.name) } : "egrow",
      quote: { id: quote.id, code, total: toNumber(quote.total).toFixed(2) },
      attachments: [{ filename: `${code}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }],
      activitySubject: `Cotización ${code} enviada a ${to.join(", ")}`,
    });
    await prisma.quote.update({
      where: { id: quoteId },
      data: { sentAt: new Date(), ...(quote.status === "EMITIDA" ? { status: "EN_REVISION", statusChangedAt: new Date() } : {}) },
    });
    revalidatePath("/cotizaciones");
    revalidatePath(`/cotizaciones/${quoteId}`);
    revalidatePath(`/negocios/${quote.dealId}`);
  });
}
