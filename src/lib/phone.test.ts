import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPhone, groupNational, parsePhone } from "./phone";

test("formato de teléfonos con código de país", () => {
  assert.equal(formatPhone("0995439203"), "+593 99 543 9203");
  assert.equal(formatPhone("+593 99 543 9206"), "+593 99 543 9206");
  assert.equal(formatPhone("593995439203"), "+593 99 543 9203");
  assert.equal(formatPhone("02 451 3888"), "+593 2 451 3888");
  assert.equal(formatPhone("+51 995 439 001"), "+51 99 543 9001");
  assert.equal(formatPhone("+57 300 123 4567"), "+57 300 123 4567");
  assert.equal(formatPhone("+1 (305) 555-0199"), "+1 305 555 0199");
  assert.equal(formatPhone("0034 612 345 678"), "+34 61 234 5678");
  assert.equal(formatPhone("+502 2470-8616"), "+502 2470 8616");
  assert.equal(formatPhone("ext 12"), "ext 12");
  assert.equal(formatPhone(""), "");
});

test("parsePhone detecta el país por el código más largo", () => {
  assert.deepEqual(parsePhone("+5939 9999 9999"), { iso: "EC", national: "999999999" });
  assert.deepEqual(parsePhone("+1 809 555 1234"), { iso: "DO", national: "5551234" });
  assert.equal(groupNational("24513888", "PA"), "2451 3888");
});
