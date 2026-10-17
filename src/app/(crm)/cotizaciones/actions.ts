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
import { contactName, formatMoneyExact, toNumber } from "@/lib/format";
import { QUOTE_STATUS, computeTotals, parseQuoteLines, quoteCode, type QuoteSnapshot } from "@/lib/quotes";
import { getCompanySettings } from "@/lib/settings";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { appUrl, emailConfigured } from "@/lib/email";
import { sendClientEmail } from "@/lib/client-email";
import { splitEmails } from "@/lib/email-compose";
import { randomToken } from "@/lib/doc-stats";
import { normalize } from "@/lib/csv";
import { dealBrand } from "@/lib/brand";
import { normalizePhone } from "@/lib/phone";
import { quoteEditable } from "@/lib/quote-edit";

/** Datos del cliente de la cotización: los de un negocio o, sin negocio, los de un contacto (persona natural). */
async function quoteTarget(form: FormData, userId: string, dryRun = false) {
  if (str(form, "mode") !== "contacto") {
    const dealId = reqStr(form, "dealId", "Negocio");
    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: dealId },
      include: { businessLine: true, company: true, contact: true, owner: true, stage: true },
    });
    return {
      deal,
      contact: deal.contact,
      businessLine: deal.businessLine,
      owner: deal.owner,
      dealName: deal.name,
      client: {
        company: deal.company?.name ?? null,
        contact: deal.contact ? contactName(deal.contact) : null,
        email: deal.contact?.email ?? null,
        phone: deal.contact?.phone ?? deal.company?.phone ?? null,
        taxId: deal.company?.taxId ?? null,
        address: deal.company?.address ?? null,
      },
    };
  }

  // Cotización directa a un contacto: solo en las líneas que lo permiten (ej. Rutalink)
  const lineId = reqStr(form, "businessLineId", "Línea de negocio");
  const businessLine = await prisma.businessLine.findUniqueOrThrow({ where: { id: lineId } });
  if (!businessLine.quoteWithoutDeal) throw new Error(`La línea ${businessLine.name} no permite cotizar sin negocio. Elige o crea el negocio.`);
  const taxId = str(form, "taxId");
  const address = str(form, "address");
  let contactId = str(form, "contactId");
  if (!contactId && dryRun) {
    // Vista previa: el contacto nuevo aún no se crea; se muestran los datos escritos
    const name = [str(form, "firstName"), str(form, "lastName")].filter(Boolean).join(" ") || "(contacto nuevo)";
    return {
      deal: null,
      contact: null,
      businessLine,
      owner: null,
      dealName: `${businessLine.brandName || businessLine.name} · ${name}`,
      client: { company: null, contact: name, email: str(form, "email"), phone: normalizePhone(str(form, "phone")), taxId, address },
    };
  }
  if (!contactId) {
    const email = str(form, "email")?.toLowerCase() ?? null;
    // Si ya existe un contacto con ese correo, se usa ese (no se duplica)
    const existing = email ? await prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }) : null;
    contactId =
      existing?.id ??
      (
        await prisma.contact.create({
          data: {
            firstName: reqStr(form, "firstName", "Nombre"),
            lastName: str(form, "lastName"),
            email,
            phone: normalizePhone(str(form, "phone")),
            source: "Cotización",
            notes: [taxId && `Cédula/RUC: ${taxId}`, address && `Dirección: ${address}`].filter(Boolean).join("\n") || null,
            ownerId: userId,
            leadStatus: "EN_SEGUIMIENTO",
          },
        })
      ).id;
  }
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId }, include: { company: true, owner: true } });
  // Queda como lead en seguimiento (si aún no lo era)
  if (!dryRun && (!contact.leadStatus || contact.leadStatus === "NUEVO")) {
    await prisma.contact.update({ where: { id: contact.id }, data: { leadStatus: "EN_SEGUIMIENTO" } });
  }
  const name = contactName(contact);
  return {
    deal: null,
    contact,
    businessLine,
    owner: contact.owner,
    dealName: `${businessLine.brandName || businessLine.name} · ${name}`,
    client: {
      company: contact.company?.name ?? null,
      contact: name,
      email: contact.email,
      phone: contact.phone ?? contact.company?.phone ?? null,
      taxId: taxId ?? contact.company?.taxId ?? null,
      address: address ?? contact.company?.address ?? null,
    },
  };
}

