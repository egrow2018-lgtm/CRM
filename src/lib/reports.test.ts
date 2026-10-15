import { test } from "node:test";
import assert from "node:assert/strict";
import { byOwner, quotesByMonthAndLine, recurringSummary, topProducts, winLossByYear, wonByYearAndLine, type RDeal } from "./reports";

const deal = (p: Partial<RDeal>): RDeal => ({
  id: Math.random().toString(),
  name: "n",
  amount: 100,
  createdAt: new Date("2026-01-10T15:00:00Z"),
  closeDate: new Date("2026-03-10T15:00:00Z"),
  stageChangedAt: new Date("2026-03-10T15:00:00Z"),
  stage: { name: "Ganado", order: 6, probability: 100, isWon: true, isLost: false },
  lineId: "rut",
  ownerId: "u1",
  ownerName: "Andrés",
  companyName: "ACME",
  lostReason: null,
  items: [],
  ...p,
});
const lost = { name: "Perdido", order: 7, probability: 0, isWon: false, isLost: true };

test("ventas por año y línea, y ganados vs perdidos", () => {
  const deals = [
    deal({}),
    deal({ amount: 50, lineId: "elearn" }),
    deal({ stage: lost }),
    // El 1 de enero a las 03:00 UTC todavía es 31 de diciembre en Ecuador
    deal({ closeDate: new Date("2026-01-01T03:00:00Z") }),
  ];
  const byYear = wonByYearAndLine(deals, ["rut", "elearn"]);
  assert.deepEqual(byYear.map((r) => r.year), [2026, 2025]);
  assert.deepEqual(byYear[0]!.cells.get("rut"), { count: 1, amount: 100 });
  assert.deepEqual(byYear[0]!.total, { count: 2, amount: 150 });
  const wl = winLossByYear(deals);
  assert.equal(wl[0]!.rate, 66.7);
  assert.equal(byOwner(deals, [], 2026)[0]!.won.count, 2);
});

test("cotizaciones por mes y productos vendidos", () => {
  const rows = quotesByMonthAndLine(
    [
      { createdAt: new Date("2026-02-05T15:00:00Z"), total: 200, lineId: "rut", ownerId: null, dealWon: false },
      { createdAt: new Date("2025-02-05T15:00:00Z"), total: 999, lineId: "rut", ownerId: null, dealWon: false },
    ],
    2026,
    ["rut"],
  );
  assert.deepEqual(rows[1]!.cells.get("rut"), { count: 1, amount: 200 });
  assert.equal(rows[0]!.total.count, 0);
  const tp = topProducts([deal({ items: [{ product: "GPS", quantity: 3, subtotal: 300 }] }), deal({ items: [{ product: "GPS", quantity: 2, subtotal: 200 }] })], 2026);
  assert.deepEqual(tp[0], { product: "GPS", quantity: 5, amount: 500, deals: 2 });
});

test("ingreso recurrente mensual: mensual + anual ÷ 12, sin los ya renovados", () => {
  const base = { createdAt: new Date("2026-01-01"), closeDate: null, lostReason: null, companyName: null, items: [] };
  const won = { name: "Ganado", order: 7, probability: 100, isWon: true, isLost: false };
  const open = { name: "Cotización", order: 3, probability: 40, isWon: false, isLost: false };
  const now = new Date("2026-10-15T15:00:00Z");
  const r = recurringSummary(
    [
      { ...base, id: "a", name: "Rutalink mensual", amount: 300, stage: won, stageChangedAt: new Date("2026-10-02T15:00:00Z"), lineId: "rl", ownerId: "u1", ownerName: "Ana", monthly: 25, renewalDate: new Date("2026-12-01") },
      { ...base, id: "b", name: "Humand anual", amount: 1200, stage: won, stageChangedAt: new Date("2026-03-01T15:00:00Z"), lineId: "hu", ownerId: "u2", ownerName: "Luis", annual: 1200, renewalDate: new Date("2027-03-01") },
      { ...base, id: "c", name: "Ya renovado", amount: 600, stage: won, stageChangedAt: new Date("2025-03-01T15:00:00Z"), lineId: "hu", ownerId: "u2", ownerName: "Luis", annual: 600, renewedByWon: true },
      { ...base, id: "d", name: "Abierto", amount: 300, stage: open, stageChangedAt: now, lineId: "rl", ownerId: "u1", ownerName: "Ana", monthly: 25 },
      { ...base, id: "e", name: "Pago único", amount: 5000, stage: won, stageChangedAt: now, lineId: "el", ownerId: "u1", ownerName: "Ana" },
    ],
    now,
  );
  assert.equal(r.mrr, 125); // 25 + 1200 ÷ 12
  assert.equal(r.clients, 2);
  assert.equal(r.newThisMonth, 25);
  assert.deepEqual(r.byLine.map((l) => [l.id, l.mrr]), [["hu", 100], ["rl", 25]]);
  assert.deepEqual(r.renewals.map((x) => x.id), ["a"]);
  assert.equal(r.renewalsMrr, 25);
});
