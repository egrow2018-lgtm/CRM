import { test } from "node:test";
import assert from "node:assert/strict";
import { emailLayout, escapeHtml } from "./email";

test("escapa HTML del contenido del usuario", () => {
  assert.equal(escapeHtml(`<b>"Hola" & 'chao'</b>`), "&lt;b&gt;&quot;Hola&quot; &amp; &#39;chao&#39;&lt;/b&gt;");
});

test("la plantilla usa los colores de marca y escapa el título", () => {
  const html = emailLayout("Nuevo lead <script>", "<p>x</p>");
  assert.ok(html.includes("#1c315e") && html.includes("#b9d43a"));
  assert.ok(html.includes("Nuevo lead &lt;script&gt;"));
});
