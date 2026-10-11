import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { loadReportData } from "@/lib/report-data";
import { buildWorkbook, xlsxResponse, type Sheet } from "@/lib/excel";
import {
  MONTHS,
  avgDaysToWin,
  byOwner,
  leadsByMonthAndSource,
  lostReasons,
  openPipelineByStage,
  quotesByMonthAndLine,
  topClients,
  topProducts,
  winLossByYear,
  wonByYearAndLine,
  type Cell,
} from "@/lib/reports";
import { utcToZoned } from "@/lib/timezone";

export const dynamic = "force-dynamic";

/** Descarga en Excel los mismos reportes de la página, con el año y la línea elegidos. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "reports:view")) return new Response("No autorizado", { status: 403 });
  const url = new URL(req.url);
  const lineId = url.searchParams.get("line") || undefined;
  const year = Number(url.searchParams.get("year")) || Number(utcToZoned(new Date()).date.slice(0, 4));
  const { deals, quotes, leads, lines } = await loadReportData(lineId);
  const lineIds = lines.map((l) => l.id);
  const cols = lines.map((l) => [l.id, l.name] as const).concat(lineId ? [] : [["none", "Sin línea"] as const]);
  // Una columna de monto y otra de cantidad por línea
  const matrixColumns = (first: string) => [
    { header: first, key: "k", width: 10 },
    ...cols.flatMap(([id, name]) => [
      { header: `${name} (US$)`, key: `${id}_a`, money: true, width: 16 },
      { header: `${name} (#)`, key: `${id}_n`, width: 10 },
    ]),
    { header: "Total (US$)", key: "t_a", money: true, width: 16 },
    { header: "Total (#)", key: "t_n", width: 10 },
  ];
  const matrixRow = (k: string | number, cells: Map<string, Cell>, total: Cell) => ({
    k,
    ...Object.fromEntries(cols.flatMap(([id]) => [[`${id}_a`, cells.get(id)?.amount ?? 0], [`${id}_n`, cells.get(id)?.count ?? 0]])),
    t_a: total.amount,
    t_n: total.count,
  });
  const days = avgDaysToWin(deals, year);

  const sheets: Sheet[] = [
    {
      name: "Ventas por año y línea",
      columns: matrixColumns("Año"),
      rows: wonByYearAndLine(deals, lineIds).map((r) => matrixRow(r.year, r.cells, r.total)),
    },
    {
      name: `Cotizaciones ${year}`,
      columns: matrixColumns("Mes"),
      rows: quotesByMonthAndLine(quotes, year, lineIds).map((r) => matrixRow(MONTHS[r.month]!, r.cells, r.total)),
    },
    {
      name: "Ganados vs perdidos",
      columns: [
        { header: "Año", key: "year" },
        { header: "Ganados (#)", key: "wn" },
        { header: "Ganados (US$)", key: "wa", money: true, width: 16 },
        { header: "Perdidos (#)", key: "ln" },
        { header: "Perdidos (US$)", key: "la", money: true, width: 16 },
        { header: "Tasa de cierre (%)", key: "rate", width: 18 },
      ],
      rows: winLossByYear(deals).map((r) => ({ year: r.year, wn: r.won.count, wa: r.won.amount, ln: r.lost.count, la: r.lost.amount, rate: r.rate })),
    },
    {
      name: "Pipeline abierto",
      columns: [
        { header: "Etapa", key: "stage", width: 24 },
        { header: "Probabilidad (%)", key: "probability", width: 16 },
        { header: "Negocios", key: "count" },
        { header: "Monto (US$)", key: "amount", money: true, width: 16 },
        { header: "Ponderado (US$)", key: "weighted", money: true, width: 16 },
      ],
      rows: openPipelineByStage(deals),
    },
    {
      name: `Responsables ${year}`,
      columns: [
        { header: "Responsable", key: "owner", width: 24 },
        { header: "Ganados (#)", key: "wn" },
        { header: "Ganados (US$)", key: "wa", money: true, width: 16 },
        { header: "Perdidos (#)", key: "ln" },
        { header: "Tasa de cierre (%)", key: "rate", width: 18 },
        { header: "Cotizaciones (#)", key: "qn", width: 16 },
        { header: "Cotizado (US$)", key: "qa", money: true, width: 16 },
        { header: "Pipeline abierto (US$)", key: "oa", money: true, width: 20 },
      ],
      rows: byOwner(deals, quotes, year).map((o) => ({ owner: o.owner, wn: o.won.count, wa: o.won.amount, ln: o.lost.count, rate: o.rate, qn: o.quotes.count, qa: o.quotes.amount, oa: o.open.amount })),
    },
    {
      name: `Top clientes ${year}`,
      columns: [
        { header: "Cliente", key: "client", width: 36 },
        { header: "Negocios", key: "count" },
        { header: "Monto (US$)", key: "amount", money: true, width: 16 },
      ],
      rows: topClients(deals, year, 50),
    },
    {
      name: `Productos ${year}`,
      columns: [
        { header: "Producto / servicio", key: "product", width: 36 },
        { header: "Cantidad", key: "quantity" },
        { header: "Negocios", key: "deals" },
        { header: "Monto (US$)", key: "amount", money: true, width: 16 },
      ],
      rows: topProducts(deals, year, 500),
    },
    {
      name: `Motivos de pérdida ${year}`,
      columns: [
        { header: "Motivo", key: "reason", width: 40 },
        { header: "Negocios", key: "count" },
        { header: "Monto (US$)", key: "amount", money: true, width: 16 },
      ],
      rows: lostReasons(deals, year),
    },
    {
      name: `Leads ${year}`,
      columns: [{ header: "Origen", key: "source", width: 28 }, ...MONTHS.map((m, i) => ({ header: m, key: `m${i}`, width: 7 })), { header: "Total", key: "total" }],
      rows: leadsByMonthAndSource(leads, year).map((r) => ({ source: r.source, total: r.total, ...Object.fromEntries(r.months.map((n, i) => [`m${i}`, n])) })),
    },
    {
      name: "Notas",
      columns: [{ header: "Dato", key: "k", width: 40 }, { header: "Valor", key: "v", width: 50 }],
      rows: [
        { k: "Año", v: year },
        { k: "Línea de negocio", v: lineId ? lines[0]?.name : "Todas" },
        { k: "Días promedio para ganar", v: days.avg ?? "—" },
        { k: "Generado", v: new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" }) },
        { k: "Criterio", v: "Ventas y pérdidas por fecha de cierre; cotizaciones por fecha de emisión." },
      ],
    },
  ];
  const suffix = lineId ? `-${(lines[0]?.name ?? "linea").toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "";
  return xlsxResponse(await buildWorkbook(sheets), `reportes-${year}${suffix}.xlsx`);
}