/** Arma la cotización a partir del formulario (sin guardarla). Con `dryRun` no crea contactos: sirve para la vista previa. */
async function buildQuote(form: FormData, userId: string, dryRun = false) {
    let lines: ReturnType<typeof parseQuoteLines>;
    try {
      lines = parseQuoteLines(JSON.parse(String(form.get("lines") ?? "[]")));
    } catch {
      lines = [];
    }
    if (lines.length === 0) throw new Error("Agrega al menos un producto o servicio con su descripción.");
    const target = await quoteTarget(form, userId, dryRun);
    const products = await prisma.product.findMany({
      where: { id: { in: lines.flatMap((l) => (l.productId ? [l.productId] : [])) } },
      include: { businessLine: true },
    });
    const productOf = (id: string | null) => products.find((p) => p.id === id) ?? null;

    const company = await getCompanySettings();
    const ivaPercent = Math.min(100, Math.max(0, num(form, "ivaPercent") ?? company.ivaPercent));
    const validityDays = Math.min(365, Math.max(1, Math.round(num(form, "validityDays") ?? company.validityDays)));
    const totals = computeTotals(lines, ivaPercent);
    const owner = target.owner ?? (await prisma.user.findUnique({ where: { id: userId } }));
    // Marca: la de la línea del negocio o, si no tiene, la línea común de los productos cotizados
    const brand =
      form.get("useBrand") === "on"
        ? dealBrand({ businessLine: target.businessLine, items: lines.map((l) => ({ product: productOf(l.productId) })) })
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
      client: target.client,
      dealName: target.dealName,
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
      // Desglose por tipo de cobro (solo si hay servicios recurrentes)
      ...(totals.monthly > 0 || totals.annual > 0 ? { oneTime: totals.oneTime, monthly: totals.monthly, annual: totals.annual } : {}),
      brand,
    };

    return { lines, target, snapshot, totals, productOf, validityDays };
}

/** Vista previa del PDF con lo que hay en el formulario (no guarda nada ni usa un número correlativo). */
export async function previewQuote(form: FormData): Promise<{ pdf: string } | { error: string }> {
  try {
    const user = await requirePermission("deals:write");
    const { snapshot, validityDays } = await buildQuote(form, user.id, true);
    const now = new Date();
    const pdf = await renderQuotePdf({ year: now.getFullYear(), number: 0, code: "VISTA PREVIA", createdAt: now, validUntil: new Date(now.getTime() + validityDays * 86400000), snapshot });
    return { pdf: Buffer.from(pdf).toString("base64") };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo armar la vista previa." };
  }
}

