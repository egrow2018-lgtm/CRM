import { test } from "node:test";
import assert from "node:assert/strict";
import { companyKey, corporateDomain, normalize, parseAmount, parseCsv, parseDate, samePerson, websiteDomain } from "./csv";

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

test("companyKey ignora sufijos legales y puntuación", () => {
  assert.equal(companyKey("FLP PROCESADOS S.A.S."), "flp procesados");
  assert.equal(companyKey("Holcim Ecuador S.A."), "holcim ecuador");
  assert.equal(companyKey("Duragas Cía. Ltda."), "duragas");
  assert.equal(companyKey("Siemens AG"), "siemens");
  assert.equal(companyKey("Bosch GmbH"), "bosch");
});

test("dominios", () => {
  assert.equal(websiteDomain("https://www.holcim.com/ec"), "holcim.com");
  assert.equal(corporateDomain("ana@holcim.com"), "holcim.com");
  assert.equal(corporateDomain("ana@gmail.com"), null);
});

test("samePerson", () => {
  assert.ok(samePerson("Janine Salgado Torres", "Janine Salgado"));
  assert.ok(samePerson("Andres Poveda", "Andrés Poveda"));
  assert.ok(!samePerson("Santiago Poveda", "Andrés Poveda"));
});
