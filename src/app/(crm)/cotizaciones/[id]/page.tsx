import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { contactName, formatDate, formatDateTime, formatMoneyExact } from "@/lib/format";
import { quoteCode, type QuoteSnapshot } from "@/lib/quotes";
import { appUrl, emailConfigured } from "@/lib/email";
import { InfoRow, LineBadge, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/action-form";
import { QuoteRow } from "@/components/quotes-card";
import { EmailStatus } from "@/components/email-status";
import { QuoteStatusSelect } from "../status-select";
import { deleteQuote } from "../actions";

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
      links: { select: { token: true, emailId: true, views: { select: { startedAt: true }, orderBy: { startedAt: "desc" } } }, orderBy: { createdAt: "asc" } },
      emails: { orderBy: { sentAt: "desc" }, select: { id: true, to: true, sentAt: true, openCount: true, clickCount: true, lastOpenedAt: true } },
    },
  });
  if (!quote) notFound();
  const snap = quote.snapshot as unknown as QuoteSnapshot;
  const code = quoteCode(quote.year, quote.number);
  const canWrite = can(user, "deals:write");

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
            <Link className="link" href={`/negocios/${quote.deal.id}`}>{quote.deal.name}</Link>
            <LineBadge line={quote.deal.businessLine} />
            <span>Etapa: {quote.deal.stage.name}</span>
            {snap.brand && <span className="badge bg-slate-100 text-slate-600">Marca {snap.brand.name}</span>}
          </span>
        }
        actions={
          canWrite && (
            <>
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
                {quote.deal.company ? <Link className="link" href={`/empresas/${quote.deal.company.id}`}>{quote.deal.company.name}</Link> : (snap.client.company ?? "—")}
              </InfoRow>
              <InfoRow label="Contacto">
                {quote.deal.contact ? <Link className="link" href={`/contactos/${quote.deal.contact.id}`}>{contactName(quote.deal.contact)}</Link> : snap.client.contact}
              </InfoRow>
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
                contactEmail={quote.deal.contact?.email ?? null}
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
                    <td>{it.description}{it.detail && <div className="text-xs text-slate-400">{it.detail}</div>}</td>
                    <td className="text-right tabular-nums">{it.quantity}</td>
                    <td className="text-right tabular-nums">{formatMoneyExact(it.unitPrice)}</td>
                    <td className="text-right tabular-nums">{it.discount}</td>
                    <td className="text-right tabular-nums">{formatMoneyExact(it.subtotal)}</td>
                  </tr>
                ))}
                <tr><td colSpan={4} className="text-right text-slate-500">Subtotal</td><td className="text-right tabular-nums">{formatMoneyExact(snap.subtotal)}</td></tr>
                <tr><td colSpan={4} className="text-right text-slate-500">IVA {snap.ivaPercent}%</td><td className="text-right tabular-nums">{formatMoneyExact(snap.iva)}</td></tr>
                <tr><td colSpan={4} className="text-right font-semibold">Total</td><td className="text-right font-semibold tabular-nums">{formatMoneyExact(snap.total)}</td></tr>
              </tbody>
            </table>
          </div>
          {quote.deal._count.quotes > 1 && (
            <p className="text-sm text-slate-500">
              Este negocio tiene {quote.deal._count.quotes} cotizaciones. <Link className="link" href={`/negocios/${quote.deal.id}`}>Verlas en el negocio</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
