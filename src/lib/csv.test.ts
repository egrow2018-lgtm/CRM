import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, parseAmount, parseCsv, parseDate } from "./csv";

test("parseCsv maneja comillas, separador ; y BOM", () => {
  const rows = parseCsv('﻿Nombre;Valor\n"Holcim; Ltd";"10.150"\r\n"Dice ""hola""";5\n');
  assert.deepEqual(rows, [["Nombre", "Valor"], ["Holcim; Ltd", "10.150"], ['Dice "hola"', "5"]]);
});

test("parseAmount", () => {
  assert.equal(parseAmount("10150"), 10150);
  assert.equal(parseAmount("10150.5"), 10150.5);
  assert.equal(parseAmount("US$ 10.150"), 10150);
  assert.equal(parseAmount("10,150.25"), 10150.25);
  assert.equal(parseAmount("10.150,25"), 10150.25);
  assert.equal(parseAmount("3,5"), 3.5);
  assert.equal(parseAmount(""), 0);
});

test("parseDate", () => {
  assert.equal(parseDate("2025-07-31")?.toISOString(), "2025-07-31T00:00:00.000Z");
  assert.equal(parseDate("31/07/2025")?.toISOString(), "2025-07-31T00:00:00.000Z");
  assert.equal(parseDate("07/31/2025")?.toISOString(), "2025-07-31T00:00:00.000Z");
  assert.equal(parseDate(""), null);
});

test("normalize quita tildes y mayúsculas", () => {
  assert.equal(normalize("  Cotización-Envío "), "cotizacion-envio");
});
