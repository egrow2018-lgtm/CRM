import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyRecurring, recurringLabel } from "./format";

test("etiqueta recurrente: lo anual se lleva a mensual dividiendo para 12", () => {
  assert.equal(recurringLabel(null, null), "");
  assert.match(recurringLabel(250, null), /^↻ \$250\/mes$/);
  assert.match(recurringLabel(null, 220), /^↻ \$220\/año \(≈ \$18\/mes\)$/);
  assert.match(recurringLabel(100, 1200), /^↻ \$100\/mes \+ \$1\.200\/año \(≈ \$200\/mes\)$/);
  assert.equal(monthlyRecurring(25, 220), 43.33);
  assert.equal(monthlyRecurring(null, null), 0);
});
