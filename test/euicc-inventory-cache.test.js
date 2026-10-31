const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createEuiccInventoryCache } = require("../web/euicc-inventory-cache");

const context = { lpac: "lpac", portName: "COM3" };
const inventory = (name = "card-A", complete = true) => ({ ok: true, profilesComplete: complete, eids: [{ eid: name, aid: "route", profiles: [] }] });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const f = { card: "card-A", reads: 0, scans: 0, remembered: [], time: 0 };
  f.identity = async () => f.card;
  f.scan = async () => inventory(f.card);
  f.cache = createEuiccInventoryCache({
    readIdentity: async c => { f.reads++; return f.identity(c); },
    scan: async c => { f.scans++; return f.scan(c); },
    remember: (c, result) => f.remembered.push(result),
    now: () => f.time,
  });
  f.read = options => f.cache.read(context, options);
  return f;
}

test("a cache hit checks the live identity without repeating the full scan", async () => {
  const f = fixture();
  await f.read();
  assert.equal(f.reads, 2);
  await f.read();
  assert.equal(f.reads, 3);
  assert.equal(f.scans, 1);
});

test("a replacement on the same COM port cannot reuse the previous card", async () => {
  const f = fixture();
  await f.read();
  f.card = "card-B";
  assert.equal((await f.read()).eids[0].eid, "card-B");
  assert.equal(f.scans, 2);
});

test("a card removed or replaced during a scan cannot be returned or remembered", async () => {
  for (const replacement of [null, "card-B"]) {
    const f = fixture();
    f.scan = async () => { f.card = replacement; return inventory("card-A"); };
    await assert.rejects(f.read(), { code: "EUICC_INVENTORY_CHANGED" });
    assert.equal(f.remembered.length, 0);
  }
});

test("an eUICC without a readable active ICCID remains manageable but uncached", async () => {
  const f = fixture();
  f.card = null;
  f.scan = async () => inventory("unactivated-euicc");
  assert.equal((await f.read()).eids[0].eid, "unactivated-euicc");
  await f.read();
  assert.equal(f.scans, 2);
});

test("an unreadable identity never falls back to a previous cached card", async () => {
  const f = fixture();
  await f.read();
  f.card = null;
  f.scan = async () => ({ ok: false, eids: [] });
  assert.equal((await f.read()).ok, false);
  assert.equal(f.scans, 2);
});

test("identity query errors do not return stale data and the next request retries", async () => {
  const f = fixture();
  await f.read();
  f.identity = async () => { throw new Error("port unavailable"); };
  await assert.rejects(f.read(), /port unavailable/);
  f.identity = async () => f.card;
  await f.read();
  assert.equal(f.scans, 2);
});

test("an invalidated scan cannot overwrite a refreshed inventory or saved state", async () => {
  const f = fixture(), old = deferred();
  f.scan = () => old.promise;
  const original = f.read();
  const rejected = assert.rejects(original, { code: "EUICC_INVENTORY_CHANGED" });
  await tick();
  f.cache.invalidate();
  f.scan = async () => inventory("updated-profile-list");
  await f.read();
  old.resolve(inventory("outdated-profile-list"));
  await rejected;
  assert.deepEqual(f.remembered.map(r => r.eids[0].eid), ["updated-profile-list"]);
  assert.equal((await f.read()).eids[0].eid, "updated-profile-list");
});

test("an old request finishing cannot clear a newer in-flight scan", async () => {
  const f = fixture(), old = deferred(), fresh = deferred();
  f.scan = () => old.promise;
  const original = f.read();
  const rejected = assert.rejects(original, { code: "EUICC_INVENTORY_CHANGED" });
  await tick();
  f.cache.invalidate();
  f.scan = () => fresh.promise;
  const current = f.read();
  await tick();
  old.resolve(inventory("old"));
  await rejected;
  assert.equal(f.read(), current);
  assert.equal(f.scans, 2);
  fresh.resolve(inventory("new"));
  await current;
});

test("invalidation during the initial identity check prevents a stale scan from starting", async () => {
  const f = fixture(), identity = deferred();
  f.identity = () => identity.promise;
  const original = f.read();
  const rejected = assert.rejects(original, { code: "EUICC_INVENTORY_CHANGED" });
  f.cache.invalidate();
  identity.resolve("card-A");
  await rejected;
  assert.equal(f.scans, 0);
});

test("simultaneous readers share one scan and a failed scan remains retryable", async () => {
  const f = fixture(), pending = deferred();
  f.scan = () => pending.promise;
  const first = f.read(), second = f.read();
  assert.equal(first, second);
  const rejected = assert.rejects(first, /read failed/);
  await tick();
  pending.reject(new Error("read failed"));
  await rejected;
  f.scan = async () => inventory();
  await f.read();
  assert.equal(f.scans, 2);
});

test("incomplete and empty inventories are not cached as a complete list", async () => {
  for (const result of [inventory("partial", false), { ok: false, eids: [] }]) {
    const f = fixture();
    f.scan = async () => result;
    await f.read(); await f.read();
    assert.equal(f.scans, 2);
  }
});

test("TTL expiry and explicit refresh repeat the scan", async () => {
  const f = fixture();
  await f.read();
  f.time = 19999; await f.read();
  assert.equal(f.scans, 1);
  f.time = 20000; await f.read();
  assert.equal(f.scans, 2);
  await f.read({ force: true });
  assert.equal(f.scans, 3);
});

test("manual refresh supersedes an old read and repeated refreshes share the fresh read", async () => {
  const f = fixture(), old = deferred(), fresh = deferred();
  f.scan = () => old.promise;
  const original = f.read();
  const rejected = assert.rejects(original, { code: "EUICC_INVENTORY_CHANGED" });
  await tick();
  f.scan = () => fresh.promise;
  const current = f.read({ force: true });
  assert.equal(f.read({ force: true }), current);
  await tick();
  fresh.resolve(inventory("new")); await current;
  old.resolve(inventory("old")); await rejected;
  assert.equal((await f.read()).eids[0].eid, "new");
});

test("different ports and lpac executables cannot share cached results", async () => {
  const f = fixture();
  await f.read();
  await f.cache.read({ ...context, portName: "com3" });
  assert.equal(f.scans, 1);
  await f.cache.read({ ...context, portName: "COM4" });
  await f.cache.read({ ...context, lpac: "other-lpac", portName: "COM4" });
  assert.equal(f.scans, 3);
});

test("manual eSIM refresh is transmitted without changing ordinary page reads", async () => {
  const api = fs.readFileSync(path.join(__dirname, "../web/public/api.js"), "utf8");
  const urls = [];
  const ctx = vm.createContext({
    state: { cardEpoch: 1, activeAid: "", activeEid: "", euiccInventory: [] },
    portInput: { value: "COM3" },
    fetchJson: async url => { urls.push(url); return { ok: true, eids: [] }; },
    textFromResult: () => "", encodeURIComponent,
  });
  vm.runInContext(api.slice(api.indexOf("async function requestAction("), api.indexOf("function applyHealth(")), ctx);
  await ctx.requestAction("euicc-inventory");
  await ctx.requestAction("euicc-inventory", { refreshDetails: true });
  assert.deepEqual(urls, ["/api/euicc-inventory?port=COM3", "/api/euicc-inventory?port=COM3&refresh=1"]);
});
