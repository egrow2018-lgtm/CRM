import { test } from "node:test";
import assert from "node:assert/strict";
import { countLabel, formatDate, formatLocalDate, monthlyRecurring, recurringLabel } from "./format";

test("etiqueta recurrente: lo anual se lleva a mensual dividiendo para 12", () => {
  assert.equal(recurringLabel(null, null), "");
  assert.match(recurringLabel(250, null), /^↻ \$250\/mes$/);
  assert.match(recurringLabel(null, 220), /^↻ \$220\/año \(≈ \$18\/mes\)$/);
  assert.match(recurringLabel(100, 1200), /^↻ \$100\/mes \+ \$1\.200\/año \(≈ \$200\/mes\)$/);
  assert.equal(monthlyRecurring(25, 220), 43.33);
  assert.equal(monthlyRecurring(null, null), 0);
});

test("fecha local: un momento después de las 7 p. m. en Ecuador conserva el día de Ecuador", () => {
  // 16/10/2026 a las 7:56 p. m. en Ecuador = 17/10/2026 00:56 UTC
  assert.equal(formatLocalDate(new Date("2026-10-17T00:56:00Z")), "16/10/2026");
  assert.equal(formatLocalDate(new Date("2026-10-16T15:00:00Z")), "16/10/2026");
  assert.equal(formatLocalDate(null), "—");
});

test("fecha sin hora (guardada a medianoche UTC) se sigue mostrando tal cual", () => {
  assert.equal(formatDate(new Date("2026-11-16T00:00:00Z")), "16/11/2026");
});

test("cantidad con plural correcto", () => {
  assert.equal(countLabel(1, "cotización", "cotizaciones"), "1 cotización");
  assert.equal(countLabel(3, "cotización", "cotizaciones"), "3 cotizaciones");
  assert.equal(countLabel(0, "cotización", "cotizaciones"), "0 cotizaciones");
});
