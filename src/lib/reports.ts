/**
 * Cálculos de los reportes (sin base de datos, para poder probarlos).
 * Las fechas se agrupan en hora de Ecuador.
 */
import { utcToZoned } from "./timezone";

export const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export type RDeal = {
  id: string;
  name: string;
  amount: number;
  createdAt: Date;
  closeDate: Date | null;
  stageChangedAt: Date;
  stage: { name: string; order: number; probability: number; isWon: boolean; isLost: boolean };
  lineId: string | null;
  ownerId: string | null;
  ownerName: string | null;
  companyName: string | null;
  lostReason: string | null;
  items: { product: string; quantity: number; subtotal: number }[];
};
export type RQuote = { createdAt: Date; total: number; lineId: string | null; ownerId: string | null; dealWon: boolean };
export type RLead = { createdAt: Date; source: string | null };
export type Cell = { count: number; amount: number };

const ym = (d: Date) => {
  const [y, m] = utcToZoned(d).date.split("-").map(Number);
  return { year: y!, month: m! - 1 };
};
/** Fecha en que se ganó o perdió el negocio: la de cierre o, si no tiene, la del último cambio de etapa. */
export const closedAt = (d: RDeal) => d.closeDate ?? d.stageChangedAt;
const add = (c: Cell, amount: number) => {
  c.count++;
  c.amount += amount;
};
const empty = (): Cell => ({ count: 0, amount: 0 });
const round2 = (n: number) => Math.round(n * 100) / 100;
export const winRate = (won: number, lost: number) => (won + lost ? Math.round((won / (won + lost)) * 1000) / 10 : null);

/** Ventas ganadas por año (filas) y línea de negocio (columnas). */
export function wonByYearAndLine(deals: RDeal[], lineIds: string[]) {
  const rows = new Map<number, Map<string, Cell>>();
  for (const d of deals) {
    if (!d.stage.isWon) continue;
    const { year } = ym(closedAt(d));
    const row = rows.get(year) ?? new Map(lineIds.concat("none").map((l) => [l, empty()]));
    rows.set(year, row);
    add(row.get(d.lineId ?? "none") ?? row.set(d.lineId ?? "none", empty()).get(d.lineId ?? "none")!, d.amount);
  }
  return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([year, cells]) => ({ year, cells, total: sumCells([...cells.values()]) }));
}

/** Cotizaciones por mes (filas) y línea (columnas) de un año. */
export function quotesByMonthAndLine(quotes: RQuote[], year: number, lineIds: string[]) {
  const rows = MONTHS.map(() => new Map(lineIds.concat("none").map((l) => [l, empty()])));
  for (const q of quotes) {
    const d = ym(q.createdAt);
    if (d.year !== year) continue;
    const row = rows[d.month]!;
    add(row.get(q.lineId ?? "none") ?? row.set(q.lineId ?? "none", empty()).get(q.lineId ?? "none")!, q.total);
  }
  return rows.map((cells, month) => ({ month, cells, total: sumCells([...cells.values()]) }));
}

/** Ganados vs perdidos por año. */
export function winLossByYear(deals: RDeal[]) {
  const rows = new Map<number, { won: Cell; lost: Cell }>();
  for (const d of deals) {
    if (!d.stage.isWon && !d.stage.isLost) continue;
    const { year } = ym(closedAt(d));
    const r = rows.get(year) ?? { won: empty(), lost: empty() };
    rows.set(year, r);
    add(d.stage.isWon ? r.won : r.lost, d.amount);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, r]) => ({ year, ...r, rate: winRate(r.won.count, r.lost.count) }));
}

/** Pipeline abierto por etapa, con el valor ponderado por la probabilidad. */
export function openPipelineByStage(deals: RDeal[]) {
  const rows = new Map<string, { stage: string; order: number; probability: number; count: number; amount: number; weighted: number }>();
  for (const d of deals) {
    if (d.stage.isWon || d.stage.isLost) continue;
    const r = rows.get(d.stage.name) ?? { stage: d.stage.name, order: d.stage.order, probability: d.stage.probability, count: 0, amount: 0, weighted: 0 };
    rows.set(d.stage.name, r);
    r.count++;
    r.amount += d.amount;
    r.weighted = round2(r.weighted + (d.amount * d.stage.probability) / 100);
  }
  return [...rows.values()].sort((a, b) => a.order - b.order);
}

