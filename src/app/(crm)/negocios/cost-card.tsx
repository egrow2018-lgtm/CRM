import type { ActionState } from "@/lib/forms";
import { formatMoneyExact } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/action-form";

/** Costo del desarrollo y margen del negocio. Confidencial: solo se muestra con el permiso «deals:cost». */
export function DealCostCard({
  amount,
  cost,
  action,
}: {
  amount: number;
  cost: number | null;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const margin = cost === null ? null : amount - cost;
  const pct = margin !== null && amount > 0 ? Math.round((margin / amount) * 1000) / 10 : null;
  return (
    <div className="card p-4">
      <h2 className="mb-1 flex items-center gap-2 text-base">
        Costo del desarrollo <span className="badge bg-slate-100 text-slate-600">🔒 Confidencial</span>
      </h2>
      <p className="mb-3 text-xs text-slate-500">Solo lo ven Administración, Gerencia y Proyectos.</p>
      <ActionForm action={action} successMessage="Costo guardado." className="flex flex-wrap items-end gap-2">
        <label className="block flex-1">
          <span className="label">Costo (US$)</span>
          <input name="developmentCost" inputMode="decimal" defaultValue={cost ?? ""} placeholder="0,00" className="input" />
        </label>
        <SubmitButton className="btn btn-sm btn-primary">Guardar</SubmitButton>
      </ActionForm>
      {margin !== null && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Valor del negocio</dt>
            <dd className="tabular-nums">{formatMoneyExact(amount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Margen</dt>
            <dd className={`font-semibold tabular-nums ${margin < 0 ? "text-red-700" : "text-emerald-700"}`}>
              {formatMoneyExact(margin)}
              {pct !== null && <span className="ml-1 text-xs font-normal">({pct}%)</span>}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
