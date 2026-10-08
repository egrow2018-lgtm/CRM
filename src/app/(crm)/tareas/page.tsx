import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { TaskRow } from "@/components/activity-panel";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ who?: string; done?: string }> }) {
  const user = await requireUser();
  const { who = "me", done } = await searchParams;
  const where: Prisma.ActivityWhereInput = {
    type: "TAREA",
    completed: done === "1",
    ...(who === "me" ? { assigneeId: user.id } : {}),
  };
  const tasks = await prisma.activity.findMany({
    where,
    include: { author: true, assignee: true, deal: { select: { id: true, name: true } } },
    orderBy: done === "1" ? { completedAt: "desc" } : [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 200,
  });
  const today = new Date(new Date().toISOString().slice(0, 10));
  const overdue = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today);
  const rest = tasks.filter((t) => !overdue.includes(t));
  const tab = (label: string, href: string, active: boolean) => (
    <Link href={href} className={`rounded-lg px-3 py-1.5 text-sm ${active ? "bg-brand-700 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
      {label}
    </Link>
  );
  const canWrite = can(user.role, "activities:write");

  return (
    <div className="max-w-4xl">
      <PageHeader title="Tareas" subtitle="Las tareas se crean desde un negocio, contacto o empresa." />
      <div className="mb-4 flex flex-wrap gap-2">
        {tab("Mis tareas", "/tareas", who === "me" && done !== "1")}
        {tab("Todas las pendientes", "/tareas?who=all", who === "all" && done !== "1")}
        {tab("Completadas", `/tareas?who=${who}&done=1`, done === "1")}
      </div>
      {tasks.length === 0 ? (
        <EmptyState>No hay tareas aquí. 🎉</EmptyState>
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <div className="card border-red-200 p-4">
              <h2 className="mb-1 text-base text-red-700">Vencidas ({overdue.length})</h2>
              <ul className="divide-y divide-slate-100">
                {overdue.map((t) => <TaskRow key={t.id} task={t} canWrite={canWrite} showDeal />)}
              </ul>
            </div>
          )}
          {rest.length > 0 && (
            <div className="card p-4">
              <ul className="divide-y divide-slate-100">
                {rest.map((t) => <TaskRow key={t.id} task={t} canWrite={canWrite} showDeal />)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
