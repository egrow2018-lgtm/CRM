import { test } from "node:test";
import assert from "node:assert/strict";
import { utcToZoned, zonedToUtc } from "./timezone";

test("Ecuador (UTC-5): 10:30 local = 15:30 UTC", () => {
  assert.equal(zonedToUtc("2026-10-20", "10:30", "America/Guayaquil").toISOString(), "2026-10-20T15:30:00.000Z");
  assert.deepEqual(utcToZoned(new Date("2026-10-20T15:30:00Z"), "America/Guayaquil"), { date: "2026-10-20", time: "10:30" });
});

test("cambia de día correctamente", () => {
  assert.equal(zonedToUtc("2026-10-20", "21:00", "America/Guayaquil").toISOString(), "2026-10-21T02:00:00.000Z");
  assert.deepEqual(utcToZoned(new Date("2026-10-21T02:00:00Z"), "America/Guayaquil"), { date: "2026-10-20", time: "21:00" });
});

test("zonas con horario de verano (Madrid)", () => {
  assert.equal(zonedToUtc("2026-07-01", "10:00", "Europe/Madrid").toISOString(), "2026-07-01T08:00:00.000Z");
  assert.equal(zonedToUtc("2026-12-01", "10:00", "Europe/Madrid").toISOString(), "2026-12-01T09:00:00.000Z");
});
