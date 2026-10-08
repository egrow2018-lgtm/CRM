import type { Deal } from "@prisma/client";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { contactName, toDateInput, toNumber } from "@/lib/format";
import type { getFormOptions } from "@/lib/queries";

type Options = Awaited<ReturnType<typeof getFormOptions>>;

export function DealForm({
  action,
  options,
  deal,
  defaults,
  hasItems,
  submitLabel = "Guardar",
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  options: Options;
  deal?: Deal;
  defaults?: Partial<Pick<Deal, "companyId" | "contactId" | "ownerId" | "businessLineId">>;
  hasItems?: boolean;
  submitLabel?: string;
}) {
  const d = { ...defaults, ...deal };
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nombre del negocio *" className="sm:col-span-2">
        <input name="name" required defaultValue={deal?.name} className="input" placeholder="Ej. Holcim – Ludus" />
      </Field>
      <Field label="Etapa *">
        <select name="stageId" required defaultValue={deal?.stageId ?? options.stages[0]?.id} className="input">
          {options.stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.probability}%)</option>
          ))}
        </select>
      </Field>
      <Field label="Línea de negocio">
        <select name="businessLineId" defaultValue={d.businessLineId ?? ""} className="input">
          <option value="">— Sin línea —</option>
          {options.lines.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </Field>
      <Field label={hasItems ? "Valor (US$) — calculado desde los productos" : "Valor (US$)"}>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0"
          defaultValue={deal ? toNumber(deal.amount) : ""}
          disabled={hasItems}
          className="input disabled:bg-slate-100"
        />
      </Field>
      <Field label="Fecha de cierre">
        <input name="closeDate" type="date" defaultValue={toDateInput(deal?.closeDate)} className="input" />
      </Field>
      <Field label="Empresa">
        <select name="companyId" defaultValue={d.companyId ?? ""} className="input">
          <option value="">— Ninguna —</option>
          {options.companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Contacto principal">
        <select name="contactId" defaultValue={d.contactId ?? ""} className="input">
          <option value="">— Ninguno —</option>
          {options.contacts.map((c) => (
            <option key={c.id} value={c.id}>{contactName(c)}</option>
          ))}
        </select>
      </Field>
      <Field label="Propietario del negocio">
        <select name="ownerId" defaultValue={d.ownerId ?? ""} className="input">
          <option value="">— Yo —</option>
          {options.users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Motivo de pérdida (si aplica)">
        <input name="lostReason" defaultValue={deal?.lostReason ?? ""} className="input" />
      </Field>
      <Field label="Descripción" className="sm:col-span-2">
        <textarea name="description" rows={3} defaultValue={deal?.description ?? ""} className="input" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
