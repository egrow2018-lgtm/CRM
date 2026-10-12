import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicateGroups, findCompanyDuplicate, taxIdKey } from "./duplicates";

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

test("findCompanyDuplicate por RUC o sitio web", () => {
  const companies = [
    { id: "a", name: "Holcim", taxId: "1790-005-55500-1", website: "https://www.holcim.com.ec/inicio" },
    { id: "b", name: "Tienda", taxId: null, website: "https://facebook.com/tienda" },
  ];
  assert.equal(findCompanyDuplicate({ taxId: "1790005555001" }, companies)?.reason, "ruc");
  assert.equal(findCompanyDuplicate({ website: "holcim.com.ec" }, companies)?.company.id, "a");
  assert.equal(findCompanyDuplicate({ website: "holcim.com.ec" }, companies, "a"), null);
  assert.equal(findCompanyDuplicate({ website: "facebook.com/otra" }, companies), null);
  assert.equal(findCompanyDuplicate({ taxId: "123" }, [{ id: "c", taxId: "123", website: null }]), null);
  assert.equal(taxIdKey(" 1792146739001 "), "1792146739001");
});
