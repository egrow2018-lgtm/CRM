import { test } from "node:test";
import assert from "node:assert/strict";
import { lineBrand, textOn, validHex } from "./brand";

test("marca de la línea y contraste del texto", () => {
  const base = { name: "Rutalink", brandName: null, brandLogo: null, brandPrimary: null, brandAccent: null, brandWebsite: null };
  assert.equal(lineBrand(base), null);
  const b = lineBrand({ ...base, brandLogo: "data:image/png;base64,AAA", brandPrimary: "#ff6600", brandAccent: "nope" });
  assert.equal(b?.name, "Rutalink");
  assert.equal(b?.primary, "#ff6600");
  assert.equal(b?.accent, "#b9d43a");
  assert.equal(validHex("#12345", "#000000"), "#000000");
  assert.equal(textOn("#1c315e"), "#ffffff");
  assert.equal(textOn("#b9d43a"), "#0f172a");
});
