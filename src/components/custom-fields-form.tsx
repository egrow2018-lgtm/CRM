import type { CustomField } from "@/lib/custom-fields";
import type { ActionState } from "@/lib/forms";
import { formatDate } from "@/lib/format";
import { ActionForm, SubmitButton } from "./action-form";
import { deliveryAlert } from "@/lib/alerts";
import { Semaforo } from "./semaforo";

/** Ficha de los campos adicionales de la línea (ej. "Datos del proyecto · E-learning"). */
export function CustomFieldsCard({
  title,
  fields,
  values,
  users,
  action,
  canEdit,
}: {
  title: string;
  fields: CustomField[];
  values: Record<string, string>;
  users: { id: string; name: string }[];
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  canEdit: boolean;
}) {
  if (fields.length === 0) return null;
  const display = (f: CustomField) => {
    const v = values[f.key];
    if (!v) return "—";
    if (f.type === "date") return formatDate(new Date(`${v}T00:00:00Z`));
    if (f.type === "user") return users.find((u) => u.id === v)?.name ?? "—";
    return f.suffix ? `${v} ${f.suffix}` : v;
  };
  const avance = Number(values.avance);
  const delivery = deliveryAlert(values.fechaEntrega, values.avance);

  return (
    <div className="card border-t-4 border-t-accent-500 p-4">
      <h2 className="mb-3 text-base">{title}</h2>
      {delivery && <Semaforo level={delivery.level} label={delivery.label} className="mb-3" />}
      {Number.isFinite(avance) && values.avance && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span>Avance del proyecto</span>
            <span className="font-semibold">{Math.min(100, avance)}%</span>
          </div>
          <div className="h-2 rounded bg-slate-100">
            <div className="h-2 rounded bg-accent-500" style={{ width: `${Math.min(100, Math.max(0, avance))}%` }} />
          </div>
        </div>
      )}
      {canEdit ? (
        <ActionForm action={action} successMessage="Datos del proyecto guardados." className="grid gap-3">
          {fields.map((f) => {
            const name = `cf_${f.key}`;
            const v = values[f.key] ?? "";
            return (
              <label key={f.key} className="block">
                <span className="label">
                  {f.label}
                  {f.suffix && <span className="text-slate-400"> ({f.suffix})</span>}
                </span>
                {f.type === "textarea" ? (
                  <textarea name={name} rows={3} defaultValue={v} placeholder={f.placeholder} className="input" />
                ) : f.type === "select" ? (
                  <select name={name} defaultValue={v} className="input">
                    <option value="">—</option>
                    {f.options?.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : f.type === "user" ? (
                  <select name={name} defaultValue={v} className="input">
                    <option value="">—</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={name}
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    step={f.type === "number" ? "any" : undefined}
                    defaultValue={v}
                    placeholder={f.placeholder}
                    className="input"
                  />
                )}
              </label>
            );
          })}
          <div><SubmitButton className="btn btn-primary btn-sm">Guardar datos del proyecto</SubmitButton></div>
        </ActionForm>
      ) : (
        <dl className="grid gap-2">
          {fields.map((f) => (
            <div key={f.key}>
              <dt className="text-xs text-slate-500">{f.label}</dt>
              <dd className="whitespace-pre-line text-sm">{display(f)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
