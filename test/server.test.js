const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSmsPdus } = require("../web/server");

test("encodes Chinese SMS in UCS2 PDU mode", () => {
  const [part] = buildSmsPdus("+447700900123", "\u6d4b\u8bd5\u77ed\u4fe1");
  assert.ok(part.pdu.startsWith("0001000C91"));
  assert.ok(part.pdu.endsWith("6D4B8BD577ED4FE1"));
  assert.equal(part.length, part.pdu.length / 2 - 1);
});

test("splits long UCS2 SMS with concatenation headers", () => {
  const parts = buildSmsPdus("+8613800138000", "\u6d4b".repeat(100));
  assert.equal(parts.length, 2);
  for (const [index, part] of parts.entries()) {
    assert.ok(part.pdu.startsWith("0041"));
    assert.ok(part.pdu.includes("050003"));
    assert.ok(part.pdu.includes(`02${String(index + 1).padStart(2, "0")}`));
    assert.equal(part.length, part.pdu.length / 2 - 1);
  }
});

test("supports domestic service numbers", () => {
  const parts = buildSmsPdus("10086", "\u72b6\u6001".repeat(30) + "OK");
  assert.equal(parts.length, 1);
  assert.ok(parts[0].pdu.startsWith("0001"));
});
