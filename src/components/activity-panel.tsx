import Link from "next/link";
import type { Activity, ActivityType } from "@prisma/client";
import { ActionForm, SubmitButton } from "./action-form";
import { formatDate, formatDateTime } from "@/lib/format";
import { createActivity, deleteActivity, toggleTask, type ActivityTarget } from "@/app/(crm)/actividades/actions";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  NOTA: "Nota",
  LLAMADA: "Llamada",
  REUNION: "Reunión",
  EMAIL: "Correo",
  TAREA: "Tarea",
  CAMBIO_ETAPA: "Cambio de etapa",
};

const COLORS: Record<ActivityType, string> = {
  NOTA: "bg-slate-100 text-slate-700",
  LLAMADA: "bg-sky-100 text-sky-800",
  REUNION: "bg-violet-100 text-violet-800",
  EMAIL: "bg-indigo-100 text-indigo-800",
  TAREA: "bg-amber-100 text-amber-800",
  CAMBIO_ETAPA: "bg-emerald-100 text-emerald-800",
};

type Item = Activity & {
  author: { name: string } | null;
  assignee: { name: string } | null;
  deal?: { id: string; name: string } | null;
};

export function ActivityPanel({
  target,
  activities,
  users,
  canWrite,
}: {
  target: ActivityTarget;
  activities: Item[];
  users: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const tasks = activities.filter((a) => a.type === "TAREA" && !a.completed);
  const history = activities.filter((a) => !(a.type === "TAREA" && !a.completed));
  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="card p-4">
          <h2 className="mb-3 text-base">Registrar actividad</h2>
          <ActionForm action={createActivity.bind(null, target)} resetOnSuccess className="grid gap-3 sm:grid-cols-4">
            <select name="type" className="input" defaultValue="NOTA">
              {(["NOTA", "LLAMADA", "REUNION", "EMAIL", "TAREA"] as const).map((t) => (
                <option key={t} value={t}>{ACTIVITY_LABELS[t]}</option>
              ))}
            </select>
            <input name="subject" required placeholder="Asunto" className="input sm:col-span-3" />
            <textarea name="body" rows={2} placeholder="Detalle (opcional)" className="input sm:col-span-4" />
            <label className="text-xs text-slate-500 sm:col-span-2">
              Fecha límite (para tareas)
              <input name="dueDate" type="date" className="input mt-1" />
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Asignar a (para tareas)
              <select name="assigneeId" className="input mt-1" defaultValue="">
                <option value="">Yo</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-4">
              <SubmitButton>Guardar actividad</SubmitButton>
            </div>
          </ActionForm>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-2 text-base">Tareas pendientes</h2>
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} canWrite={canWrite} />
            ))}
          </ul>
        </div>
      )}

      <div className="card p-4">
        <h2 className="mb-3 text-base">Historial</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay actividades.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-slate-200 pl-4">
            {history.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-egrow-cyan" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${COLORS[a.type]}`}>{ACTIVITY_LABELS[a.type]}</span>
                  <span className="text-sm font-medium">{a.subject}</span>
                  {a.deal && (
                    <Link href={`/negocios/${a.deal.id}`} className="text-xs text-brand-700 hover:underline">
                      {a.deal.name}
                    </Link>
                  )}
                </div>
                {a.body && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{a.body}</p>}
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                  <span>{formatDateTime(a.createdAt)} · {a.author?.name ?? "Sistema"}</span>
                  {canWrite && a.type !== "CAMBIO_ETAPA" && (
                    <form action={deleteActivity.bind(null, a.id)}>
                      <button className="hover:text-red-600">Eliminar</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function TaskRow({ task, canWrite, showDeal }: { task: Item; canWrite: boolean; showDeal?: boolean }) {
  const overdue = task.dueDate && !task.completed && task.dueDate < new Date(new Date().toISOString().slice(0, 10));
  return (
    <li className="flex items-start gap-3 py-2">
      <form action={toggleTask.bind(null, task.id)}>
        <button
          disabled={!canWrite}
          title={task.completed ? "Marcar como pendiente" : "Marcar como completada"}
          className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${
            task.completed ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 hover:border-brand-500"
          }`}
        >
          {task.completed && "✓"}
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${task.completed ? "text-slate-400 line-through" : "font-medium"}`}>{task.subject}</div>
        {task.body && <div className="text-xs text-slate-500">{task.body}</div>}
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
          <span className={overdue ? "font-semibold text-red-600" : ""}>Vence: {formatDate(task.dueDate)}</span>
          {task.assignee && <span>Asignada a {task.assignee.name}</span>}
          {showDeal && task.deal && (
            <Link className="text-brand-700 hover:underline" href={`/negocios/${task.deal.id}`}>{task.deal.name}</Link>
          )}
        </div>
      </div>
    </li>
  );
}
