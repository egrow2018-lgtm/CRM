import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, groupVisitors, mergePageTimes, parsePageTimes, randomToken, type ViewLike } from "./doc-stats";

test("mergePageTimes suma y descarta valores inválidos o exagerados", () => {
  assert.deepEqual(mergePageTimes({ "1": 3 }, { "1": 2, "2": 5, x: 4, "0": 3, "3": -1 }), { "1": 5, "2": 5 });
  assert.deepEqual(mergePageTimes(null, { "4": 99999 }), { "4": 1800 });
  assert.deepEqual(mergePageTimes([], "hola"), {});
});

test("parsePageTimes completa las páginas sin tiempo", () => {
  assert.deepEqual(parsePageTimes({ "2": 4.26 }, 3), [
    { page: 1, seconds: 0 },
    { page: 2, seconds: 4.3 },
    { page: 3, seconds: 0 },
  ]);
  assert.deepEqual(parsePageTimes({}, null), []);
});

const view = (id: string, at: string, sec: number, link: Partial<ViewLike["link"]>, viewerEmail: string | null = null): ViewLike => ({
  id,
  startedAt: new Date(at),
  durationSec: sec,
  pageTimes: {},
  downloaded: false,
  viewerEmail,
  link: { id: "l1", label: null, contactId: null, contact: null, ...link },
});

test("groupVisitors agrupa por contacto, correo o enlace", () => {
  const ana = { id: "c1", firstName: "Ana", lastName: "Pérez", company: { name: "Holcim", website: "holcim.com" } };
  const visitors = groupVisitors([
    view("v1", "2026-10-01T10:00:00Z", 30, { id: "l1", contactId: "c1", contact: ana }),
    view("v2", "2026-10-03T10:00:00Z", 45, { id: "l2", contactId: "c1", contact: ana }),
    view("v3", "2026-10-02T10:00:00Z", 10, { id: "l3", label: "Grupo WhatsApp" }),
    view("v4", "2026-10-04T10:00:00Z", 5, { id: "l3", label: "Grupo WhatsApp" }, "Luis@Tonicorp.com"),
  ]);
  assert.equal(visitors.length, 3);
  assert.deepEqual(
    visitors.map((v) => [v.name, v.visits, v.totalSec]),
    [
      ["Luis@Tonicorp.com", 1, 5],
      ["Ana Pérez", 2, 75],
      ["Enlace «Grupo WhatsApp»", 1, 10],
    ],
  );
  assert.equal(visitors[1].company?.name, "Holcim");
});

test("formatDuration y randomToken", () => {
  assert.equal(formatDuration(45), "45 s");
  assert.equal(formatDuration(125), "2 min 05 s");
  assert.equal(formatDuration(3720), "1 h 02 min");
  const t = randomToken();
  assert.match(t, /^[A-Za-z0-9_-]{24}$/);
  assert.notEqual(t, randomToken());
});
