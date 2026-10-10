import Link from "next/link";
import { fetchGpsboxSummary, gpsboxEnabled, gpsboxLink, gpsboxReadEnabled, normalizeTaxId } from "@/lib/gpsbox";
import { renewalAlert } from "@/lib/alerts";
import { formatDate } from "@/lib/format";
import { Semaforo } from "./semaforo";

type Company = {
  id: string;
  name: string;
  taxId: string | null;
  phone: string | null;
  city: string | null;
};
type Contact = { firstName: string; lastName: string | null; email: string | null; phone: string | null } | null;

/** Tarjeta de enlace con GPSBox (operación de Rutalink) en la ficha de la empresa. */
export async function GpsboxCard({ company, contact, canEdit }: { company: Company; contact: Contact; canEdit: boolean }) {
  if (!gpsboxEnabled()) return null;
  const hasTaxId = !!normalizeTaxId(company.taxId);
  const summary = hasTaxId ? await fetchGpsboxSummary(company.taxId) : null;
  const href = hasTaxId ? gpsboxLink({ ...company, contact }) : null;
  const renewal = summary && summary !== "error" && summary.proximaRenovacion ? renewalAlert(`${summary.proximaRenovacion}T00:00:00Z`) : null;

  return (
    <div className="card border-t-4 border-t-brand-700 p-4">
      <h2 className="mb-1 text-base">Rutalink · GPSBox</h2>
      {!hasTaxId ? (
        <p className="text-sm text-slate-600">
          Agrega el <b>RUC o cédula</b> de la empresa para enlazarla con su cliente en GPSBox.
          {canEdit && (
            <>
              {" "}
              <Link className="link" href={`/empresas/${company.id}?edit=1`}>Agregar RUC</Link>
            </>
          )}
        </p>
      ) : summary && summary !== "error" ? (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span>
              <span className="text-2xl font-semibold tabular-nums text-brand-700">{summary.unidadesActivas}</span>{" "}
              unidad{summary.unidadesActivas === 1 ? "" : "es"} activa{summary.unidadesActivas === 1 ? "" : "s"}
            </span>
            <span className="text-xs text-slate-500">
              {summary.unidadesTotal} en total · Plan {summary.tipoPlan ?? "—"} · Cliente {summary.estado ?? "—"}
            </span>
          </div>
          {renewal && (
            <Semaforo level={renewal.level} label={`Próxima renovación ${formatDate(new Date(`${summary.proximaRenovacion}T00:00:00Z`))} · ${renewal.label}`} />
          )}
          <div>
            <a href={href!} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">Abrir en GPSBox ↗</a>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm text-slate-600">
          {summary === "error" ? (
            <p>No se pudo consultar GPSBox en este momento.</p>
          ) : gpsboxReadEnabled() ? (
            <p>Este RUC aún no está registrado como cliente en GPSBox.</p>
          ) : (
            <p>Abre GPSBox con el RUC {normalizeTaxId(company.taxId)}: si el cliente no existe, se abre el formulario con los datos ya llenos.</p>
          )}
          <a href={href!} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">
            {gpsboxReadEnabled() && summary !== "error" ? "Crear cliente en GPSBox ↗" : "Abrir en GPSBox ↗"}
          </a>
        </div>
      )}
    </div>
  );
}
