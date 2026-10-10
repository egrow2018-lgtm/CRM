import { test } from "node:test";
import assert from "node:assert/strict";
import { gpsboxLink, normalizeTaxId, summarizeGpsbox } from "./gpsbox";

const data = {
  clientes: [
    { id: "CLI-1", nombre: "Transportes Andinos", identificacion: "1792146739001", estado: "Activo", tipoPlan: "Anual" },
    { id: "CLI-2", nombre: "Otro", identificacion: "0912345678" },
  ],
  unidades: [
    { id: "U1", clienteId: "CLI-1", estado: "Activo", fechaProximaRenovacion: "2026-12-01" },
    { id: "U2", clienteId: "CLI-1", estado: "Activo", fechaProximaRenovacion: "2026-11-15" },
    { id: "U3", clienteId: "CLI-1", estado: "Inactivo", fechaProximaRenovacion: "2026-10-01" },
    { id: "U4", clienteId: "CLI-2", estado: "Activo" },
  ],
};

test("normaliza RUC/cédula", () => {
  assert.equal(normalizeTaxId(" 1792146739-001 "), "1792146739001");
  assert.equal(normalizeTaxId(null), "");
});

test("resume unidades activas y próxima renovación del cliente por RUC", () => {
  assert.deepEqual(summarizeGpsbox(data, "1792146739-001"), {
    nombre: "Transportes Andinos",
    estado: "Activo",
    tipoPlan: "Anual",
    unidadesActivas: 2,
    unidadesTotal: 3,
    proximaRenovacion: "2026-11-15",
  });
  assert.equal(summarizeGpsbox(data, "999"), null);
  assert.equal(summarizeGpsbox(data, ""), null);
});

test("enlace con RUC normalizado y datos para crear el cliente", () => {
  process.env.GPSBOX_URL = "https://gpsbox.example.com/";
  const url = new URL(
    gpsboxLink({
      taxId: "1792146739-001",
      name: "Transportes Andinos",
      city: "Quito",
      contact: { firstName: "Ana", lastName: "Pérez", email: "ana@ta.ec", phone: "+593 99 111 2222" },
    }),
  );
  assert.equal(url.origin, "https://gpsbox.example.com");
  assert.equal(url.searchParams.get("ruc"), "1792146739001");
  assert.equal(url.searchParams.get("contactoApellido"), "Pérez");
  assert.equal(url.searchParams.get("telefono"), "+593 99 111 2222");
});
