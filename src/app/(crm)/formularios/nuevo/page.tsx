import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, PageHeader } from "@/components/ui";
import { createForm } from "../actions";

export default async function NewFormPage() {
  await requirePagePermission("forms:manage");
  const [lines, users] = await Promise.all([
    prisma.businessLine.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Nuevo formulario" subtitle="Se crea con los campos típicos (nombre, email, teléfono, empresa, cargo y mensaje). Luego puedes ajustarlos." />
      <div className="card p-5">
        <ActionForm action={createForm} className="grid gap-4">
          <Field label="Nombre interno *">
            <input name="name" required className="input" placeholder="Ej. Demo Ludus – LinkedIn octubre" />
          </Field>
          <Field label="Título que verá el público">
            <input name="title" className="input" placeholder="Ej. Agenda una demo de realidad virtual" />
          </Field>
          <Field label="Descripción (opcional)">
            <textarea name="description" rows={2} className="input" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Línea de negocio de interés">
              <select name="businessLineId" className="input" defaultValue="">
                <option value="">— General —</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </Field>
            <Field label="¿Quién recibe los leads?">
              <select name="assigneeId" className="input" defaultValue="">
                <option value="">Bandeja de leads (alguien los toma)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div><SubmitButton>Crear formulario</SubmitButton></div>
        </ActionForm>
      </div>
    </div>
  );
}
