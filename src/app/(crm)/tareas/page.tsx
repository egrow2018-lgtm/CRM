import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { contactName, formatDate } from "@/lib/format";
import { ACTIVITY_LABELS, TaskRow } from "@/components/activity-panel";
import { EmptyState, PageHeader } from "@/components/ui";
import { ViewToggle } from "@/components/view-toggle";
import { toggleTask } from "../actividades/actions";

const DAY = 86400000;

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ who?: string; done?: string; view?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { who = "me", done } = sp;
  const where: Prisma.ActivityWhereInput = {
    type: { in: ["TAREA", "LLAMADA", "REUNION"] },
    completed: done === "1",
    assigneeId: who === "me" ? user.id : { not: null },
  };
  const tasks = await prisma.activity.findMany({
    where,
    include: {
      author: true,
      assignee: true,
      deal: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: done === "1" ? { completedAt: "desc" } : [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 300,
  });
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  const canWrite = can(user.role, "activities:write");
  const query = (extra: Record<string, string>) =>
    `/tareas?${new URLSearchParams({ ...(sp.view ? { view: sp.view } : {}), ...extra })}`;
  const tab = (label: string, href: string, active: boolean) => (
    <Link href={href} className={`rounded-lg px-3 py-1.5 text-sm ${active ? "bg-brand-700 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
      {label}
    </Link>
  );

  const buckets = [
    { key: "vencidas", label: "🔴 Vencidas", tone: "bg-red-100 text-red-900", test: (t: number | null) => t !== null && t < today },
    { key: "hoy", label: "🟡 Hoy", tone: "bg-amber-100 text-amber-900", test: (t: number | null) => t === today },
    { key: "semana", label: "🟢 Próximos 7 días", tone: "bg-green-100 text-green-900", test: (t: number | null) => t !== null && t > today && t <= today + 7 * DAY },
    { key: "despues", label: "🟢 Más adelante", tone: "bg-green-50 text-green-900", test: (t: number | null) => t !== null && t > today + 7 * DAY },
    { key: "sinfecha", label: "Sin fecha", tone: "bg-slate-200", test: (t: number | null) => t === null },
  ];
  const isBoard = sp.view === "board" && done !== "1";

  return (
    <div className={isBoard ? "" : "max-w-4xl"}>
      <PageHeader
        title="Tareas y agenda"
        subtitle="Tareas, llamadas y reuniones programadas. Se crean con los íconos de seguimiento de cada negocio, contacto o empresa."
        actions={<ViewToggle defaultView="list" />}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {tab("Mis tareas", query({}), who === "me" && done !== "1")}
        {tab("Todas las pendientes", query({ who: "all" }), who === "all" && done !== "1")}
        {tab("Completadas", query({ who, done: "1" }), done === "1")}
      </div>
      {tasks.length === 0 ? (
        <EmptyState>No hay tareas aquí. 🎉</EmptyState>
      ) : isBoard ? (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {buckets.map((b) => {
            const items = tasks.filter((t) => b.test(t.dueDate ? t.dueDate.getTime() : null));
            return (
              <div key={b.key} className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-100/70">
                <div className={`flex items-center justify-between rounded-t-xl px-3 py-2 text-sm font-semibold ${b.tone}`}>
                  {b.label}
                  <span className="rounded-full bg-white/70 px-2 text-xs font-medium">{items.length}</span>
                </div>
                <div className="space-y-2 p-2" style={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
                  {items.map((t) => (
                    <div key={t.id} className="card p-3 text-xs">
                      <div className="flex items-start gap-2">
                        <form action={toggleTask.bind(null, t.id)}>
                          <button
                            disabled={!canWrite}
                            title="Marcar como completada"
                            className="mt-0.5 flex h-4 w-4 items-center justify-center rounded border border-slate-300 hover:border-brand-500"
                          />
                        </form>
                        <div className="min-w-0 flex-1">
                          <span className="badge mb-1 bg-slate-100 text-slate-600">{ACTIVITY_LABELS[t.type]}</span>
                          <div className="text-sm font-medium text-slate-800">{t.subject}</div>
                          {t.body && <div className="mt-0.5 line-clamp-2 text-slate-500">{t.body}</div>}
                        </div>
                      </div>
                      <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 text-slate-500">
                        <div>Fecha: {formatDate(t.dueDate)}</div>
                        {t.deal && <Link className="block truncate text-brand-600 hover:underline" href={`/negocios/${t.deal.id}`}>{t.deal.name}</Link>}
                        {t.contact && <Link className="block truncate text-brand-600 hover:underline" href={`/contactos/${t.contact.id}`}>{contactName(t.contact)}</Link>}
                        {t.company && <Link className="block truncate text-brand-600 hover:underline" href={`/empresas/${t.company.id}`}>{t.company.name}</Link>}
                        {t.assignee && <div>Responsable: {t.assignee.name}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-4">
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => <TaskRow key={t.id} task={t} canWrite={canWrite} showDeal />)}
          </ul>
        </div>
      )}
    </div>
  );
}
