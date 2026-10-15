import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { contactName, formatDate, formatDateTime, formatMoneyExact } from "@/lib/format";
import { BILLING, DEFAULT_TERM_MONTHS, quoteCode, type QuoteSnapshot } from "@/lib/quotes";
import { appUrl, emailConfigured } from "@/lib/email";
import { InfoRow, LineBadge, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/action-form";
import { QuoteRow } from "@/components/quotes-card";
import { EmailStatus } from "@/components/email-status";
import { QuoteStatusSelect } from "../status-select";
import { deleteQuote } from "../actions";
import { quoteEditable } from "@/lib/quote-edit";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      deal: {
        select: {
          id: true,
          name: true,
          businessLine: { select: { name: true, color: true } },
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          stage: { select: { name: true } },
          _count: { select: { quotes: true } },
        },
      },
      contact: { select: { id: true, firstName: true, lastName: true, email: true, company: { select: { id: true, name: true } } } },
      businessLine: { select: { name: true, color: true } },
      links: { select: { token: true, emailId: true, views: { select: { startedAt: true }, orderBy: { startedAt: "desc" } } }, orderBy: { createdAt: "asc" } },
      emails: { orderBy: { sentAt: "desc" }, select: { id: true, to: true, sentAt: true, openCount: true, clickCount: true, lastOpenedAt: true } },
    },
  });
  if (!quote) notFound();
  const snap = quote.snapshot as unknown as QuoteSnapshot;
  const code = quoteCode(quote.year, quote.number);
  const canWrite = can(user, "deals:write");
  // Se puede corregir mientras el cliente no la haya recibido (sin enviar ni abrir)
  const editable = canWrite && (await quoteEditable(quote.id));
  // Sin negocio (cotización directa a un contacto): los datos salen del contacto
  const contact = quote.deal?.contact ?? quote.contact;
  const company = quote.deal ? quote.deal.company : (quote.contact?.company ?? null);

  return (
    <div>
      <div className="mb-2 text-sm"><Link href="/cotizaciones" className="text-slate-500 hover:underline">← Cotizaciones</Link></div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {code}
            <QuoteStatusSelect id={quote.id} status={quote.status} disabled={!canWrite} />
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {quote.deal ? (
              <>
                <Link className="link" href={`/negocios/${quote.deal.id}`}>{quote.deal.name}</Link>
                <LineBadge line={quote.deal.businessLine} />
                <span>Etapa: {quote.deal.stage.name}</span>
              </>
            ) : (
              <>
                <span>Sin negocio · se crea al marcarla «Aceptada»</span>
                <LineBadge line={quote.businessLine} />
              </>
            )}
            {snap.brand && <span className="badge bg-slate-100 text-slate-600">Marca {snap.brand.name}</span>}
          </span>
        }
        actions={
          canWrite && (
            <>
              {editable && (
                <Link href={`/cotizaciones/nueva?editar=${quote.id}`} className="btn btn-primary" title="Aún no la recibe el cliente: se corrige manteniendo el número">
                  ✎ Corregir
                </Link>
              )}
              <Link href={`/cotizaciones/nueva?desde=${quote.id}`} className="btn">Nueva versión</Link>
              <form action={deleteQuote.bind(null, quote.id)}>
                <ConfirmButton message={`¿Eliminar la cotización ${code}? No se puede deshacer.`}>Eliminar</ConfirmButton>
              </form>
            </>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <div className="card p-4">
            <dl>
              <InfoRow label="Cliente">
                {company ? <Link className="link" href={`/empresas/${company.id}`}>{company.name}</Link> : (snap.client.company ?? (contact ? "Persona natural" : "—"))}
              </InfoRow>
              <InfoRow label="Contacto">
                {contact ? <Link className="link" href={`/contactos/${contact.id}`}>{contactName(contact)}</Link> : snap.client.contact}
              </InfoRow>
              {snap.client.taxId && <InfoRow label="Cédula / RUC">{snap.client.taxId}</InfoRow>}
              <InfoRow label="Emitida">{formatDate(quote.createdAt)}{quote.createdBy && ` · ${quote.createdBy.name}`}</InfoRow>
              <InfoRow label="Válida hasta">{formatDate(quote.validUntil)}</InfoRow>
              {quote.statusChangedAt && <InfoRow label="Último cambio de estado">{formatDateTime(quote.statusChangedAt)}</InfoRow>}
              {snap.notes && <InfoRow label="Observaciones">{snap.notes}</InfoRow>}
            </dl>
          </div>
          {quote.emails.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-2 text-base">Envíos por correo</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {quote.emails.map((e) => (
                  <li key={e.id} className="py-2">
                    <Link className="link" href={`/correos/${e.id}`}>{e.to.join(", ")}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {formatDateTime(e.sentAt)} <EmailStatus email={e} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <ul>
              <QuoteRow
                q={quote}
                main
                canWrite={canWrite}
                canAccept={canWrite || can(user, "deals:production")}
                baseUrl={appUrl()}
                contactEmail={contact?.email ?? null}
                emailEnabled={emailConfigured()}
              />
            </ul>
          </div>
          <div className="card overflow-x-auto p-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">Precio unit.</th>
                  <th className="text-right">Desc. %</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(snap.items ?? []).map((it, i) => (
                  <tr key={i}>
                    <td>
                      {it.description}
                      {it.detail && <div className="text-xs text-slate-400">{it.detail}</div>}
                      {it.billing && it.billing !== "UNICO" && (
                        <div className="text-xs text-accent-700">↻ {BILLING[it.billing].label} · contrato de {it.termMonths ?? DEFAULT_TERM_MONTHS} meses</div>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{it.quantity}</td>
                    <td className="text-right tabular-nums">{formatMoneyExact(it.unitPrice)}{it.billing ? BILLING[it.billing].per : ""}</td>
                    <td className="text-right tabular-nums">{it.discount}</td>
                    <td className="text-right tabular-nums">{formatMoneyExact(it.subtotal)}{it.billing ? BILLING[it.billing].per : ""}</td>
                  </tr>
                ))}
                {snap.monthly !== undefined && (
                  <>
                    <tr><td colSpan={4} className="text-right text-slate-500">Pago inicial</td><td className="text-right tabular-nums">{formatMoneyExact(snap.oneTime ?? 0)}</td></tr>
                    {(snap.monthly ?? 0) > 0 && (
                      <tr><td colSpan={4} className="text-right font-medium text-brand-700">Mensualidad (sin IVA)</td><td className="text-right font-medium tabular-nums text-brand-700">{formatMoneyExact(snap.monthly ?? 0)}/mes</td></tr>
                    )}
                    {(snap.annual ?? 0) > 0 && (
                      <tr><td colSpan={4} className="text-right font-medium text-brand-700">Anualidad (sin IVA)</td><td className="text-right font-medium tabular-nums text-brand-700">{formatMoneyExact(snap.annual ?? 0)}/año</td></tr>
                    )}
                  </>
                )}
                <tr><td colSpan={4} className="text-right text-slate-500">{snap.monthly !== undefined ? "Subtotal primer año" : "Subtotal"}</td><td className="text-right tabular-nums">{formatMoneyExact(snap.subtotal)}</td></tr>
                <tr><td colSpan={4} className="text-right text-slate-500">IVA {snap.ivaPercent}%</td><td className="text-right tabular-nums">{formatMoneyExact(snap.iva)}</td></tr>
                <tr><td colSpan={4} className="text-right font-semibold">{snap.monthly !== undefined ? "Total primer año" : "Total"}</td><td className="text-right font-semibold tabular-nums">{formatMoneyExact(snap.total)}</td></tr>
              </tbody>
            </table>
          </div>
          {quote.deal && quote.deal._count.quotes > 1 && (
            <p className="text-sm text-slate-500">
              Este negocio tiene {quote.deal._count.quotes} cotizaciones. <Link className="link" href={`/negocios/${quote.deal.id}`}>Verlas en el negocio</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
