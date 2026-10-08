import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageHeader } from "@/components/ui";
import { createUser, deleteStage, saveStage, updateUser } from "./actions";

const ROLE_HELP: Record<keyof typeof ROLE_LABELS, string> = {
  ADMIN: "Todo, incluida la gestión de usuarios y etapas del pipeline.",
  GERENTE: "Ve y edita todo, administra el catálogo e importa datos. No gestiona usuarios.",
  COMERCIAL: "Crea y edita contactos, empresas y negocios. Registra actividades.",
  PROYECTOS: "Consulta todo; mueve negocios entre Firma de Contrato, Producción y Ganado; registra actividades.",
};

function RoleSelect({ value }: { value?: string }) {
  return (
    <select name="role" defaultValue={value ?? "COMERCIAL"} className="input">
      {Object.entries(ROLE_LABELS).map(([k, v]) => (
        <option key={k} value={k}>{v}</option>
      ))}
    </select>
  );
}

export default async function SettingsPage() {
  await requirePagePermission("users:manage");
  const [users, stages] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { deals: true } } } }),
  ]);

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader title="Configuración" />

      <section>
        <h2 className="mb-1">Usuarios y perfiles</h2>
        <ul className="mb-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
          {Object.entries(ROLE_HELP).map(([k, v]) => (
            <li key={k}><span className="font-semibold text-slate-700">{ROLE_LABELS[k as keyof typeof ROLE_LABELS]}:</span> {v}</li>
          ))}
        </ul>
        <div className="card divide-y divide-slate-100">
          {users.map((u) => (
            <details key={u.id} className="p-3">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                <span className={`font-medium ${u.active ? "" : "text-slate-400 line-through"}`}>{u.name}</span>
                <span className="text-slate-500">{u.email}</span>
                <span className="badge bg-brand-50 text-brand-800">{ROLE_LABELS[u.role]}</span>
                {!u.active && <span className="badge bg-slate-200 text-slate-600">Inactivo</span>}
                <span className="ml-auto text-xs text-slate-400">Desde {formatDate(u.createdAt)}</span>
              </summary>
              <ActionForm action={updateUser.bind(null, u.id)} className="mt-3 grid gap-2 sm:grid-cols-5">
                <input name="name" required defaultValue={u.name} className="input" />
                <input name="email" type="email" required defaultValue={u.email} className="input" />
                <RoleSelect value={u.role} />
                <input name="password" type="password" placeholder="Nueva contraseña (opcional)" className="input" autoComplete="new-password" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} /> Activo</label>
                <div className="sm:col-span-5"><SubmitButton className="btn btn-primary btn-sm">Guardar</SubmitButton></div>
              </ActionForm>
            </details>
          ))}
        </div>
        <div className="card mt-3 p-4">
          <h3 className="mb-2 text-sm font-semibold">Nuevo usuario</h3>
          <ActionForm action={createUser} resetOnSuccess className="grid gap-2 sm:grid-cols-5">
            <input name="name" required placeholder="Nombre" className="input" />
            <input name="email" type="email" required placeholder="Email" className="input" />
            <RoleSelect />
            <input name="password" type="password" required placeholder="Contraseña (mín. 8)" className="input" autoComplete="new-password" />
            <SubmitButton>Crear usuario</SubmitButton>
          </ActionForm>
        </div>
      </section>

      <section>
        <h2 className="mb-1">Etapas del pipeline</h2>
        <p className="mb-3 text-xs text-slate-500">
          La probabilidad se usa para calcular la cantidad ponderada. El orden define la posición en el tablero.
        </p>
        <div className="card divide-y divide-slate-100">
          {stages.map((s) => (
            <div key={s.id} className="flex flex-wrap items-start gap-2 p-3">
              <ActionForm action={saveStage.bind(null, s.id)} className="grid flex-1 gap-2 sm:grid-cols-6">
                <input name="order" type="number" defaultValue={s.order} className="input" title="Orden" />
                <input name="name" required defaultValue={s.name} className="input sm:col-span-2" />
                <label className="flex items-center gap-1 text-sm">
                  <input name="probability" type="number" min="0" max="100" defaultValue={s.probability} className="input" />%
                </label>
                <select name="kind" defaultValue={s.isWon ? "won" : s.isLost ? "lost" : "open"} className="input">
                  <option value="open">Abierta</option>
                  <option value="won">Ganado</option>
                  <option value="lost">Perdido</option>
                </select>
                <SubmitButton className="btn btn-sm">Guardar</SubmitButton>
              </ActionForm>
              <span className="pt-2 text-xs text-slate-400">{s._count.deals} negocios</span>
              {s._count.deals === 0 && (
                <form action={deleteStage.bind(null, s.id)}>
                  <button className="pt-2 text-xs text-slate-400 hover:text-red-600">Eliminar</button>
                </form>
              )}
            </div>
          ))}
        </div>
        <div className="card mt-3 p-4">
          <h3 className="mb-2 text-sm font-semibold">Nueva etapa</h3>
          <ActionForm action={saveStage.bind(null, null)} resetOnSuccess className="grid gap-2 sm:grid-cols-6">
            <input name="order" type="number" required placeholder="Orden" defaultValue={stages.length} className="input" />
            <input name="name" required placeholder="Nombre" className="input sm:col-span-2" />
            <input name="probability" type="number" min="0" max="100" placeholder="%" className="input" />
            <select name="kind" defaultValue="open" className="input">
              <option value="open">Abierta</option>
              <option value="won">Ganado</option>
              <option value="lost">Perdido</option>
            </select>
            <SubmitButton className="btn btn-primary">Agregar</SubmitButton>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
