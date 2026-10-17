import Link from "next/link";
import type { Quote } from "@prisma/client";
import { ActionForm, ConfirmButton, SubmitButton } from "./action-form";
import { CopyButton } from "./copy-button";
import { formatDateTime, formatMoneyExact, formatLocalDate } from "@/lib/format";
import { QUOTE_STATUS, quoteCode, quoteEmailMessage, quoteEmailSubject, quoteWhatsappText, splitQuoteVersions, type QuoteSnapshot } from "@/lib/quotes";
import { whatsappUrl } from "@/lib/phone";
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
  contactPhone = null,
  contactFirstName = null,
  emailEnabled,
}: {
  dealId: string;
  quotes: QuoteWithLinks[];
  canWrite: boolean;
  canAccept: boolean;
  baseUrl: string;
  contactEmail: string | null;
  contactPhone?: string | null;
  contactFirstName?: string | null;
  emailEnabled: boolean;
}) {
  const { current, previous } = splitQuoteVersions(quotes);
  const rowProps = { canWrite, canAccept, baseUrl, contactEmail, contactPhone, contactFirstName, emailEnabled };
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
        <>
          <ul>
            <QuoteRow q={current!} main badge={previous.length > 0 ? "Versión vigente" : null} {...rowProps} />
          </ul>
          {previous.length > 0 && (
            // Las versiones anteriores quedan plegadas y atenuadas: así no se envía ni se acepta una por error
            <details className="mt-1 border-t border-slate-100 pt-2">
              <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-900">
                Versiones anteriores ({previous.length})
              </summary>
              <ul className="divide-y divide-slate-100 opacity-80">
                {previous.map((q) => (
                  <QuoteRow key={q.id} q={q} main={false} badge="Anterior" {...rowProps} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

export function QuoteRow({
  q,
  main,
  badge = null,
  canWrite,
  canAccept,
  baseUrl,
  contactEmail,
  contactPhone = null,
  contactFirstName = null,
  emailEnabled,
}: {
  q: QuoteWithLinks;
  main: boolean;
  /** «Versión vigente» o «Anterior», cuando el negocio tiene varias cotizaciones */
  badge?: string | null;
  canWrite: boolean;
  canAccept: boolean;
  baseUrl: string;
  contactEmail: string | null;
  contactPhone?: string | null;
  contactFirstName?: string | null;
  emailEnabled: boolean;
}) {
  const code = quoteCode(q.year, q.number);
  // Enlace rastreado para compartir (las cotizaciones antiguas usan el enlace público sin seguimiento)
  const share = q.links?.find((l) => !l.emailId);
  const publicUrl = share ? `${baseUrl}/d/${share.token}` : `${baseUrl}/c/${q.publicToken}`;
  const views = (q.links ?? []).flatMap((l) => l.views).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const expired = q.validUntil < new Date();
  const snap = q.snapshot as unknown as Partial<QuoteSnapshot> | null;
  const dealName = snap?.dealName || null;
  const wa = quoteWhatsappText({
    code,
    firstName: contactFirstName,
    dealName,
    validUntil: formatLocalDate(q.validUntil),
    url: publicUrl,
  });
  const status = QUOTE_STATUS[q.status];
  return (
    <li className={main ? "pb-3" : "py-3"}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Link href={`/cotizaciones/${q.id}`} className="link">{code}</Link>
        {badge && (
          <span className={`badge ${badge === "Anterior" ? "bg-slate-100 text-slate-500" : "bg-brand-700 text-white"}`}>{badge}</span>
        )}
        <span className="font-semibold tabular-nums">{formatMoneyExact(q.total)} <span className="text-xs font-normal text-slate-500">IVA incluido</span></span>
        <span className={`badge ${status.className}`}>{status.label}</span>
        <span className="text-xs text-slate-500">Emitida {formatLocalDate(q.createdAt)}</span>
        <span className={`inline-flex items-center gap-1 text-xs ${expired ? "text-red-700" : "text-slate-500"}`}>
          <SemaforoPunto level={expired ? "rojo" : "verde"} title={expired ? "Vencida" : "Vigente"} />
          {expired ? "Vencida" : "Válida hasta"} {formatLocalDate(q.validUntil)}
        </span>
        {q.sentAt && <span className="badge bg-brand-50 text-brand-700">Enviada {formatLocalDate(q.sentAt)}</span>}
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
        <a href={whatsappUrl(contactPhone, wa)} target="_blank" rel="noreferrer" className="btn btn-sm" title={contactPhone ? `Abre el chat con ${contactPhone}` : "El contacto no tiene teléfono: elige el chat en WhatsApp"}>WhatsApp</a>
        <CopyButton text={publicUrl} label="Copiar enlace" />
        {canAccept && q.status !== "APROBADA" && (
          <form action={acceptQuote.bind(null, q.id)}>
            <ConfirmButton
              className="btn btn-sm text-emerald-800"
              message={q.dealId ? `¿El cliente aceptó la cotización ${code}? Quedará «Aprobada», sus productos pasan al negocio y el negocio avanza a «En Producción».` : `¿El cliente aceptó la cotización ${code}? Quedará «Aprobada», se creará el negocio en «En Producción» y el contacto pasa a lead calificado.`}
            >
              Marcar como aceptada
            </ConfirmButton>
          </form>
        )}
        {canWrite && (
          <details className="w-full">
            <summary className="btn btn-sm cursor-pointer list-none">Enviar por correo</summary>
            {emailEnabled ? (
              <ActionForm action={sendQuoteEmail.bind(null, q.id)} successMessage="Cotización enviada." className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="text-xs text-slate-500">
                  Para
                  <input name="to" required defaultValue={contactEmail ?? ""} placeholder="correo@cliente.com (varios separados por coma)" className="input mt-1" />
                </label>
                <label className="text-xs text-slate-500">
                  Asunto
                  <input name="subject" required defaultValue={quoteEmailSubject({ code, dealName, brandName: snap?.brand?.name ?? null })} className="input mt-1" />
                </label>
                <label className="text-xs text-slate-500">
                  Mensaje
                  <textarea name="message" rows={7} className="input mt-1 [field-sizing:content]" defaultValue={quoteEmailMessage({ code, firstName: contactFirstName, dealName })} />
                </label>
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
