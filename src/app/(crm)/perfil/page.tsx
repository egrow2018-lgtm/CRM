import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { PageHeader, Field } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { updateProfile } from "./actions";

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="max-w-xl">
      <PageHeader title="Mi perfil" subtitle={`${user.email} · ${ROLE_LABELS[user.role]}`} />
      <div className="card p-5">
        <ActionForm action={updateProfile} successMessage="Cambios guardados." resetOnSuccess className="grid gap-4">
          <Field label="Nombre">
            <input name="name" required defaultValue={user.name} className="input" />
          </Field>
          <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">Cambiar contraseña</legend>
            <Field label="Contraseña actual">
              <input name="currentPassword" type="password" autoComplete="current-password" className="input" />
            </Field>
            <Field label="Nueva contraseña (mín. 8 caracteres)">
              <input name="newPassword" type="password" autoComplete="new-password" className="input" />
            </Field>
            <Field label="Repite la nueva contraseña">
              <input name="confirmPassword" type="password" autoComplete="new-password" className="input" />
            </Field>
          </fieldset>
          <div><SubmitButton>Guardar cambios</SubmitButton></div>
        </ActionForm>
      </div>
    </div>
  );
}
