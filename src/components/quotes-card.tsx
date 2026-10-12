import Link from "next/link";
import type { Quote } from "@prisma/client";
import { ActionForm, ConfirmButton, SubmitButton } from "./action-form";
import { CopyButton } from "./copy-button";
import { formatDate, formatDateTime, formatMoneyExact } from "@/lib/format";
import { QUOTE_STATUS, quoteCode } from "@/lib/quotes";
import { acceptQuote, sendQuoteEmail } from "@/app/(crm)/cotizaciones/actions";
import { SemaforoPunto } from "./semaforo";

type QuoteWithLinks = Quote & { links?: { token: string; emailId: string | null; views: { startedAt: Date }[] }[] };

/** Cotizaciones del negocio (se crean en el módulo de Cotizaciones; aquí se ven, se envían y se aceptan). */
export function QuotesCard({
  dealId,
  quotes,
  canWrite,
  canAccept,
  baseUrl,
  contactEmail,
  emailEnabled,
}: {
  dealId: string;
  quotes: QuoteWithLinks[];
  canWrite: boolean;
  canAccept: boolean;
  baseUrl: string;
  contactEmail: string | null;
  emailEnabled: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base">Cotizaciones</h2>
        {canWrite && (
          <Link href={`/cotizaciones/nueva?dealId=${dealId}`} className="btn btn-primary btn-sm">
            + Nueva cotización
          </Link>
        )}
      </div>
      {quotes.length === 0 ? (
        <p className="text-sm text-slate-500">Aún no hay cotizaciones para este negocio.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {quotes.map((q, i) => (
            <QuoteRow
              key={q.id}
              q={q}
              main={i === 0}
              canWrite={canWrite}
              canAccept={canAccept}
              baseUrl={baseUrl}
              contactEmail={contactEmail}
              emailEnabled={emailEnabled}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function QuoteRow({
  q,
  main,
  canWrite,
  canAccept,
  baseUrl,
  contactEmail,
  emailEnabled,
}: {
  q: QuoteWithLinks;
  main: boolean;
  canWrite: boolean;
  canAccept: boolean;
  baseUrl: string;
  contactEmail: string | null;
  emailEnabled: boolean;
}) {
  const code = quoteCode(q.year, q.number);
  // Enlace rastreado para compartir (las cotizaciones antiguas usan el enlace público sin seguimiento)
  const share = q.links?.find((l) => !l.emailId);
  const publicUrl = share ? `${baseUrl}/d/${share.token}` : `${baseUrl}/c/${q.publicToken}`;
  const views = (q.links ?? []).flatMap((l) => l.views).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const expired = q.validUntil < new Date();
  const wa = `Hola, te comparto la cotización ${code}: ${publicUrl}`;
  const status = QUOTE_STATUS[q.status];
  return (
    <li className={main ? "pb-3" : "py-3"}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Link href={`/cotizaciones/${q.id}`} className="link">{code}</Link>
        <span className="font-semibold tabular-nums">{formatMoneyExact(q.total)}</span>
        <span className={`badge ${status.className}`}>{status.label}</span>
        <span className="text-xs text-slate-500">Emitida {formatDate(q.createdAt)}</span>
        <span className={`inline-flex items-center gap-1 text-xs ${expired ? "text-red-700" : "text-slate-500"}`}>
          <SemaforoPunto level={expired ? "rojo" : "verde"} title={expired ? "Vencida" : "Vigente"} />
          {expired ? "Vencida" : "Válida hasta"} {formatDate(q.validUntil)}
        </span>
        {q.sentAt && <span className="badge bg-brand-50 text-brand-700">Enviada {formatDate(q.sentAt)}</span>}
        {views.length > 0 ? (
          <span className="badge bg-amber-50 text-amber-800">
            👀 Vista {views.length} {views.length === 1 ? "vez" : "veces"} · última {formatDateTime(views[0].startedAt)}
          </span>
        ) : (
          q.sentAt && <span className="badge bg-slate-100 text-slate-500">Aún no la abren</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <a href={`/cotizaciones/${q.id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-sm">Ver PDF</a>
        <a href={`https://wa.me/?text=${encodeURIComponent(wa)}`} target="_blank" rel="noreferrer" className="btn btn-sm">WhatsApp</a>
        <CopyButton text={publicUrl} label="Copiar enlace" />
        {canAccept && q.status !== "APROBADA" && (
          <form action={acceptQuote.bind(null, q.id)}>
            <ConfirmButton
              className="btn btn-sm border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              message={`¿El cliente aceptó la cotización ${code}? Quedará «Aprobada», sus productos pasan al negocio y el negocio avanza a «En Producción».`}
            >
              ✓ Aceptada
            </ConfirmButton>
          </form>
        )}
        {canWrite && (
          <details className="w-full">
            <summary className="btn btn-sm cursor-pointer list-none">Enviar por correo</summary>
            {emailEnabled ? (
              <ActionForm action={sendQuoteEmail.bind(null, q.id)} successMessage="Cotización enviada." className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input name="to" required defaultValue={contactEmail ?? ""} placeholder="correo@cliente.com (varios separados por coma)" className="input" />
                <textarea
                  name="message"
                  rows={3}
                  className="input"
                  defaultValue={`Estimado/a,\n\nAdjunto la cotización ${code}. Quedo atento/a a sus comentarios.\n\nSaludos cordiales.`}
                />
                <p className="text-xs text-slate-500">Se adjunta el PDF y un botón para verla en línea: te avisaremos cuando la abran. Recibes una copia.</p>
                <div><SubmitButton pendingText="Enviando…">Enviar</SubmitButton></div>
              </ActionForm>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                El correo aún no está configurado. Usa WhatsApp o copia el enlace, o pide al administrador que conecte Resend.
              </p>
            )}
          </details>
        )}
      </div>
    </li>
  );
}
