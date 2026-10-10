import { test } from "node:test";
import assert from "node:assert/strict";
import { can, canMoveDeal, permissionsOf } from "./permissions";

test("permisos por perfil y personalizados", () => {
  assert.equal(can("COMERCIAL", "contacts:delete"), false);
  assert.equal(can({ role: "COMERCIAL", customPermissions: false, permissions: ["contacts:delete"] }, "contacts:delete"), false);
  const maria = { role: "COMERCIAL" as const, customPermissions: true, permissions: ["contacts:write", "contacts:delete", "x:desconocido"] };
  assert.equal(can(maria, "contacts:delete"), true);
  assert.equal(can(maria, "deals:write"), false);
  assert.deepEqual(permissionsOf(maria), ["contacts:write", "contacts:delete"]);
  // El administrador no pierde permisos aunque tenga una lista personalizada
  assert.equal(can({ role: "ADMIN", customPermissions: true, permissions: [] }, "users:manage"), true);
});

test("Proyectos solo mueve negocios en ejecución", () => {
  const firma = { probability: 80, isWon: false, isLost: false };
  const cotizacion = { probability: 40, isWon: false, isLost: false };
  assert.equal(canMoveDeal("PROYECTOS", firma, { probability: 90, isWon: false, isLost: false }), true);
  assert.equal(canMoveDeal("PROYECTOS", cotizacion, firma), false);
  assert.equal(canMoveDeal("COMERCIAL", cotizacion, firma), true);
});
