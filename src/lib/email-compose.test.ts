import { test } from "node:test";
import assert from "node:assert/strict";
import { docIdsIn, emailDomain, fillTemplate, fromEditable, imageIdsIn, plainText, renderBody, senderFor, splitEmails, toEditable } from "./email-compose";

const docs = [
  { id: "abc123", name: "Presentación Rutalink 2026" },
  { id: "def456", name: "Brochure e-grow" },
];

test("fillTemplate llena las variables conocidas y deja las desconocidas", () => {
  assert.equal(fillTemplate("Hola {{nombre}} de {{ empresa }}, {{otra}}", { nombre: "Xavier", empresa: "Tonicorp" }), "Hola Xavier de Tonicorp, {{otra}}");
  assert.equal(fillTemplate("Hola {{nombre}}{{apellido}}", { nombre: "Ana" }), "Hola Ana");
});

test("renderBody: párrafos, negrita, enlaces y documentos", () => {
  const links: string[] = [];
  const html = renderBody("Hola <Ana>\n**Mira** esto: https://e-grow.com/a?b=1&c=2.\n\nTe comparto [[doc:abc123]] y [[doc:zzz]]", {
    doc: (id) => (id === "abc123" ? { name: "Presentación Rutalink 2026", href: "https://crm/d/tok" } : null),
    wrapLink: (url) => {
      links.push(url);
      return `https://crm/t/${links.length - 1}`;
    },
  });
  assert.match(html, /<p style="margin:0 0 12px">Hola &lt;Ana&gt;<br><b>Mira<\/b> esto: <a href="https:\/\/crm\/t\/0"/);
  assert.deepEqual(links, ["https://e-grow.com/a?b=1&c=2"]);
  assert.match(html, /\.<\/p>/); // el punto final no es parte del enlace
  assert.match(html, /<a href="https:\/\/crm\/d\/tok"[^>]*>📄 <b>Presentación Rutalink 2026<\/b><\/a>/);
  assert.ok(!html.includes("zzz"));
  assert.equal((html.match(/<p /g) ?? []).length, 2);
});

test("docIdsIn y el formato editable [📄 Nombre] ida y vuelta", () => {
  const stored = "Ver [[doc:abc123]] y [[doc:def456]] y otra vez [[doc:abc123]]";
  assert.deepEqual(docIdsIn(stored), ["abc123", "def456"]);
  const editable = toEditable(stored, docs);
  assert.equal(editable, "Ver [📄 Presentación Rutalink 2026] y [📄 Brochure e-grow] y otra vez [📄 Presentación Rutalink 2026]");
  assert.equal(fromEditable(editable, docs), stored);
  assert.equal(fromEditable("[📄 No existe]", docs), "[📄 No existe]");
  assert.equal(toEditable("[[doc:borrado]]", docs), "");
});

test("plainText para el historial", () => {
  assert.equal(plainText("**Hola** [[doc:abc123]]", (id) => docs.find((d) => d.id === id)?.name ?? null), "Hola 📄 Presentación Rutalink 2026");
});

test("senderFor usa la dirección del vendedor solo si es del dominio verificado", () => {
  const sys = "e-grow CRM <crm@e-growonline.com>";
  assert.deepEqual(senderFor({ name: "Andrés Poveda", email: "andres@e-growonline.com" }, sys), {
    from: "Andrés Poveda <andres@e-growonline.com>",
    address: "andres@e-growonline.com",
    replyTo: "andres@e-growonline.com",
  });
  assert.deepEqual(senderFor({ name: "María", email: "maria@gmail.com" }, sys), {
    from: "María (e-grow) <crm@e-growonline.com>",
    address: "crm@e-growonline.com",
    replyTo: "maria@gmail.com",
  });
  assert.equal(senderFor({ name: "María", email: "maria@gmail.com", senderEmail: "maria@E-growonline.com" }, sys).address, "maria@E-growonline.com");
  assert.equal(emailDomain("Nombre <a@B.com>"), "b.com");
  assert.equal(emailDomain("sin arroba"), null);
});

test("splitEmails", () => {
  assert.deepEqual(splitEmails("a@b.com, c@d.com;e@f.com  g@h.com"), ["a@b.com", "c@d.com", "e@f.com", "g@h.com"]);
});

test("imágenes con enlace y texto con enlace", () => {
  const images = [{ id: "img1", name: "Banner Rutalink" }];
  const editable = "Mira [🖼 Banner Rutalink → https://rutalink.com] y [🖼 Banner Rutalink]\n[nuestra web](https://e-growonline.com/a?x=1) o https://otro.com.";
  const stored = fromEditable(editable, docs, images);
  assert.equal(stored, "Mira [[img:img1|https://rutalink.com]] y [[img:img1]]\n[nuestra web](https://e-growonline.com/a?x=1) o https://otro.com.");
  assert.equal(toEditable(stored, docs, images), editable);
  assert.deepEqual(imageIdsIn(stored), ["img1"]);
  const links: string[] = [];
  const html = renderBody(stored, {
    doc: () => null,
    image: (id) => (id === "img1" ? { src: "https://crm/api/img/img1", name: "Banner" } : null),
    wrapLink: (u) => {
      links.push(u);
      return `https://crm/t/${links.length - 1}`;
    },
  });
  assert.deepEqual(links, ["https://rutalink.com", "https://otro.com", "https://e-growonline.com/a?x=1"]);
  assert.match(html, /<a href="https:\/\/crm\/t\/0"><img src="https:\/\/crm\/api\/img\/img1" alt="Banner"/);
  assert.match(html, /<a href="https:\/\/crm\/t\/2"[^>]*>nuestra web<\/a>/);
  assert.match(html, /<a href="https:\/\/crm\/t\/1"[^>]*>https:\/\/otro.com<\/a>\./);
  assert.equal(plainText(stored, () => null), "Mira  y \nnuestra web (https://e-growonline.com/a?x=1) o https://otro.com.");
});
