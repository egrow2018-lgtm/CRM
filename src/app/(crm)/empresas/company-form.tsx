import type { Company } from "@prisma/client";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/ui";
import type { ActionState } from "@/lib/forms";

export function CompanyForm({
  action,
  company,
  users,
  submitLabel = "Guardar",
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  company?: Company;
  users: { id: string; name: string }[];
  submitLabel?: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nombre *" className="sm:col-span-2">
        <input name="name" required defaultValue={company?.name} className="input" />
      </Field>
      <Field label="RUC / NIT"><input name="taxId" defaultValue={company?.taxId ?? ""} className="input" /></Field>
      <Field label="Industria"><input name="industry" defaultValue={company?.industry ?? ""} className="input" /></Field>
      <Field label="Sitio web"><input name="website" defaultValue={company?.website ?? ""} className="input" placeholder="https://" /></Field>
      <Field label="Teléfono"><input name="phone" defaultValue={company?.phone ?? ""} className="input" /></Field>
      <Field label="Dirección" className="sm:col-span-2"><input name="address" defaultValue={company?.address ?? ""} className="input" /></Field>
      <Field label="Ciudad"><input name="city" defaultValue={company?.city ?? ""} className="input" /></Field>
      <Field label="País"><input name="country" defaultValue={company?.country ?? ""} className="input" /></Field>
      <Field label="Propietario">
        <select name="ownerId" defaultValue={company?.ownerId ?? ""} className="input">
          <option value="">— Yo —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Notas" className="sm:col-span-2">
        <textarea name="notes" rows={3} defaultValue={company?.notes ?? ""} className="input" />
      </Field>
      <div className="sm:col-span-2"><SubmitButton>{submitLabel}</SubmitButton></div>
    </ActionForm>
  );
}
