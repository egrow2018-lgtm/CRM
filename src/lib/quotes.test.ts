import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotals, quoteCode } from "./quotes";

test("totales con descuento e IVA 15%", () => {
  const t = computeTotals(
    [
      { quantity: 2, unitPrice: 4500, discount: 10 },
      { quantity: 1, unitPrice: 1000, discount: 0 },
    ],
    15,
  );
  assert.deepEqual(t.lines, [8100, 1000]);
  assert.equal(t.subtotal, 9100);
  assert.equal(t.discountTotal, 900);
  assert.equal(t.iva, 1365);
  assert.equal(t.total, 10465);
});

test("IVA 0% y redondeo a centavos", () => {
  const t = computeTotals([{ quantity: 3, unitPrice: 33.333, discount: 0 }], 0);
  assert.equal(t.subtotal, 100);
  assert.equal(t.total, 100);
});

test("código de cotización", () => {
  assert.equal(quoteCode(2026, 7), "COT-2026-0007");
});
