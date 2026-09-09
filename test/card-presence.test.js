const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash } = require("node:crypto");
const source = fs.readFileSync(path.join(__dirname, "../web/server.js"), "utf8");
const context = vm.createContext({ createHash });
vm.runInContext(source.slice(source.indexOf("function parseCardPresence("), source.indexOf("function inventoryCandidateAids(")), context);

test("card monitoring returns a stable fingerprint without the full ICCID", () => {
  const first = context.parseCardPresence({ ok: true, stdout: "+CPIN: READY\n+QCCID: 8900000000000000001" });
  const next = context.parseCardPresence({ ok: true, stdout: "+CPIN: READY\n+QCCID: 8900000000000000002" });
  assert.equal(first.ready, true);
  assert.match(first.signature, /^[a-f0-9]{64}$/);
  assert.notEqual(first.signature, next.signature);
  assert.ok(!JSON.stringify(first).includes("8900000000000000001"));
});

test("an unsupported ICCID query does not pretend the SIM was removed", () => {
  const result = context.parseCardPresence({ ok: true, stdout: "+CPIN: READY\nERROR" });
  assert.equal(result.ready, true);
  assert.equal(result.signature, null);
});

test("a missing SIM and a serial error remain distinct", () => {
  assert.equal(context.parseCardPresence({ ok: true, stdout: "+CME ERROR: SIM not inserted" }).ready, false);
  assert.equal(context.parseCardPresence({ ok: false, stdout: "" }).ok, false);
});
