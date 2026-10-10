import type { Quote } from "@prisma/client";
import { ActionForm, SubmitButton } from "./action-form";
import { CopyButton } from "./copy-button";
import { formatDate, formatMoneyExact } from "@/lib/format";
import { quoteCode } from "@/lib/quotes";
import { createQuote, sendQuoteEmail } from "@/app/(crm)/cotizaciones/actions";
import type { CompanySettings } from "@/lib/settings";
import { SemaforoPunto } from "./semaforo";

export function QuotesCard({
  dealId,
  quotes,
  hasItems,
  canWrite,
  defaults,
  baseUrl,
  contactEmail,
  emailEnabled,
}: {
  dealId: string;
  quotes: Quote[];
  hasItems: boolean;
  canWrite: boolean;
  defaults: CompanySettings;
  baseUrl: string;
  contactEmail: string | null;
  emailEnabled: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base">Cotizaciones</h2>
        {canWrite && hasItems && (
          <details className="group w-full sm:w-auto">
            <summary className="btn btn-primary btn-sm cursor-pointer list-none">+ Generar cotización</summary>
            <ActionForm action={createQuote.bind(null, dealId)} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:w-[32rem]">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-500">
                  Validez (días)
                  <input name="validityDays" type="number" min="1" max="365" defaultValue={defaults.validityDays} className="input mt-1" />
                </label>
                <label className="text-xs text-slate-500">
                  IVA (%)
                  <input name="ivaPercent" type="number" min="0" max="100" step="0.01" defaultValue={defaults.ivaPercent} className="input mt-1" />
                </label>
              </div>
              <label className="text-xs text-slate-500">
                Observaciones (opcional)
                <textarea name="notes" rows={2} className="input mt-1" placeholder="Ej. Incluye 2 rondas de revisión del guion." />
              </label>
              <label className="text-xs text-slate-500">
                Condiciones comerciales (una por línea)
                <textarea name="conditions" rows={4} defaultValue={defaults.conditions} className="input mt-1" />
              </label>
              <div><SubmitButton pendingText="Generando…">Generar PDF</SubmitButton></div>
            </ActionForm>
          </details>
        )}
      </div>
      {!hasItems && quotes.length === 0 && (
        <p className="text-sm text-slate-500">Agrega productos o servicios al negocio para poder generar la cotización.</p>
      )}
      {quotes.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {quotes.map((q) => {
            const code = quoteCode(q.year, q.number);
            const publicUrl = `${baseUrl}/c/${q.publicToken}`;
            const expired = q.validUntil < new Date();
            const wa = `Hola, te comparto la cotización ${code}: ${publicUrl}`;
            return (
              <li key={q.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <a href={`/cotizaciones/${q.id}/pdf`} target="_blank" rel="noreferrer" className="link">{code}</a>
                  <span className="font-semibold tabular-nums">{formatMoneyExact(q.total)}</span>
                  <span className="text-xs text-slate-500">Emitida {formatDate(q.createdAt)}</span>
                  <span className={`inline-flex items-center gap-1 text-xs ${expired ? "text-red-700" : "text-slate-500"}`}>
                    <SemaforoPunto level={expired ? "rojo" : "verde"} title={expired ? "Vencida" : "Vigente"} />
                    {expired ? "Vencida" : "Válida hasta"} {formatDate(q.validUntil)}
                  </span>
                  {q.sentAt && <span className="badge bg-brand-50 text-brand-700">Enviada {formatDate(q.sentAt)}</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <a href={`/cotizaciones/${q.id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-sm">Ver PDF</a>
                  <a href={`https://wa.me/?text=${encodeURIComponent(wa)}`} target="_blank" rel="noreferrer" className="btn btn-sm">WhatsApp</a>
                  <CopyButton text={publicUrl} label="Copiar enlace" />
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
                          <p className="text-xs text-slate-500">Se adjunta el PDF y recibes una copia.</p>
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
          })}
        </ul>
      )}
    </div>
  );
}