/** Crea la cotización desde el módulo de Cotizaciones, atada a un negocio o directa a un contacto. */
export async function createQuote(_: ActionState, form: FormData) {
  return runAction(async () => {
    const user = await requirePermission("deals:write");
    const requestKey = str(form, "requestKey");
    // Doble clic o reintento: si esta solicitud ya creó la cotización, se abre esa
    if (requestKey) {
      const done = await prisma.quote.findUnique({ where: { requestKey }, select: { id: true } });
      if (done) return `/cotizaciones/${done.id}`;
    }
    const { lines, target, snapshot, totals, productOf, validityDays } = await buildQuote(form, user.id);
    const { deal } = target;
    const dealId = deal?.id ?? null;
    const year = new Date().getFullYear();
    const validUntil = new Date(Date.now() + validityDays * 86400000);
    // Corrección de una cotización que el cliente aún no ha recibido: mantiene su número
    const editId = str(form, "editId");
    let quote;
    if (editId) {
      if (!(await quoteEditable(editId))) throw new Error("Esta cotización ya se envió o el cliente ya la vio: genera una nueva versión.");
      quote = await prisma.quote.update({
        where: { id: editId },
        data: { snapshot, total: totals.total, validUntil, dealId, contactId: target.contact?.id ?? null, businessLineId: target.businessLine?.id ?? null },
      });
    }
    // Número correlativo por año (se reintenta si dos personas generan a la vez)
    for (let attempt = 0; !quote; attempt++) {
      try {
        quote = await prisma.$transaction(async (tx) => {
          const last = await tx.quote.aggregate({ where: { year }, _max: { number: true } });
          return tx.quote.create({
            data: {
              year,
              number: (last._max.number ?? 0) + 1,
              dealId,
              contactId: target.contact?.id ?? null,
              businessLineId: target.businessLine?.id ?? null,
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
    if (!editId) {
      await prisma.documentLink.create({
        data: { token: randomToken(), quoteId: quote.id, contactId: target.contact?.id ?? null, label: "Enlace para compartir", createdById: user.id },
      });
    }
    const noteSubject = `Cotización ${quoteCode(quote.year, quote.number)} ${editId ? "corregida antes de enviarla" : "generada"} · ${formatMoneyExact(totals.total)} con IVA`;

    if (!deal) {
      // Sin negocio: la nota queda en el historial del contacto
      const contactId = target.contact!.id;
      await prisma.$transaction([
        prisma.activity.create({ data: { type: "NOTA", subject: noteSubject, contactId, authorId: user.id, completed: true } }),
        prisma.contact.update({ where: { id: contactId }, data: { lastActivityAt: new Date() } }),
      ]);
      revalidatePath(`/contactos/${contactId}`);
      revalidatePath("/contactos");
      revalidatePath("/cotizaciones");
      return `/cotizaciones/${quote.id}`;
    }

    // Los productos del negocio y su valor quedan como en la última cotización
    // (así siguen funcionando los reportes por producto y las renovaciones)
    const stages = await prisma.pipelineStage.findMany({ orderBy: { order: "asc" } });
    const quoteStage = stages.find((s) => normalize(s.name).startsWith("cotiz"));
    const moved = quoteStage && !deal.stage.isWon && !deal.stage.isLost && deal.stage.order < quoteStage.order;
    const now = new Date();
    await prisma.$transaction([
      prisma.dealItem.deleteMany({ where: { dealId: deal.id } }),
      prisma.dealItem.createMany({
        data: lines.map((l) => ({
          dealId: deal.id,
          productId: productOf(l.productId)?.id ?? null,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          billing: l.billing,
          termMonths: l.termMonths,
        })),
      }),
      prisma.deal.update({
        where: { id: deal.id },
        // Valor del negocio = primer año; la mensualidad y la anualidad quedan aparte
        data: {
          amount: totals.subtotal,
          recurringMonthly: totals.monthly || null,
          recurringAnnual: totals.annual || null,
          lastActivityAt: now,
          ...(moved ? { stageId: quoteStage.id, stageChangedAt: now } : {}),
        },
      }),
      ...(moved
        ? [prisma.activity.create({ data: { type: "CAMBIO_ETAPA", subject: `Etapa: ${deal.stage.name} → ${quoteStage.name}`, dealId: deal.id, authorId: user.id, completed: true } })]
        : []),
      prisma.activity.create({
        data: { type: "NOTA", subject: noteSubject, dealId: deal.id, authorId: user.id, completed: true },
      }),
    ]);
    revalidatePath(`/negocios/${deal.id}`);
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
  if (quote.dealId) revalidatePath(`/negocios/${quote.dealId}`);
  if (quote.contactId) revalidatePath(`/contactos/${quote.contactId}`);
}

/**
 * El cliente aceptó la cotización: queda «Aprobada», sus productos pasan a ser los del negocio
 * y el negocio avanza a «En Producción». Si se cotizó sin negocio (persona natural), el negocio
 * se crea en ese momento, ya en producción, y el contacto queda como lead calificado.
 */
export async function acceptQuote(quoteId: string) {
  const user = await requireUser();
  if (!can(user, "deals:write") && !can(user, "deals:production")) throw new Error("No tienes permisos para aceptar cotizaciones.");
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { deal: { include: { stage: true } } } });
  const snap = quote.snapshot as unknown as QuoteSnapshot;
  const stages = await prisma.pipelineStage.findMany({ orderBy: { order: "asc" } });
  const production = stages.find((s) => normalize(s.name).includes("produccion"));
  const now = new Date();
  let deal = quote.deal;
  if (!deal) {
    const contact = quote.contactId ? await prisma.contact.findUnique({ where: { id: quote.contactId } }) : null;
    deal = await prisma.deal.create({
      data: {
        name: snap.dealName,
        stageId: (production ?? stages[0]!).id,
        businessLineId: quote.businessLineId,
        contactId: contact?.id ?? null,
        companyId: contact?.companyId ?? null,
        ownerId: contact?.ownerId ?? quote.createdById ?? user.id,
        closeDate: now,
        lastActivityAt: now,
      },
      include: { stage: true },
    });
    await prisma.$transaction([
      prisma.quote.update({ where: { id: quoteId }, data: { dealId: deal.id } }),
      prisma.emailMessage.updateMany({ where: { quoteId, dealId: null }, data: { dealId: deal.id } }),
      prisma.activity.create({
        data: { type: "NOTA", subject: `Negocio creado al aceptar la cotización ${quoteCode(quote.year, quote.number)}`, dealId: deal.id, authorId: user.id, completed: true },
      }),
      ...(contact ? [prisma.contact.update({ where: { id: contact.id }, data: { leadStatus: "CALIFICADO", lastActivityAt: now } })] : []),
    ]);
    if (contact) revalidatePath(`/contactos/${contact.id}`);
  }
  const moved = production && !deal.stage.isWon && !deal.stage.isLost && deal.stage.order < production.order;
  const validProducts = new Set(
    (await prisma.product.findMany({ where: { id: { in: (snap.items ?? []).flatMap((i) => (i.productId ? [i.productId] : [])) } }, select: { id: true } })).map((p) => p.id),
  );
  const code = quoteCode(quote.year, quote.number);
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
        billing: i.billing ?? "UNICO",
        termMonths: i.termMonths ?? null,
      })),
    }),
    prisma.deal.update({
      where: { id: deal.id },
      data: {
        amount: snap.subtotal,
        recurringMonthly: snap.monthly || null,
        recurringAnnual: snap.annual || null,
        lastActivityAt: now,
        ...(moved ? { stageId: production.id, stageChangedAt: now } : {}),
      },
    }),
    ...(moved
      ? [prisma.activity.create({ data: { type: "CAMBIO_ETAPA", subject: `Etapa: ${deal.stage.name} → ${production.name}`, dealId: deal.id, authorId: user.id, completed: true } })]
      : []),
    prisma.activity.create({
      data: { type: "NOTA", subject: `Cotización ${code} aceptada por el cliente · ${formatMoneyExact(quote.total)} con IVA`, dealId: deal.id, authorId: user.id, completed: true },
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
    for (const d of new Set(deals.flatMap((x) => (x.dealId ? [x.dealId] : [])))) revalidatePath(`/negocios/${d}`);
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
    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { deal: true, contact: { select: { companyId: true } } } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: current.id } });
    const to = splitEmails(reqStr(form, "to", "Para"));
    const code = quoteCode(quote.year, quote.number);
    const message = str(form, "message") ?? "";
    const pdf = await renderQuotePdf(quote);
    const brand = (quote.snapshot as unknown as QuoteSnapshot).brand ?? null;
    // El contacto: el del negocio o, si no, quien tenga el correo del destinatario
    const contactId =
      quote.deal?.contactId ??
      quote.contactId ??
      (await prisma.contact.findFirst({ where: { email: { equals: to[0], mode: "insensitive" } }, select: { id: true } }))?.id ??
      null;
    await sendClientEmail({
      user,
      to,
      subject: `${brand ? `${brand.name} · ` : ""}Cotización ${code} – ${quote.deal?.name ?? (quote.snapshot as unknown as QuoteSnapshot).dealName}`,
      body: message,
      contactId,
      dealId: quote.dealId,
      companyId: quote.deal?.companyId ?? quote.contact?.companyId ?? null,
      brand: brand ? { name: brand.name, primary: brand.primary, accent: brand.accent, logoUrl: await brandLogoUrl(quote.deal?.businessLineId ?? quote.businessLineId, brand.name) } : "egrow",
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
    if (quote.dealId) revalidatePath(`/negocios/${quote.dealId}`);
    if (contactId) revalidatePath(`/contactos/${contactId}`);
  });
}
