import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotals, firstYearFactor, itemFirstYear, parseQuoteLines, quoteCode, quoteWhatsappText } from "./quotes";

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

test("parseQuoteLines limpia las líneas del formulario", () => {
  const lines = parseQuoteLines([
    { productId: "p1", description: " Cámara GPS ", quantity: "2", unitPrice: "650,5", discount: "150" },
    { productId: "", description: "", quantity: "1", unitPrice: "10" },
    { description: "Instalación", quantity: "-1", unitPrice: "x" },
    { description: "Soporte", quantity: "1", unitPrice: "-5", discount: "-3" },
  ]);
  assert.deepEqual(lines, [
    { productId: "p1", description: "Cámara GPS", quantity: 2, unitPrice: 650.5, discount: 100, billing: "UNICO", termMonths: null },
    { productId: null, description: "Soporte", quantity: 1, unitPrice: 0, discount: 0, billing: "UNICO", termMonths: null },
  ]);
  assert.deepEqual(parseQuoteLines("nada"), []);
});

test("cotización con pago único, mensualidad y anualidad: valor del primer año", () => {
  // Rutalink: 10 equipos a $120 (pago único) + monitoreo $25 × 10 unidades al mes, contrato de 12 meses
  const t = computeTotals(
    [
      { quantity: 10, unitPrice: 120, discount: 0, billing: "UNICO" },
      { quantity: 10, unitPrice: 25, discount: 0, billing: "MENSUAL", termMonths: 12 },
    ],
    15,
  );
  assert.deepEqual(t.lines, [1200, 250]);
  assert.equal(t.oneTime, 1200);
  assert.equal(t.monthly, 250);
  assert.equal(t.annual, 0);
  assert.equal(t.subtotal, 4200); // 1200 + 250 × 12
  assert.equal(t.iva, 630);
  assert.equal(t.total, 4830);
  // Licencia anual de Humand
  const h = computeTotals([{ quantity: 50, unitPrice: 30, discount: 10, billing: "ANUAL", termMonths: 12 }], 15);
  assert.equal(h.annual, 1350);
  assert.equal(h.subtotal, 1350);
  assert.equal(h.discountTotal, 150);
});

test("las mensualidades del primer año se limitan al plazo (y a 12 meses)", () => {
  assert.equal(firstYearFactor("MENSUAL", 6), 6);
  assert.equal(firstYearFactor("MENSUAL", 36), 12);
  assert.equal(firstYearFactor("MENSUAL", null), 12);
  assert.equal(firstYearFactor("ANUAL", 60), 1);
  assert.equal(firstYearFactor("UNICO", 12), 1);
  assert.equal(firstYearFactor(undefined), 1);
  assert.equal(itemFirstYear({ quantity: 2, unitPrice: 50, discount: 0, billing: "MENSUAL", termMonths: 12 }), 1200);
  assert.equal(itemFirstYear({ quantity: 2, unitPrice: 50, discount: 0 }), 100);
});

test("parseQuoteLines: tipo de cobro y plazo", () => {
  const [a, b, c] = parseQuoteLines([
    { description: "Monitoreo", quantity: "1", unitPrice: "25", billing: "MENSUAL", termMonths: "36" },
    { description: "Licencia", quantity: "1", unitPrice: "300", billing: "ANUAL" },
    { description: "Equipo", quantity: "1", unitPrice: "120", billing: "TRIMESTRAL", termMonths: "3" },
  ]);
  assert.equal(a!.billing, "MENSUAL");
  assert.equal(a!.termMonths, 36);
  assert.equal(b!.termMonths, 12);
  assert.equal(c!.billing, "UNICO");
  assert.equal(c!.termMonths, null);
});

test("mensaje de WhatsApp de una cotización: saluda por el nombre y dice hasta cuándo vale", () => {
  assert.equal(
    quoteWhatsappText({ code: "COT-2026-0003", firstName: "Paola", dealName: "Escuela de liderazgo virtual 2026", validUntil: "31/10/2026", url: "https://crm/d/abc" }),
    "Hola Paola, te comparto la cotización de Escuela de liderazgo virtual 2026 (COT-2026-0003), válida hasta el 31/10/2026: https://crm/d/abc",
  );
});

test("mensaje de WhatsApp sin nombre ni negocio", () => {
  assert.equal(
    quoteWhatsappText({ code: "COT-2026-0004", firstName: null, dealName: null, validUntil: "31/10/2026", url: "https://crm/d/x" }),
    "Hola, te comparto la cotización COT-2026-0004, válida hasta el 31/10/2026: https://crm/d/x",
  );
});

test("la descripción conserva los saltos de línea y admite textos largos", () => {
  const [l] = parseQuoteLines([{ description: "  Curso virtual\r\nIncluye 6 videos\n\n\n\nY 2 rondas de revisión  ", quantity: "1", unitPrice: "10" }]);
  assert.equal(l!.description, "Curso virtual\nIncluye 6 videos\n\nY 2 rondas de revisión");
  const [largo] = parseQuoteLines([{ description: "x".repeat(1500), quantity: "1" }]);
  assert.equal(largo!.description.length, 1000);
});
