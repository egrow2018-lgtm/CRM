"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importCsv } from "./actions";

const KIND_LABELS = { companies: "Empresas", contacts: "Contactos", deals: "Negocios" } as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Procesando…" : "Procesar archivo"}
    </button>
  );
}

export function ImportForm() {
  const [state, action] = useActionState(importCsv, undefined);
  const r = state?.result;
  return (
    <div className="space-y-4">
      <form action={action} className="card grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label className="label">¿Qué vas a importar?</label>
          <select name="kind" className="input" defaultValue="deals">
            <option value="companies">Empresas</option>
            <option value="contacts">Contactos</option>
            <option value="deals">Negocios</option>
          </select>
        </div>
        <div>
          <label className="label">Archivo CSV exportado de HubSpot</label>
          <input name="file" type="file" accept=".csv,text/csv" required className="input" />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="dryRun" defaultChecked />
          Solo simular (no guarda nada; muestra lo que pasaría)
        </label>
        <div className="sm:col-span-2"><Submit /></div>
      </form>

      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}

      {r && (
        <div className={`card p-5 ${r.dryRun ? "border-amber-300" : "border-emerald-300"}`}>
          <h2 className="mb-2 text-base">
            {r.dryRun ? "Simulación" : "Importación completada"} · {KIND_LABELS[r.kind]}
          </h2>
          <ul className="mb-3 grid gap-1 text-sm sm:grid-cols-2">
            <li>Filas en el archivo: <b>{r.rows}</b></li>
            <li>{r.dryRun ? "Se crearían" : "Creados"}: <b>{r.created}</b></li>
            <li>Omitidos (duplicados o vacíos): <b>{r.skipped}</b></li>
            <li>Empresas nuevas asociadas: <b>{r.companiesCreated}</b></li>
          </ul>
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-600">Columnas detectadas</summary>
            <table className="table mt-2">
              <tbody>
                {Object.entries(r.columns).map(([field, col]) => (
                  <tr key={field}>
                    <td className="text-slate-500">{field}</td>
                    <td>{col ?? <span className="text-slate-400">no encontrada</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          {r.warnings.map((w) => (
            <p key={w} className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{w}</p>
          ))}
          {r.dryRun && <p className="mt-3 text-sm text-slate-600">Si todo se ve bien, desmarca &quot;Solo simular&quot; y vuelve a procesar el archivo.</p>}
        </div>
      )}
    </div>
  );
}
