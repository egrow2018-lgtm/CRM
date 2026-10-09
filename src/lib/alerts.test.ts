import { test } from "node:test";
import assert from "node:assert/strict";
import { closeDateAlert, deliveryAlert, lastActivityAlert, leadAlert, nextActivityAlert, worst } from "./alerts";

const inDays = (n: number) => new Date(Date.now() + n * 86400000);

test("próxima actividad", () => {
  assert.equal(nextActivityAlert(null, false).level, "amarillo");
  assert.equal(nextActivityAlert(inDays(-3), true).level, "rojo");
  assert.equal(nextActivityAlert(inDays(5), true).level, "verde");
});

test("fecha de cierre", () => {
  assert.equal(closeDateAlert(inDays(-1), true)?.level, "rojo");
  assert.equal(closeDateAlert(inDays(10), true)?.level, "amarillo");
  assert.equal(closeDateAlert(inDays(90), true)?.level, "verde");
  assert.equal(closeDateAlert(inDays(-1), false), null);
});

test("última actividad, entrega y leads", () => {
  assert.equal(lastActivityAlert(inDays(-5)).level, "verde");
  assert.equal(lastActivityAlert(inDays(-40)).level, "amarillo");
  assert.equal(lastActivityAlert(inDays(-90)).level, "rojo");
  assert.equal(deliveryAlert(inDays(-2).toISOString().slice(0, 10), "50")?.level, "rojo");
  assert.equal(deliveryAlert(inDays(-2).toISOString().slice(0, 10), "100")?.level, "verde");
  assert.equal(leadAlert(inDays(-2), "NUEVO")?.level, "rojo");
  assert.equal(leadAlert(new Date(), "EN_SEGUIMIENTO"), null);
});

test("worst toma la alerta más grave", () => {
  assert.equal(worst("verde", null, "amarillo"), "amarillo");
  assert.equal(worst("amarillo", "rojo"), "rojo");
  assert.equal(worst(null, undefined), null);
});
