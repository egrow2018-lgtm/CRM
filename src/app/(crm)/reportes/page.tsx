import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { loadReportData } from "@/lib/report-data";
import { utcToZoned } from "@/lib/timezone";
import {
  MONTHS,
  avgDaysToWin,
  byOwner,
  closedAt,
  leadsByMonthAndSource,
  lostReasons,
  openPipelineByStage,
  quoteConversion,
  quotesByMonthAndLine,
  sumCells,
  topClients,
  topProducts,
  winLossByYear,
  wonByYearAndLine,
  type Cell,
} from "@/lib/reports";
import { LineBadge, PageHeader } from "@/components/ui";
import { ReportFilters } from "./filters";

type SP = { year?: string; line?: string };

const fmtN = new Intl.NumberFormat("es-EC");
const pct = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("es-EC")} %`);

function CellView({ c }: { c: Cell | undefined }) {
  if (!c || c.count === 0) return <span className="text-slate-300">—</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="tabular-nums">{formatMoney(c.amount)}</span>
      <span className="ml-1 text-xs text-slate-400">({c.count})</span>
    </span>
  );
}

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-4 p-4">
      <h2 className="text-base">{title}</h2>
      {hint && <p className="mb-3 text-xs text-slate-500">{hint}</p>}
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function Bars({ data, color = "bg-accent-500" }: { data: { label: string; value: number; title?: string }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="mt-3 flex items-end gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={d.title ?? `${d.label}: ${d.value}`}>
          <span className="h-4 text-[10px] tabular-nums text-slate-500">{d.value > 0 ? fmtN.format(d.value) : ""}</span>
          <div className="flex h-24 w-full items-end">
            <div className={`w-full rounded-t ${color}`} style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 3 : 0 }} />
          </div>
          <span className="text-[10px] text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

const NAV = [
  ["resumen", "Resumen"],
  ["ventas", "Ventas por año y línea"],
  ["cotizaciones", "Cotizaciones por mes"],
  ["ganados", "Ganados vs perdidos"],
  ["pipeline", "Pipeline abierto"],
  ["responsables", "Por responsable"],
  ["clientes", "Top clientes"],
  ["productos", "Productos vendidos"],
  ["perdidas", "Motivos de pérdida"],
  ["leads", "Leads por origen"],
] as const;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePagePermission("reports:view");
  const sp = await searchParams;
  const { deals, quotes, leads, lines, allLines } = await loadReportData(sp.line || undefined);
  const thisYear = Number(utcToZoned(new Date()).date.slice(0, 4));
  const years = [...new Set([thisYear, ...deals.map((d) => closedAt(d).getUTCFullYear()), ...quotes.map((q) => q.createdAt.getUTCFullYear())])].sort((a, b) => b - a);
  const year = years.includes(Number(sp.year)) ? Number(sp.year) : thisYear;
  const lineIds = lines.map((l) => l.id);
  const showNoLine = !sp.line;

  const wonYears = wonByYearAndLine(deals, lineIds);
  const quoteMonths = quotesByMonthAndLine(quotes, year, lineIds);
  const winLoss = winLossByYear(deals);
  const wl = winLoss.find((r) => r.year === year);
  const pipeline = openPipelineByStage(deals);
  const owners = byOwner(deals, quotes, year);
  const clients = topClients(deals, year);
  const products = topProducts(deals, year);
  const reasons = lostReasons(deals, year);
  const days = avgDaysToWin(deals, year);
  const leadRows = leadsByMonthAndSource(leads, year);
  const conv = quoteConversion(quotes, year);
  const quoteTotal = sumCells(quoteMonths.map((m) => m.total));
  const openTotal = pipeline.reduce((t, p) => ({ amount: t.amount + p.amount, weighted: t.weighted + p.weighted }), { amount: 0, weighted: 0 });
  const qs = new URLSearchParams({ year: String(year), ...(sp.line ? { line: sp.line } : {}) });

  const kpis: [string, string, string?][] = [
    ["Vendido (ganado)", formatMoney(wl?.won.amount ?? 0), `${wl?.won.count ?? 0} negocios`],
    ["Perdido", formatMoney(wl?.lost.amount ?? 0), `${wl?.lost.count ?? 0} negocios`],
    ["Tasa de cierre", pct(wl?.rate ?? null), "ganados / (ganados + perdidos)"],
    ["Cotizaciones", fmtN.format(quoteTotal.count), formatMoney(quoteTotal.amount)],
    ["Cotizaciones ganadas", pct(conv.rate), `${conv.won} de ${conv.quotes}`],
    ["Días promedio para ganar", days.avg == null ? "—" : fmtN.format(days.avg), "desde que se crea el negocio"],
    ["Pipeline abierto", formatMoney(openTotal.amount), `ponderado ${formatMoney(openTotal.weighted)}`],
    ["Leads nuevos", fmtN.format(leadRows.reduce((t, r) => t + r.total, 0)), "contactos creados en el año"],
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reportes"
        subtitle={`Año ${year}${sp.line ? ` · ${lines[0]?.name ?? ""}` : " · todas las líneas"}. Ventas y pérdidas se cuentan por su fecha de cierre.`}
        actions={
          <>
            <ReportFilters years={years} lines={allLines} year={year} />
            <a href={`/reportes/pdf?${qs}`} className="btn">Descargar PDF</a>
            <a href={`/reportes/excel?${qs}`} className="btn btn-primary">Descargar Excel</a>
          </>
        }
      />
      <nav className="flex flex-wrap gap-1.5 text-xs">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:border-accent-500 hover:text-brand-700">{label}</a>
        ))}
      </nav>

      <section id="resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([label, value, hint]) => (
          <div key={label} className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-brand-700">{value}</div>
            {hint && <div className="text-xs text-slate-500">{hint}</div>}
          </div>
        ))}
      </section>

      <Section id="ventas" title="Ventas ganadas por año y línea de negocio" hint="Monto ganado y (número de negocios), por año de cierre.">
        <table className="table">
          <thead>
            <tr>
              <th>Año</th>
              {lines.map((l) => <th key={l.id} className="text-right"><LineBadge line={l} /></th>)}
              {showNoLine && <th className="text-right">Sin línea</th>}
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {wonYears.map((r) => (
              <tr key={r.year} className={r.year === year ? "bg-accent-50" : ""}>
                <td className="font-medium">{r.year}</td>
                {lines.map((l) => <td key={l.id} className="text-right"><CellView c={r.cells.get(l.id)} /></td>)}
                {showNoLine && <td className="text-right"><CellView c={r.cells.get("none")} /></td>}
                <td className="text-right font-semibold"><CellView c={r.total} /></td>
              </tr>
            ))}
            {wonYears.length === 0 && <tr><td colSpan={lines.length + 3} className="text-slate-500">Sin negocios ganados.</td></tr>}
          </tbody>
        </table>
      </Section>

      <Section id="cotizaciones" title={`Cotizaciones por mes y línea de negocio (${year})`} hint="Monto cotizado y (número de cotizaciones), por mes de emisión.">
        <table className="table">
          <thead>
            <tr>
              <th>Mes</th>
              {lines.map((l) => <th key={l.id} className="text-right"><LineBadge line={l} /></th>)}
              {showNoLine && <th className="text-right">Sin línea</th>}
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {quoteMonths.map((r) => (
              <tr key={r.month}>
                <td className="font-medium">{MONTHS[r.month]}</td>
                {lines.map((l) => <td key={l.id} className="text-right"><CellView c={r.cells.get(l.id)} /></td>)}
                {showNoLine && <td className="text-right"><CellView c={r.cells.get("none")} /></td>}
                <td className="text-right font-semibold"><CellView c={r.total} /></td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td>Total</td>
              {lines.map((l) => <td key={l.id} className="text-right"><CellView c={sumCells(quoteMonths.map((m) => m.cells.get(l.id)!))} /></td>)}
              {showNoLine && <td className="text-right"><CellView c={sumCells(quoteMonths.map((m) => m.cells.get("none")!))} /></td>}
              <td className="text-right"><CellView c={quoteTotal} /></td>
            </tr>
          </tbody>
        </table>
        {quoteTotal.count > 0 && <Bars data={quoteMonths.map((m) => ({ label: MONTHS[m.month]!, value: m.total.count, title: `${MONTHS[m.month]}: ${m.total.count} cotizaciones · ${formatMoney(m.total.amount)}` }))} />}
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section id="ganados" title="Negocios ganados vs perdidos" hint="Por año de cierre. Tasa de cierre = ganados / (ganados + perdidos).">
          <table className="table">
            <thead>
              <tr><th>Año</th><th className="text-right">Ganados</th><th className="text-right">Perdidos</th><th className="text-right">Tasa</th></tr>
            </thead>
            <tbody>
              {winLoss.map((r) => (
                <tr key={r.year} className={r.year === year ? "bg-accent-50" : ""}>
                  <td className="font-medium">{r.year}</td>
                  <td className="text-right text-emerald-700"><CellView c={r.won} /></td>
                  <td className="text-right text-red-700"><CellView c={r.lost} /></td>
                  <td className="text-right font-semibold tabular-nums">{pct(r.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section id="pipeline" title="Pipeline abierto por etapa" hint="Negocios en curso (hoy). Ponderado = monto × probabilidad de la etapa.">
          <table className="table">
            <thead>
              <tr><th>Etapa</th><th className="text-right">Negocios</th><th className="text-right">Monto</th><th className="text-right">Ponderado</th></tr>
            </thead>
            <tbody>
              {pipeline.map((p) => (
                <tr key={p.stage}>
                  <td>{p.stage} <span className="text-xs text-slate-400">{p.probability}%</span></td>
                  <td className="text-right tabular-nums">{p.count}</td>
                  <td className="text-right tabular-nums">{formatMoney(p.amount)}</td>
                  <td className="text-right tabular-nums">{formatMoney(p.weighted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>

      <Section id="responsables" title={`Desempeño por responsable (${year})`} hint="Ganados y perdidos del año, cotizaciones emitidas en el año y pipeline abierto hoy.">
        <table className="table">
          <thead>
            <tr><th>Responsable</th><th className="text-right">Ganados</th><th className="text-right">Perdidos</th><th className="text-right">Tasa</th><th className="text-right">Cotizaciones</th><th className="text-right">Pipeline abierto</th></tr>
          </thead>
          <tbody>
            {owners.map((o) => (
              <tr key={o.owner}>
                <td className="font-medium">{o.owner}</td>
                <td className="text-right"><CellView c={o.won} /></td>
                <td className="text-right"><CellView c={o.lost} /></td>
                <td className="text-right tabular-nums">{pct(o.rate)}</td>
                <td className="text-right"><CellView c={o.quotes} /></td>
                <td className="text-right"><CellView c={o.open} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section id="clientes" title={`Top 10 clientes (${year})`} hint="Por monto ganado en el año.">
          <table className="table">
            <thead><tr><th>Cliente</th><th className="text-right">Negocios</th><th className="text-right">Monto</th></tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.client}><td>{c.client}</td><td className="text-right tabular-nums">{c.count}</td><td className="text-right tabular-nums">{formatMoney(c.amount)}</td></tr>
              ))}
              {clients.length === 0 && <tr><td colSpan={3} className="text-slate-500">Sin ventas en el año.</td></tr>}
            </tbody>
          </table>
        </Section>

        <Section id="productos" title={`Productos y servicios vendidos (${year})`} hint="De los negocios ganados en el año que tienen productos cargados.">
          <table className="table">
            <thead><tr><th>Producto / servicio</th><th className="text-right">Cantidad</th><th className="text-right">Negocios</th><th className="text-right">Monto</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.product}><td>{p.product}</td><td className="text-right tabular-nums">{fmtN.format(p.quantity)}</td><td className="text-right tabular-nums">{p.deals}</td><td className="text-right tabular-nums">{formatMoney(p.amount)}</td></tr>
              ))}
              {products.length === 0 && <tr><td colSpan={4} className="text-slate-500">Sin productos en negocios ganados del año.</td></tr>}
            </tbody>
          </table>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section id="perdidas" title={`Motivos de pérdida (${year})`} hint="Se registran al mover un negocio a Cerrado Perdido.">
          <table className="table">
            <thead><tr><th>Motivo</th><th className="text-right">Negocios</th><th className="text-right">Monto</th></tr></thead>
            <tbody>
              {reasons.map((r) => (
                <tr key={r.reason}><td>{r.reason}</td><td className="text-right tabular-nums">{r.count}</td><td className="text-right tabular-nums">{formatMoney(r.amount)}</td></tr>
              ))}
              {reasons.length === 0 && <tr><td colSpan={3} className="text-slate-500">Sin negocios perdidos en el año.</td></tr>}
            </tbody>
          </table>
        </Section>

        <Section id="leads" title={`Leads nuevos por origen (${year})`} hint="Contactos creados en el año (formularios, importación, manuales…).">
          <table className="table">
            <thead><tr><th>Origen</th>{MONTHS.map((m) => <th key={m} className="text-right">{m}</th>)}<th className="text-right">Total</th></tr></thead>
            <tbody>
              {leadRows.map((r) => (
                <tr key={r.source}>
                  <td className="whitespace-nowrap">{r.source}</td>
                  {r.months.map((n, i) => <td key={i} className="text-right tabular-nums">{n || <span className="text-slate-300">·</span>}</td>)}
                  <td className="text-right font-semibold tabular-nums">{r.total}</td>
                </tr>
              ))}
              {leadRows.length === 0 && <tr><td colSpan={14} className="text-slate-500">Sin contactos nuevos en el año.</td></tr>}
            </tbody>
          </table>
        </Section>
      </div>
      <p className="text-xs text-slate-500">
        ¿Necesitas otro reporte? Los datos completos se pueden descargar en <Link className="link" href="/importar">Importar / Exportar</Link>.
      </p>
    </div>
  );
}
