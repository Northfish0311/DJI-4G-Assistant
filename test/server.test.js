const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const {
  buildSmsPdus,
  localIps,
  parseClcc,
  buildCallAction,
  normalizeIsdrAid,
  parseLpacData,
  mergeEuiccRecords,
  inventoryCandidateAids,
  sameUsbComposition,
  parseVoiceIdentity,
  parseSmsStorage,
  redactModemIdentifiers,
} = require("../web/server");

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


test("validates ISD-R AIDs without accepting shell input", () => {
  assert.equal(normalizeIsdrAid("a0000005591010ffffffff8900000100"), "A0000005591010FFFFFFFF8900000100");
  assert.equal(normalizeIsdrAid("A0000;SET"), null);
  assert.equal(normalizeIsdrAid("ABC"), null);
  assert.equal(normalizeIsdrAid("AA".repeat(17)), null);
});

test("parses the last successful lpac payload", () => {
  const output = [
    JSON.stringify({ type: "progress", payload: { step: 1 } }),
    JSON.stringify({ type: "lpa", payload: { code: 0, data: { eidValue: "ok" } } }),
  ].join("\r\n");
  assert.deepEqual(parseLpacData(output), { eidValue: "ok" });
});

test("discovers any number of unique EIDs and deduplicates alternate AIDs", () => {
  const eid = (value) => `89${String(value).padStart(30, "0")}`;
  const aid = (value) => `A0000005591010FFFFFFFF890000${String(value).padStart(4, "0")}`;
  const records = [
    { eid: eid(1), aid: aid(100), profiles: [{ profileState: "enabled" }], freeMemory: 1000 },
    { eid: eid(2), aid: aid(200), profiles: [], freeMemory: 2000 },
    { eid: eid(3), aid: aid(300), profiles: [{ profileState: "disabled" }, { profileState: "enabled" }], freeMemory: 3000 },
    { eid: eid(1), aid: aid(101), profiles: [{ profileState: "enabled" }] },
  ];
  const result = mergeEuiccRecords(records, { [eid(1)]: "Long term" });
  assert.equal(result.length, 3);
  assert.equal(result[0].label, "Long term");
  assert.deepEqual(result[0].aids, [aid(100), aid(101)]);
  assert.equal(result[2].profileCount, 2);
  assert.equal(result[2].activeCount, 1);
});

test("keeps remembered private AIDs in automatic discovery candidates", () => {
  const privateAid = "A0000005591010FFFFFFFF8900000199";
  const candidates = inventoryCandidateAids({ aids: { local: privateAid }, labels: {} });
  assert.ok(candidates.includes(privateAid));
  assert.equal(new Set(candidates).size, candidates.length);
});


test("reports a full SMS storage without guessing", () => {
  const storage = parseSmsStorage('+CPMS: "MT",23,23,"MT",23,23,"MT",23,23');
  assert.deepEqual(storage, { used: 23, total: 23, percent: 100, full: true });
  assert.equal(parseSmsStorage("ERROR"), null);
});

test("compares every USB composition field", () => {
  const baseline = { vendorId: 0x2c7c, productId: 0x0125, flags: [1, 1, 1, 1, 1, 0, 0] };
  assert.equal(sameUsbComposition(baseline, { ...baseline, flags: [...baseline.flags] }), true);
  assert.equal(sameUsbComposition(baseline, { ...baseline, flags: [1, 1, 1, 1, 1, 1, 0] }), false);
});

test("accepts only the verified QDC507 voice identity", () => {
  const identity = parseVoiceIdentity([
    "Baiwang",
    "QDC507",
    "Revision: QDC507GLEFM21",
    "867530912345678",
  ].join("\r\n"));
  assert.equal(identity.model, "QDC507");
  assert.equal(identity.revision, "QDC507GLEFM21");
  assert.equal(identity.imei, "867530912345678");
  assert.throws(
    () => parseVoiceIdentity("EC25\r\nRevision: EC25EFAR06A01"),
    /verified QDC507/,
  );
});


test("returns the queued serial operation to API callers", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/server.js"), "utf8");
  assert.match(
    source,
    /function enqueueSerial\(task\)\s*\{\s*const queued = atQueue\.then\(task\);\s*atQueue = queued\.catch\(\(\) => \{\}\);\s*return queued;\s*\}/,
  );
});


test("redacts full modem identifiers from setup errors", () => {
  const redacted = redactModemIdentifiers({
    ok: false,
    stdout: "----- AT+CGSN -----\r\n867530912345678\r\nERROR\r\n",
    stderr: "device 867530912345678 failed",
  });
  assert.equal(redacted.stdout.includes("867530912345678"), false);
  assert.equal(redacted.stderr.includes("867530912345678"), false);
  assert.match(redacted.stdout, /\[redacted\]/);
});
