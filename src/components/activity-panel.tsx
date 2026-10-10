import Link from "next/link";
import type { Activity, ActivityType } from "@prisma/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { deleteActivity, toggleTask, type ActivityTarget } from "@/app/(crm)/actividades/actions";
import { QuickActions } from "./quick-actions";
import { MeetingActions } from "./meeting-actions";
import { googleCalendarUrl, meetingInvitation } from "@/lib/meetings";
import { formatTimeTz } from "@/lib/timezone";
import { nextActivityAlert } from "@/lib/alerts";
import { SemaforoPunto } from "./semaforo";

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
  contact?: { id: string; firstName: string; lastName: string | null } | null;
};

export function ActivityPanel({
  target,
  activities,
  users,
  canWrite,
  contact,
  zoomEnabled,
  viewerId,
}: {
  target: ActivityTarget;
  activities: Item[];
  users: { id: string; name: string }[];
  canWrite: boolean;
  contact?: { name: string; email?: string | null; phone?: string | null } | null;
  zoomEnabled?: boolean;
  viewerId?: string;
}) {
  const isPending = (a: Item) => !a.completed && ["TAREA", "LLAMADA", "REUNION"].includes(a.type);
  const tasks = activities
    .filter(isPending)
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));
  const history = activities.filter((a) => !isPending(a));
  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="card p-4">
          <h2 className="mb-3 text-base">Registrar seguimiento</h2>
          <QuickActions target={target} users={users} contact={contact} zoomEnabled={zoomEnabled} />
        </div>
      )}

      {tasks.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-2 text-base">Próximas actividades</h2>
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} canWrite={canWrite} viewerId={viewerId} inviteEmail={contact?.email} />
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
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-accent-500" />
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

export function TaskRow({
  task,
  canWrite,
  showDeal,
  viewerId,
  inviteEmail,
}: {
  task: Item;
  canWrite: boolean;
  showDeal?: boolean;
  viewerId?: string;
  inviteEmail?: string | null;
}) {
  const alert = !task.completed && task.dueDate ? nextActivityAlert(task.dueDate, true) : null;
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
        <div className={`text-sm ${task.completed ? "text-slate-400 line-through" : "font-medium"}`}>
          {task.type !== "TAREA" && <span className={`badge mr-1.5 ${COLORS[task.type]}`}>{ACTIVITY_LABELS[task.type]}</span>}
          {task.subject}
        </div>
        {task.body && <div className="text-xs text-slate-500">{task.body}</div>}
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
          <span className={`inline-flex items-center gap-1 ${alert?.level === "rojo" ? "font-semibold text-red-700" : ""}`}>
            {alert && <SemaforoPunto level={alert.level} title={alert.label} />}
            {task.type === "TAREA" ? "Vence" : "Fecha"}: {formatDate(task.dueDate)}
            {task.startAt && ` · ${formatTimeTz(task.startAt)}${task.durationMinutes ? ` (${task.durationMinutes} min)` : ""}`}
          </span>
          {task.zoomMeetingId && <span className="font-medium text-brand-600">Zoom</span>}
          {task.assignee && <span>{task.type === "REUNION" ? "Anfitrión" : "Asignada a"}: {task.assignee.name}</span>}
          {showDeal && task.deal && (
            <Link className="text-brand-700 hover:underline" href={`/negocios/${task.deal.id}`}>{task.deal.name}</Link>
          )}
          {showDeal && task.contact && (
            <Link className="text-brand-700 hover:underline" href={`/contactos/${task.contact.id}`}>
              {[task.contact.firstName, task.contact.lastName].filter(Boolean).join(" ")}
            </Link>
          )}
        </div>
        {task.type === "REUNION" && task.startAt && !task.completed && (
          <MeetingActions
            activityId={task.id}
            subject={task.subject}
            joinUrl={task.meetingUrl}
            hostUrl={viewerId && viewerId === task.assigneeId ? task.hostUrl : null}
            invitation={meetingInvitation({ ...task, startAt: task.startAt }, task.assignee?.name)}
            calendarUrl={googleCalendarUrl({ ...task, startAt: task.startAt })}
            inviteEmail={inviteEmail}
            canCancel={canWrite}
          />
        )}
      </div>
    </li>
  );
}
