import { test } from "node:test";
import assert from "node:assert/strict";
import { utcToZoned } from "./timezone";
import { closeDateAlert, deliveryAlert, lastActivityAlert, leadAlert, nextActivityAlert, worst } from "./alerts";

// Fechas sin hora relativas al "hoy" de Ecuador (como se guardan las fechas de cierre y renovación)
const localToday = utcToZoned(new Date()).date;
const inDays = (n: number) => new Date(Date.parse(`${localToday}T00:00:00Z`) + n * 86400000);

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
  assert.equal(leadAlert(new Date(Date.now() - 2 * 86400000), "NUEVO")?.level, "rojo");
  assert.equal(leadAlert(new Date(), "EN_SEGUIMIENTO"), null);
});

test("worst toma la alerta más grave", () => {
  assert.equal(worst("verde", null, "amarillo"), "amarillo");
  assert.equal(worst("amarillo", "rojo"), "rojo");
  assert.equal(worst(null, undefined), null);
});

test("renovaciones", async () => {
  const { renewalAlert } = await import("./alerts");
  assert.equal(renewalAlert(inDays(-1))?.level, "rojo");
  assert.equal(renewalAlert(inDays(20))?.level, "amarillo");
  assert.equal(renewalAlert(inDays(90))?.level, "verde");
  assert.equal(renewalAlert(null), null);
});
