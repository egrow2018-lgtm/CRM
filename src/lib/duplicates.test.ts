import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicateGroups } from "./duplicates";

test("duplicateGroups junta por nombre sin sufijos y por dominio web", () => {
  const groups = duplicateGroups([
    { id: "1", name: "Siemens AG", website: "siemens.com" },
    { id: "2", name: "Siemens" },
    { id: "3", name: "SIEMENS ENERGY", website: "https://www.siemens.com/energy" },
    { id: "4", name: "Siemens Healthcare Cia. Ltda" },
    { id: "5", name: "Duragas Cía. Ltda." },
    { id: "6", name: "DURAGAS S.A." },
    { id: "7", name: "Holcim" },
  ]);
  const ids = groups.map((g) => g.map((c) => c.id).sort().join(",")).sort();
  assert.deepEqual(ids, ["1,2,3", "5,6"]);
});
