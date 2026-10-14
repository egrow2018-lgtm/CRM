import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTeamValue, teamMemberLabel } from "./custom-fields";

test("parseTeamValue separa los integrantes de la lista y conserva el texto antiguo", () => {
  const ids = new Set(["a1", "b2", "c3"]);
  assert.deepEqual(parseTeamValue("a1,c3", ids), { ids: ["a1", "c3"], legacy: null });
  // Un integrante que ya no existe se ignora
  assert.deepEqual(parseTeamValue("a1,zz", ids), { ids: ["a1"], legacy: null });
  // Texto libre de antes del cambio
  assert.deepEqual(parseTeamValue("Diseño: Ana · Video: Luis", ids), { ids: [], legacy: "Diseño: Ana · Video: Luis" });
  assert.deepEqual(parseTeamValue(undefined, ids), { ids: [], legacy: null });
});

test("teamMemberLabel muestra la especialidad si la hay", () => {
  assert.equal(teamMemberLabel({ name: "Ana", specialty: "Diseño instruccional" }), "Ana (Diseño instruccional)");
  assert.equal(teamMemberLabel({ name: "Luis", specialty: null }), "Luis");
});
