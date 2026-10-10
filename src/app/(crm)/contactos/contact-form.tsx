import type { Contact } from "@prisma/client";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { LEAD_STATUS } from "@/lib/leads";

export const CONTACT_SOURCES = ["Referido", "Sitio web", "LinkedIn", "Evento", "Llamada en frío", "Partner", "HubSpot", "Otro"];

export function ContactForm({
  action,
  contact,
  users,
  companies,
  defaultCompanyId,
  submitLabel = "Guardar",
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  contact?: Contact;
  users: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  defaultCompanyId?: string;
  submitLabel?: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nombre *"><input name="firstName" required defaultValue={contact?.firstName} className="input" /></Field>
      <Field label="Apellido"><input name="lastName" defaultValue={contact?.lastName ?? ""} className="input" /></Field>
      <Field label="Email"><input name="email" type="email" defaultValue={contact?.email ?? ""} className="input" /></Field>
      <Field label="Teléfono / WhatsApp"><input name="phone" defaultValue={contact?.phone ?? ""} className="input" /></Field>
      <Field label="Cargo"><input name="jobTitle" defaultValue={contact?.jobTitle ?? ""} className="input" /></Field>
      <Field label="Empresa">
        <select name="companyId" defaultValue={contact?.companyId ?? defaultCompanyId ?? ""} className="input">
          <option value="">— Ninguna —</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Origen">
        <select name="source" defaultValue={contact?.source ?? ""} className="input">
          <option value="">—</option>
          {CONTACT_SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label="Propietario">
        <select name="ownerId" defaultValue={contact?.ownerId ?? ""} className="input">
          <option value="">— Yo —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Estado del lead">
        <select name="leadStatus" defaultValue={contact?.leadStatus ?? ""} className="input">
          <option value="">— Sin estado —</option>
          {Object.entries(LEAD_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Notas" className="sm:col-span-2">
        <textarea name="notes" rows={3} defaultValue={contact?.notes ?? ""} className="input" />
      </Field>
      <div className="sm:col-span-2"><SubmitButton>{submitLabel}</SubmitButton></div>
    </ActionForm>
  );
}
