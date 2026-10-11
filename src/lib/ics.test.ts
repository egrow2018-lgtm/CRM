import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs, parseEmails } from "./ics";

test("invitación .ics con asistentes y texto escapado", () => {
  const ics = buildIcs({
    uid: "abc@egrow-crm",
    start: new Date("2026-10-15T15:00:00Z"),
    durationMinutes: 45,
    summary: "Demo Rutalink, flota; GPS",
    description: "Agenda:\n1. Demo",
    location: "Av. Amazonas, Quito",
    organizer: { name: "María Isabel", email: "mipineiros@e-growonline.com" },
    attendees: ["cliente@acme.com"],
    method: "REQUEST",
  });
  // Las líneas largas se parten en varias; para comparar se vuelven a unir
  const flat = ics.replace(/\r\n /g, "");
  assert.ok(flat.includes("DTSTART:20261015T150000Z") && flat.includes("DTEND:20261015T154500Z"));
  assert.ok(flat.includes("SUMMARY:Demo Rutalink\\, flota\; GPS"));
  assert.ok(flat.includes("DESCRIPTION:Agenda:\\n1. Demo"));
  assert.ok(flat.includes("ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:cliente@acme.com"));
  assert.ok(ics.split("\r\n").every((l) => l.length <= 75));
});

test("lista de correos", () => {
  assert.deepEqual(parseEmails("A@x.com, b@y.ec; a@x.com\nmalo"), { emails: ["a@x.com", "b@y.ec"], invalid: ["malo"] });
});
