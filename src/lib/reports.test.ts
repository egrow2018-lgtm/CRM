import { test } from "node:test";
import assert from "node:assert/strict";
import { byOwner, quotesByMonthAndLine, topProducts, winLossByYear, wonByYearAndLine, type RDeal } from "./reports";

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