/** Desempeño por responsable en el año: ganados, perdidos, tasa, cotizaciones y pipeline abierto. */
export function byOwner(deals: RDeal[], quotes: RQuote[], year: number) {
  const rows = new Map<string, { owner: string; won: Cell; lost: Cell; quotes: Cell; open: Cell }>();
  const row = (id: string | null, name: string | null) => {
    const key = id ?? "none";
    const r = rows.get(key) ?? { owner: name ?? "Sin asignar", won: empty(), lost: empty(), quotes: empty(), open: empty() };
    rows.set(key, r);
    return r;
  };
  const owners = new Map(deals.map((d) => [d.ownerId ?? "none", d.ownerName]));
  for (const d of deals) {
    if (!d.stage.isWon && !d.stage.isLost) add(row(d.ownerId, d.ownerName).open, d.amount);
    else if (ym(closedAt(d)).year === year) add(d.stage.isWon ? row(d.ownerId, d.ownerName).won : row(d.ownerId, d.ownerName).lost, d.amount);
  }
  for (const q of quotes) if (ym(q.createdAt).year === year) add(row(q.ownerId, owners.get(q.ownerId ?? "none") ?? null).quotes, q.total);
  return [...rows.values()]
    .map((r) => ({ ...r, rate: winRate(r.won.count, r.lost.count) }))
    .sort((a, b) => b.won.amount - a.won.amount || b.open.amount - a.open.amount);
}

/** Clientes con más ventas ganadas en el año. */
export function topClients(deals: RDeal[], year: number, limit = 10) {
  const rows = new Map<string, Cell>();
  for (const d of deals) {
    if (!d.stage.isWon || ym(closedAt(d)).year !== year) continue;
    const key = d.companyName ?? "Sin empresa";
    add(rows.get(key) ?? rows.set(key, empty()).get(key)!, d.amount);
  }
  return [...rows.entries()].map(([client, c]) => ({ client, ...c })).sort((a, b) => b.amount - a.amount).slice(0, limit);
}

/** Productos y servicios vendidos (negocios ganados del año). */
export function topProducts(deals: RDeal[], year: number, limit = 15) {
  const rows = new Map<string, { product: string; quantity: number; amount: number; deals: number }>();
  for (const d of deals) {
    if (!d.stage.isWon || ym(closedAt(d)).year !== year) continue;
    for (const it of d.items) {
      const r = rows.get(it.product) ?? { product: it.product, quantity: 0, amount: 0, deals: 0 };
      rows.set(it.product, r);
      r.quantity += it.quantity;
      r.amount = round2(r.amount + it.subtotal);
      r.deals++;
    }
  }
  return [...rows.values()].sort((a, b) => b.amount - a.amount).slice(0, limit);
}

/** Motivos de pérdida del año. */
export function lostReasons(deals: RDeal[], year: number) {
  const rows = new Map<string, Cell>();
  for (const d of deals) {
    if (!d.stage.isLost || ym(closedAt(d)).year !== year) continue;
    const key = d.lostReason?.trim() || "Sin motivo registrado";
    add(rows.get(key) ?? rows.set(key, empty()).get(key)!, d.amount);
  }
  return [...rows.entries()].map(([reason, c]) => ({ reason, ...c })).sort((a, b) => b.count - a.count);
}

/** Días promedio desde que se crea el negocio hasta que se gana (año de cierre). */
export function avgDaysToWin(deals: RDeal[], year: number) {
  const won = deals.filter((d) => d.stage.isWon && ym(closedAt(d)).year === year);
  // Se ignoran los datos inconsistentes (cerrado antes de crearse, típico de importaciones)
  const days = won.map((d) => (closedAt(d).getTime() - d.createdAt.getTime()) / 86400000).filter((n) => n >= 0);
  return { count: won.length, avg: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null };
}

/** Leads (contactos nuevos) por mes y origen en el año. */
export function leadsByMonthAndSource(leads: RLead[], year: number) {
  const sources = new Map<string, number[]>();
  for (const l of leads) {
    const d = ym(l.createdAt);
    if (d.year !== year) continue;
    const key = l.source?.trim() || "Sin origen";
    const row = sources.get(key) ?? sources.set(key, MONTHS.map(() => 0)).get(key)!;
    row[d.month]!++;
  }
  return [...sources.entries()]
    .map(([source, months]) => ({ source, months, total: months.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);
}

/** Conversión de cotizaciones: cuántas del año terminaron en un negocio ganado. */
export function quoteConversion(quotes: RQuote[], year: number) {
  const ofYear = quotes.filter((q) => ym(q.createdAt).year === year);
  const won = ofYear.filter((q) => q.dealWon);
  return { quotes: ofYear.length, won: won.length, rate: ofYear.length ? Math.round((won.length / ofYear.length) * 1000) / 10 : null };
}

export function sumCells(cells: Cell[]): Cell {
  return cells.reduce((t, c) => ({ count: t.count + c.count, amount: round2(t.amount + c.amount) }), empty());
}
