import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, toNumber } from "@/lib/format";
import { dealWhere, getFilterOptions, PENDING, type DealFilters } from "@/lib/queries";
import { TaskRow } from "@/components/activity-panel";
import { DealFiltersBar } from "@/components/deal-filters";
import { EmptyState, PageHeader } from "@/components/ui";
import { SEMAFORO, Semaforo, SemaforoDot, SemaforoPunto } from "@/components/semaforo";
import { dealAlerts, lastActivityAlert, renewalAlert } from "@/lib/alerts";
import { parseCustomData } from "@/lib/custom-fields";

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

export default async function Dashboard({ searchParams }: { searchParams: Promise<DealFilters> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters: DealFilters = { year: sp.year, line: sp.line, product: sp.product, owner: sp.owner };
  const where = dealWhere(filters, user.id);
  const year = Number(sp.year) || null;
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const ago30 = new Date(now.getTime() - 30 * 86400000);

  // Renovaciones: negocios ganados que renuevan en los próximos 60 días (o ya vencidos) y aún sin negocio de renovación
  const renewalsWhere = dealWhere({ line: sp.line, product: sp.product, owner: sp.owner }, user.id);
  const [stages, deals, lines, myTasks, filterOptions, wonItems, renewals] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
    prisma.deal.findMany({
      where,
      select: {
        id: true, name: true, amount: true, stageId: true, closeDate: true, stageChangedAt: true,
        lastActivityAt: true, createdAt: true, businessLineId: true, owner: { select: { name: true } },
        customData: true,
        activities: { where: PENDING, orderBy: { dueDate: { sort: "asc", nulls: "last" } }, take: 1, select: { dueDate: true } },
      },
    }),
    prisma.businessLine.findMany({ orderBy: { name: "asc" } }),
    prisma.activity.findMany({
      where: { ...PENDING, assigneeId: user.id },
      include: {
        author: true,
        assignee: true,
        deal: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      take: 8,
    }),
    getFilterOptions(),
    // Productos y servicios de los negocios ganados (respetando los filtros)
    prisma.dealItem.findMany({
      where: { deal: { AND: [where, { stage: { isWon: true } }] }, ...(sp.product ? { productId: sp.product } : {}) },
      select: {
        description: true, quantity: true, unitPrice: true, discount: true,
        product: { select: { id: true, name: true, businessLine: { select: { color: true } } } },
      },
    }),
    prisma.deal.findMany({
      where: {
        AND: [renewalsWhere, { stage: { isWon: true } }, { renewalDate: { lte: new Date(Date.now() + 60 * 86400000) } }, { renewals: { none: {} } }],
      },
      select: { id: true, name: true, amount: true, renewalDate: true, owner: { select: { name: true } }, company: { select: { name: true } } },
      orderBy: { renewalDate: "asc" },
      take: 10,
    }),
  ]);

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const open = deals.filter((d) => {
    const s = stageById.get(d.stageId);
    return s && !s.isWon && !s.isLost;
  });
  const wonDate = (d: (typeof deals)[number]) => d.closeDate ?? d.stageChangedAt;
  // Los filtros (incluido el año de cierre) ya se aplicaron en la consulta
  const won = deals.filter((d) => stageById.get(d.stageId)?.isWon);
  const lost = deals.filter((d) => stageById.get(d.stageId)?.isLost);
  const sum = (xs: typeof deals) => xs.reduce((s, d) => s + toNumber(d.amount), 0);
  const openTotal = sum(open);
  const weighted = open.reduce((s, d) => s + (toNumber(d.amount) * (stageById.get(d.stageId)?.probability ?? 0)) / 100, 0);
  const winRate = won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : null;
  const periodLabel = year ? String(year) : sp.year === "none" ? "sin fecha de cierre" : "todos los años";

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

  const wonByLine = [
    ...lines.map((l) => {
      const items = won.filter((d) => d.businessLineId === l.id);
      return { label: l.name, value: sum(items), sub: `${items.length} neg.`, color: l.color };
    }),
    ...(won.some((d) => !d.businessLineId)
      ? [{ label: "Sin línea", value: sum(won.filter((d) => !d.businessLineId)), sub: `${won.filter((d) => !d.businessLineId).length} neg.`, color: "#94a3b8" }]
      : []),
  ].filter((r) => r.value > 0 || r.sub !== "0 neg.");

  const byProduct = new Map<string, { label: string; value: number; qty: number; color?: string }>();
  for (const it of wonItems) {
    const key = it.product?.id ?? `d:${it.description}`;
    const subtotal = toNumber(it.quantity) * toNumber(it.unitPrice) * (1 - toNumber(it.discount) / 100);
    const row = byProduct.get(key) ?? { label: it.product?.name ?? it.description, value: 0, qty: 0, color: it.product?.businessLine.color };
    row.value += subtotal;
    row.qty += toNumber(it.quantity);
    byProduct.set(key, row);
  }
  const productRows = [...byProduct.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map((r) => ({ label: r.label, value: r.value, sub: `${r.qty} u.`, color: r.color }));

  // Con un año elegido: ganado por mes. Sin año: ganado por año.
  const wonSeries = year
    ? MONTHS.map((m, i) => ({ label: m, value: sum(won.filter((d) => wonDate(d).getUTCMonth() === i)) }))
    : [...new Set(won.map((d) => wonDate(d).getUTCFullYear()))]
        .sort((a, b) => a - b)
        .map((y) => ({ label: String(y), value: sum(won.filter((d) => wonDate(d).getUTCFullYear() === y)) }));
  const maxWon = Math.max(1, ...wonSeries.map((m) => m.value));

  // Semáforo de los negocios abiertos
  const health = { rojo: 0, amarillo: 0, verde: 0 };
  for (const d of open) {
    const data = parseCustomData(d.customData);
    const h = dealAlerts({ open: true, closeDate: d.closeDate, next: d.activities[0] ?? null, entrega: data.fechaEntrega, avance: data.avance }).health;
    if (h) health[h]++;
  }
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
  const alertHref = (level: string) => `/negocios?${new URLSearchParams([...qs, ["alerta", level]])}`;

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
      <DealFiltersBar options={filterOptions} variant="dashboard" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Pipeline abierto" value={formatMoney(openTotal)} hint={`${open.length} negocios abiertos`} />
        <Kpi label="Pipeline ponderado" value={formatMoney(weighted)} hint="Según probabilidad de cada etapa" />
        <Kpi label={`Ganado · ${periodLabel}`} value={formatMoney(sum(won))} hint={`${won.length} negocios`} />
        <Kpi label="Tasa de cierre" value={winRate == null ? "—" : `${winRate}%`} hint={`${won.length} ganados · ${lost.length} perdidos`} />
      </div>

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base">Semáforo del pipeline</h2>
          <span className="text-xs text-slate-500">Negocios abiertos según actividades, fecha de cierre y entrega</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["rojo", "Vencidos", "Actividad o cierre vencido, o entrega atrasada"],
              ["amarillo", "Requieren atención", "Sin próximas actividades o por vencer"],
              ["verde", "Al día", "Con seguimiento programado"],
            ] as const
          ).map(([level, label, hint]) => (
            <Link key={level} href={alertHref(level)} className={`rounded-xl border p-4 transition hover:shadow-md ${SEMAFORO[level].chip}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <SemaforoDot level={level} /> {label}
              </div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{health[level]}</div>
              <div className="text-xs opacity-80">{hint}</div>
            </Link>
          ))}
        </div>
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
        <h2 className="mb-3 text-base">{year ? `Ganado por mes (${year})` : "Ganado por año"}</h2>
        {wonSeries.length === 0 ? (
          <p className="text-sm text-slate-500">No hay negocios ganados con estos filtros.</p>
        ) : (
          <div className="flex items-end gap-2">
            {wonSeries.map((m) => (
              <div key={m.label} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${m.label}: ${formatMoney(m.value)}`}>
                <span className="h-4 truncate text-[11px] tabular-nums text-slate-500">{m.value > 0 ? formatMoney(m.value) : ""}</span>
                <div className="flex h-32 w-full items-end">
                  <div
                    className="w-full rounded-t bg-accent-500 transition-opacity hover:opacity-80"
                    style={{ height: `${(m.value / maxWon) * 100}%`, minHeight: m.value > 0 ? 4 : 0 }}
                  />
                </div>
                <span className="text-[11px] text-slate-500">{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-base">Ganado por línea de negocio</h2>
          {wonByLine.length === 0 ? <p className="text-sm text-slate-500">Sin negocios ganados.</p> : <HBars rows={wonByLine} />}
        </div>
        <div className="card p-4">
          <h2 className="mb-3 text-base">Ganado por producto o servicio</h2>
          {productRows.length === 0 ? (
            <EmptyState>
              Aún no hay negocios ganados con productos cargados. Agrega productos en la ficha de cada negocio para ver este
              desglose.
            </EmptyState>
          ) : (
            <HBars rows={productRows} />
          )}
        </div>
      </div>

      {renewals.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base">↻ Próximas renovaciones</h2>
            <span className="text-xs text-slate-500">Servicios recurrentes ganados que renuevan en 60 días o menos. El negocio de renovación se crea solo 30 días antes.</span>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {renewals.map((r) => {
              const a = renewalAlert(r.renewalDate)!;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <Link className="link" href={`/negocios/${r.id}`}>{r.name}</Link>
                    <span className="text-xs text-slate-500"> · {r.company?.name ?? "—"} · {r.owner?.name ?? "Sin responsable"}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums">{formatMoney(r.amount)}</span>
                    <Semaforo level={a.level} label={`${formatDate(r.renewalDate)} · ${a.label}`} />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base">Mis próximas actividades</h2>
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
                  <span className={`flex shrink-0 items-center gap-1 text-xs ${d.closeDate! < now ? "font-semibold text-red-700" : "text-slate-500"}`}>
                    {formatDate(d.closeDate)}
                    <SemaforoPunto level={d.closeDate! < now ? "rojo" : "amarillo"} title={d.closeDate! < now ? "Fecha de cierre vencida" : "Cierra pronto"} />
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
                  <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                    {d.owner?.name ?? "—"}
                    {(() => {
                      const a = lastActivityAlert(d.lastActivityAt ?? d.createdAt);
                      return <SemaforoPunto level={a.level} title={a.label} />;
                    })()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
