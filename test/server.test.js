const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { buildSmsPdus, localIps, parseClcc, buildCallAction } = require("../web/server");

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


test("does not mistake the QDC507 data session for a voice call", () => {
  const [call] = parseClcc('+CLCC: 1,1,0,1,0,"",128');
  assert.equal(call.state, "active");
  assert.equal(call.mode, 1);
  assert.equal(call.isVoice, false);
});

test("parses incoming and active voice calls", () => {
  const calls = parseClcc([
    '+CLCC: 2,1,4,0,0,"+447700900123",145',
    '+CLCC: 3,0,0,0,0,"10086",129',
  ].join("\r\n"));
  assert.deepEqual(calls.map((call) => [call.direction, call.state, call.isVoice]), [
    ["incoming", "incoming", true],
    ["outgoing", "active", true],
  ]);
});

test("builds guarded call commands and rejects AT injection", () => {
  assert.deepEqual(buildCallAction({ action: "dial", number: "+447700900123", confirm: "DIAL" }), {
    action: "dial",
    commands: ["ATD+447700900123;"],
  });
  assert.deepEqual(buildCallAction({ action: "dtmf", digits: "12#*", confirm: "DTMF" }), {
    action: "dtmf",
    commands: ['AT+VTS="1"', 'AT+VTS="2"', 'AT+VTS="#"', 'AT+VTS="*"'],
  });
  assert.equal(buildCallAction({ action: "dial", number: "10086;AT+CFUN=1", confirm: "DIAL" }), null);
  assert.equal(buildCallAction({ action: "hangup", confirm: "DIAL" }), null);
});

test("prefers a Wi-Fi console URL over the modem ECM subnet", () => {
  const original = os.networkInterfaces;
  os.networkInterfaces = () => ({
    "Ethernet 7": [{ family: "IPv4", internal: false, address: "192.168.225.23" }],
    WLAN: [{ family: "IPv4", internal: false, address: "192.168.50.20" }],
    "Ethernet 2": [{ family: "IPv4", internal: false, address: "169.254.12.9" }],
  });
  try {
    assert.deepEqual(localIps(), ["192.168.50.20", "192.168.225.23"]);
  } finally {
    os.networkInterfaces = original;
  }
});

test("matches PowerShell SMS responses with regex newline escapes", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/server.js"), "utf8");
  const responsePattern = "Read-Until '(\\\\r|\\\\n)(OK|ERROR)(\\\\r|\\\\n)'";
  assert.equal(source.split(responsePattern).length - 1, 2);
});
