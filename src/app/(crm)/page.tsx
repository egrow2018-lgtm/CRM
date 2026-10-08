import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, toNumber } from "@/lib/format";
import { TaskRow } from "@/components/activity-panel";
import { PageHeader } from "@/components/ui";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

/** Barras horizontales simples: una sola medida, etiquetas directas y tooltip nativo. */
function HBars({ rows }: { rows: { label: string; value: number; sub?: string; color?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${formatMoney(r.value)}${r.sub ? ` · ${r.sub}` : ""}`}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-slate-700">{r.label}</span>
            <span className="tabular-nums text-slate-600">
              {formatMoney(r.value)}
              {r.sub && <span className="text-slate-400"> · {r.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded bg-slate-100">
            <div
              className="h-2 rounded"
              style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? 4 : 0, backgroundColor: r.color ?? "var(--color-brand-600)" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function Dashboard() {
  const user = await requireUser();
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const ago30 = new Date(now.getTime() - 30 * 86400000);

  const [stages, deals, lines, myTasks] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
    prisma.deal.findMany({
      select: {
        id: true, name: true, amount: true, stageId: true, closeDate: true, stageChangedAt: true,
        lastActivityAt: true, createdAt: true, businessLineId: true, owner: { select: { name: true } },
      },
    }),
    prisma.businessLine.findMany({ orderBy: { name: "asc" } }),
    prisma.activity.findMany({
      where: { type: "TAREA", completed: false, assigneeId: user.id },
      include: { author: true, assignee: true, deal: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      take: 8,
    }),
  ]);

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const open = deals.filter((d) => {
    const s = stageById.get(d.stageId);
    return s && !s.isWon && !s.isLost;
  });
  const wonDate = (d: (typeof deals)[number]) => d.closeDate ?? d.stageChangedAt;
  const wonThisYear = deals.filter((d) => stageById.get(d.stageId)?.isWon && wonDate(d) >= yearStart);
  const lostThisYear = deals.filter((d) => stageById.get(d.stageId)?.isLost && d.stageChangedAt >= yearStart);
  const sum = (xs: typeof deals) => xs.reduce((s, d) => s + toNumber(d.amount), 0);
  const openTotal = sum(open);
  const weighted = open.reduce((s, d) => s + (toNumber(d.amount) * (stageById.get(d.stageId)?.probability ?? 0)) / 100, 0);
  const winRate = wonThisYear.length + lostThisYear.length > 0
    ? Math.round((wonThisYear.length / (wonThisYear.length + lostThisYear.length)) * 100)
    : null;

  const byStage = stages
    .filter((s) => !s.isLost)
    .map((s) => {
      const items = deals.filter((d) => d.stageId === s.id);
      return { label: s.name, value: sum(items), sub: `${items.length} neg.` };
    });

  const byLine = [
    ...lines.map((l) => {
      const items = open.filter((d) => d.businessLineId === l.id);
      return { label: l.name, value: sum(items), sub: `${items.length} neg.`, color: l.color };
    }),
    ...(open.some((d) => !d.businessLineId)
      ? [{ label: "Sin línea", value: sum(open.filter((d) => !d.businessLineId)), sub: `${open.filter((d) => !d.businessLineId).length} neg.`, color: "#94a3b8" }]
      : []),
  ];

  const wonByMonth = MONTHS.map((m, i) => ({
    label: m,
    value: sum(wonThisYear.filter((d) => wonDate(d).getUTCMonth() === i)),
  }));
  const maxMonth = Math.max(1, ...wonByMonth.map((m) => m.value));

  const closingSoon = open
    .filter((d) => d.closeDate && d.closeDate <= in30)
    .sort((a, b) => a.closeDate!.getTime() - b.closeDate!.getTime())
    .slice(0, 8);
  const stale = open
    .filter((d) => (d.lastActivityAt ?? d.createdAt) < ago30)
    .sort((a, b) => (a.lastActivityAt ?? a.createdAt).getTime() - (b.lastActivityAt ?? b.createdAt).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader title={`Hola, ${user.name.split(" ")[0]} 👋`} subtitle="Resumen comercial de e-grow" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Pipeline abierto" value={formatMoney(openTotal)} hint={`${open.length} negocios abiertos`} />
        <Kpi label="Pipeline ponderado" value={formatMoney(weighted)} hint="Según probabilidad de cada etapa" />
        <Kpi label={`Ganado ${now.getUTCFullYear()}`} value={formatMoney(sum(wonThisYear))} hint={`${wonThisYear.length} negocios`} />
        <Kpi label="Tasa de cierre" value={winRate == null ? "—" : `${winRate}%`} hint={`${wonThisYear.length} ganados · ${lostThisYear.length} perdidos este año`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-base">Valor por etapa</h2>
          <HBars rows={byStage} />
        </div>
        <div className="card p-4">
          <h2 className="mb-3 text-base">Pipeline abierto por línea de negocio</h2>
          <HBars rows={byLine} />
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-base">Ganado por mes ({now.getUTCFullYear()})</h2>
        <div className="flex items-end gap-2">
          {wonByMonth.map((m) => (
            <div key={m.label} className="flex flex-1 flex-col items-center gap-1" title={`${m.label}: ${formatMoney(m.value)}`}>
              <span className="h-4 text-[11px] tabular-nums text-slate-500">{m.value > 0 ? formatMoney(m.value) : ""}</span>
              <div className="flex h-32 w-full items-end">
                <div
                  className="w-full rounded-t bg-brand-600 transition-opacity hover:opacity-80"
                  style={{ height: `${(m.value / maxMonth) * 100}%`, minHeight: m.value > 0 ? 4 : 0 }}
                />
              </div>
              <span className="text-[11px] text-slate-500">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base">Mis tareas</h2>
            <Link href="/tareas" className="text-xs text-brand-700 hover:underline">Ver todas</Link>
          </div>
          {myTasks.length === 0 ? (
            <p className="text-sm text-slate-500">Sin tareas pendientes.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {myTasks.map((t) => <TaskRow key={t.id} task={t} canWrite showDeal />)}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <h2 className="mb-2 text-base">Por cerrar (vencidos y próximos 30 días)</h2>
          {closingSoon.length === 0 ? (
            <p className="text-sm text-slate-500">Nada por ahora.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {closingSoon.map((d) => (
                <li key={d.id} className="flex justify-between gap-2">
                  <Link className="link truncate" href={`/negocios/${d.id}`}>{d.name}</Link>
                  <span className={`shrink-0 text-xs ${d.closeDate! < now ? "font-semibold text-red-600" : "text-slate-500"}`}>
                    {formatDate(d.closeDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <h2 className="mb-2 text-base">Sin actividad hace +30 días</h2>
          {stale.length === 0 ? (
            <p className="text-sm text-slate-500">¡Todo al día!</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stale.map((d) => (
                <li key={d.id} className="flex justify-between gap-2">
                  <Link className="link truncate" href={`/negocios/${d.id}`}>{d.name}</Link>
                  <span className="shrink-0 text-xs text-slate-500">{d.owner?.name ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
