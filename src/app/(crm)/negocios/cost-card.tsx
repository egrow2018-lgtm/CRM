import type { ActionState } from "@/lib/forms";
import { formatMoneyExact } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/action-form";

/**
 * Costo del desarrollo, gasto adicional y margen del negocio.
 * Confidencial: solo se muestra con el permiso «deals:cost».
 */
export function DealCostCard({
  amount,
  cost,
  extra,
  action,
}: {
  amount: number;
  cost: number | null;
  extra: number | null;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const hasData = cost !== null || extra !== null;
  const margin = amount - (cost ?? 0) - (extra ?? 0);
  const pct = amount > 0 ? Math.round((margin / amount) * 1000) / 10 : null;
  return (
    <div className="card p-4">
      <h2 className="mb-1 flex items-center gap-2 text-base">
        Costo del desarrollo <span className="badge bg-slate-100 text-slate-600">🔒 Confidencial</span>
      </h2>
      <p className="mb-3 text-xs text-slate-500">Solo lo ven Administración, Gerencia y Proyectos.</p>
      <ActionForm action={action} successMessage="Costos guardados." className="grid grid-cols-2 items-end gap-3">
        <label className="block">
          <span className="label">Costo (US$)</span>
          <input name="developmentCost" inputMode="decimal" defaultValue={cost ?? ""} placeholder="0,00" className="input" />
        </label>
        <label className="block">
          <span className="label">Gasto adicional (US$)</span>
          <input name="extraExpense" inputMode="decimal" defaultValue={extra ?? ""} placeholder="0,00" className="input" />
        </label>
        <div className="col-span-2">
          <SubmitButton className="btn btn-sm btn-primary">Guardar costos</SubmitButton>
        </div>
      </ActionForm>
      {hasData && (
        <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Valor del negocio (sin IVA)</dt>
            <dd className="tabular-nums">{formatMoneyExact(amount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">− Costo del desarrollo</dt>
            <dd className="tabular-nums">{formatMoneyExact(cost ?? 0)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">− Gasto adicional</dt>
            <dd className="tabular-nums">{formatMoneyExact(extra ?? 0)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-1">
            <dt className="font-medium text-slate-700">Margen</dt>
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
