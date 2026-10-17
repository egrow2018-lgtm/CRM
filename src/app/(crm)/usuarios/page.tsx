import { emailDomain } from "@/lib/email-compose";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { ROLE_LABELS, ROLE_PERMISSIONS, permissionsOf } from "@/lib/permissions";
import { formatLocalDate } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageHeader } from "@/components/ui";
import { createUser, saveUserPermissions, updateUser } from "./actions";
import { PermissionsEditor } from "./permissions-editor";

const ROLE_HELP: Record<keyof typeof ROLE_LABELS, string> = {
  ADMIN: "Todo, incluida la gestión de usuarios, permisos y etapas del pipeline.",
  GERENTE: "Ve y edita todo, elimina registros, administra el catálogo e importa datos.",
  COMERCIAL: "Crea y edita contactos, empresas, negocios y productos, y da seguimiento a cada negocio. No elimina.",
  PROYECTOS: "Consulta todo y da seguimiento a la producción: mueve negocios entre Firma de Contrato, En Producción y Ganado, y registra actividades.",
};

function RoleSelect({ value }: { value?: string }) {
  return (
    <select name="role" defaultValue={value ?? "COMERCIAL"} className="input" aria-label="Perfil">
      {Object.entries(ROLE_LABELS).map(([k, v]) => (
        <option key={k} value={k}>{v}</option>
      ))}
    </select>
  );
}

const senderDomain = emailDomain(process.env.EMAIL_FROM);

export default async function UsersPage() {
  await requirePagePermission("users:manage");
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Usuarios y permisos"
        subtitle="Cada perfil trae permisos por defecto; puedes personalizarlos para cada persona."
      />
      <ul className="grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
        {Object.entries(ROLE_HELP).map(([k, v]) => (
          <li key={k}><span className="font-semibold text-slate-700">{ROLE_LABELS[k as keyof typeof ROLE_LABELS]}:</span> {v}</li>
        ))}
      </ul>

      <div className="card divide-y divide-slate-100">
        {users.map((u) => {
          const perms = permissionsOf(u);
          return (
            <details key={u.id} className="p-3">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                <span className={`font-medium ${u.active ? "" : "text-slate-400 line-through"}`}>{u.name}</span>
                <span className="text-slate-500">{u.email}</span>
                <span className="badge bg-brand-50 text-brand-800">{ROLE_LABELS[u.role]}</span>
                {u.customPermissions && u.role !== "ADMIN" && <span className="badge bg-accent-100 text-brand-800">Permisos personalizados</span>}
                {!u.active && <span className="badge bg-slate-200 text-slate-600">Inactivo</span>}
                {u.extraEmails.length > 0 && <span className="text-xs text-slate-400">+ {u.extraEmails.join(", ")}</span>}
                <span className="ml-auto text-xs text-slate-400">{perms.length} permisos · desde {formatLocalDate(u.createdAt)}</span>
              </summary>
              <div className="mt-3 space-y-4">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Datos y perfil</h3>
                  <ActionForm action={updateUser.bind(null, u.id)} successMessage="Usuario guardado." className="grid gap-2 sm:grid-cols-5">
                    <input name="name" required defaultValue={u.name} className="input" aria-label="Nombre" />
                    <input name="email" type="email" required defaultValue={u.email} className="input" aria-label="Email" />
                    <RoleSelect value={u.role} />
                    <input name="password" type="password" placeholder="Nueva contraseña (opcional)" className="input" autoComplete="new-password" />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} /> Activo</label>
                    <label className="text-xs text-slate-500 sm:col-span-5">
                      Correos adicionales para sus reuniones (reciben copia de cada invitación en la que es anfitrión; ej. su correo personal)
                      <input name="extraEmails" defaultValue={u.extraEmails.join(", ")} placeholder="personal@hotmail.com" className="input mt-1" />
                    </label>
                    <label className="flex items-center gap-2 text-sm sm:col-span-5">
                      <input type="checkbox" name="productionReport" defaultChecked={u.productionReport} /> Recibe el reporte de negocios en producción
                    </label>
                    <label className="text-xs text-slate-500 sm:col-span-5">
                      Correo desde el que envía a clientes (debe ser {senderDomain ? `@${senderDomain}` : "del dominio verificado"}; vacío = su email de acceso)
                      <input name="senderEmail" type="email" defaultValue={u.senderEmail ?? ""} placeholder={senderDomain ? `nombre@${senderDomain}` : ""} className="input mt-1" />
                    </label>
                    <div className="sm:col-span-5"><SubmitButton className="btn btn-primary btn-sm">Guardar</SubmitButton></div>
                  </ActionForm>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Permisos</h3>
                  <PermissionsEditor
                    action={saveUserPermissions.bind(null, u.id)}
                    isAdmin={u.role === "ADMIN"}
                    custom={u.customPermissions}
                    current={perms}
                    roleDefaults={ROLE_PERMISSIONS[u.role]}
                    roleLabel={ROLE_LABELS[u.role]}
                  />
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <div className="card p-4">
        <h2 className="mb-2 text-base">Nuevo usuario</h2>
        <ActionForm action={createUser} resetOnSuccess successMessage="Usuario creado." className="grid gap-2 sm:grid-cols-5">
          <input name="name" required placeholder="Nombre" className="input" />
          <input name="email" type="email" required placeholder="Email" className="input" />
          <RoleSelect />
          <input name="password" type="password" required placeholder="Contraseña (mín. 8)" className="input" autoComplete="new-password" />
          <SubmitButton>Crear usuario</SubmitButton>
        </ActionForm>
        <p className="mt-2 text-xs text-slate-500">Después de crearlo puedes ajustar sus permisos abriendo su fila.</p>
      </div>
    </div>
  );
}
