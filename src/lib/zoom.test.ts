import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ZOOM_ACCOUNT_ID = "acc";
process.env.ZOOM_CLIENT_ID = "cid";
process.env.ZOOM_CLIENT_SECRET = "secret";
process.env.ZOOM_DEFAULT_HOST = "zoom@e-growonline.com";

const calls: { url: string; init?: RequestInit }[] = [];
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  calls.push({ url, init });
  if (url.includes("/oauth/token")) return Response.json({ access_token: "tok", expires_in: 3600 });
  if (url.includes("/users/janine%40e-growonline.com/meetings")) return Response.json({ code: 1001, message: "User does not exist" }, { status: 404 });
  if (url.includes("/meetings")) return Response.json({ id: 987654321, join_url: "https://zoom.us/j/987654321", start_url: "https://zoom.us/s/987654321", password: "abc" });
  return new Response("not found", { status: 404 });
}) as typeof fetch;

const load = () => import("./zoom");

test("crea la reunión con token, hora local de Ecuador y anfitrión", async () => {
  const { createZoomMeeting } = await load();
  const m = await createZoomMeeting({ hostEmail: "apoveda@e-growonline.com", topic: "Demo Ludus", start: new Date("2026-10-20T15:30:00Z"), durationMinutes: 45 });
  assert.equal(m.joinUrl, "https://zoom.us/j/987654321");
  assert.equal(m.host, "apoveda@e-growonline.com");
  const token = calls.find((c) => c.url.includes("/oauth/token"))!;
  assert.match(String((token.init!.headers as Record<string, string>).Authorization), /^Basic /);
  const meeting = calls.find((c) => c.url.includes("/users/apoveda%40e-growonline.com/meetings"))!;
  const body = JSON.parse(String(meeting.init!.body));
  assert.equal(body.start_time, "2026-10-20T10:30:00");
  assert.equal(body.timezone, "America/Guayaquil");
  assert.equal(body.duration, 45);
});

test("si la persona no tiene cuenta de Zoom, usa ZOOM_DEFAULT_HOST", async () => {
  const { createZoomMeeting } = await load();
  const m = await createZoomMeeting({ hostEmail: "janine@e-growonline.com", topic: "Kickoff", start: new Date("2026-10-21T14:00:00Z"), durationMinutes: 30 });
  assert.equal(m.host, "zoom@e-growonline.com");
});
