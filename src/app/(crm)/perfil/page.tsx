import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions";
import { PageHeader, Field } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { updateProfile } from "./actions";

export default async function ProfilePage() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  return (
    <div className="max-w-xl">
      <PageHeader title="Mi perfil" subtitle={`${user.email} · ${ROLE_LABELS[user.role]}`} />
      <div className="card p-5">
        <ActionForm action={updateProfile} successMessage="Cambios guardados." resetOnSuccess className="grid gap-4">
          <Field label="Nombre">
            <input name="name" required defaultValue={user.name} className="input" />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="digestEnabled" defaultChecked={dbUser.digestEnabled} className="mt-1" />
            <span>
              Recibir el <b>resumen diario</b> por correo (lunes a viernes, 8:00): reuniones, tareas vencidas, negocios en rojo, leads y renovaciones.{" "}
              <a href="/api/resumen" target="_blank" rel="noreferrer" className="link">Ver mi resumen de hoy</a>
            </span>
          </label>
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
