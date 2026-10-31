const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../web/server.js"), "utf8");
function fixture() {
  const requests = [];
  let now = 0;
  const context = {
    Date: { now: () => now },
    readVoicePnpStatus: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("const VOICE_PNP_CACHE_MS ="), source.indexOf("async function readVoicePnpStatus(")), context);
  return { ...context, requests, advance: (ms) => { now += ms; } };
}

test("an invalidated late device query cannot overwrite the refreshed cache", async () => {
  const f = fixture();
  const old = f.voicePnpStatus();
  f.invalidateVoicePnp();
  const fresh = f.voicePnpStatus();
  f.requests[1].resolve({ device: "new" });
  await fresh;
  f.requests[0].resolve({ device: "old" });
  await old;
  assert.equal((await f.voicePnpStatus()).device, "new");
  assert.equal(f.requests.length, 2);
});

test("an old query finishing cannot clear the new shared pending query", async () => {
  const f = fixture();
  const old = f.voicePnpStatus();
  f.invalidateVoicePnp();
  const fresh = f.voicePnpStatus();
  f.requests[0].resolve({ device: "old" });
  await old;
  const another = f.voicePnpStatus();
  assert.equal(f.requests.length, 2);
  f.requests[1].resolve({ device: "new" });
  assert.equal((await fresh).device, "new");
  assert.equal((await another).device, "new");
});

test("a rejected old query cannot clear an in-flight replacement", async () => {
  const f = fixture();
  const old = f.voicePnpStatus();
  const rejected = assert.rejects(old, /old failure/);
  f.invalidateVoicePnp();
  const fresh = f.voicePnpStatus();
  f.requests[0].reject(new Error("old failure"));
  await rejected;
  const another = f.voicePnpStatus();
  assert.equal(f.requests.length, 2);
  f.requests[1].resolve({ device: "new" });
  await fresh;
  assert.equal((await another).device, "new");
});

test("device reads still share work, expire, and retry after errors", async () => {
  const f = fixture();
  const first = f.voicePnpStatus(), shared = f.voicePnpStatus();
  assert.equal(f.requests.length, 1);
  f.requests[0].resolve({ device: "first" });
  await first; await shared;
  f.advance(7999);
  assert.equal((await f.voicePnpStatus()).device, "first");
  f.advance(1);
  const expired = f.voicePnpStatus();
  const rejected = assert.rejects(expired, /failed read/);
  f.requests[1].reject(new Error("failed read"));
  await rejected;
  const retry = f.voicePnpStatus();
  assert.equal(f.requests.length, 3);
  f.requests[2].resolve({ device: "recovered" });
  assert.equal((await retry).device, "recovered");
});

test("failed PowerShell cleanup blocks both serial and non-serial work across the host pool", async () => {
  let blocked = "";
  const waiting = [];
  const context = {
    powerShellHosts: [{ blockedReason: () => "" }, { blockedReason: () => blocked }],
    serialQueue: (task) => new Promise((resolve, reject) => waiting.push(() => Promise.resolve().then(task).then(resolve, reject))),
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("function enqueueSerial("), source.indexOf("function enqueueAt(")), context);
  vm.runInContext(source.slice(source.indexOf("function runPowerShell("), source.indexOf("function script(")), context);
  let executed = false;
  const queued = context.enqueueSerial(() => { executed = true; });
  blocked = "Restart required";
  const rejected = assert.rejects(queued, { code: "POWERSHELL_CLEANUP_FAILED" });
  await waiting.shift()();
  await rejected;
  assert.equal(executed, false);
  assert.equal((await context.runPowerShell(["-Command", "unused"])).ok, false);
});
