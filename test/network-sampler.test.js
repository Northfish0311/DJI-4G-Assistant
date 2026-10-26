const test = require("node:test");
const assert = require("node:assert/strict");
const {createNetworkSampler, mergeFastSample} = require("../web/network-sampler");
const item = {interfaceId: "{1234-ABCD}", description: "Quectel ECM Adapter", status: "Up", ipv4: "192.168.225.21", gateway: "192.168.225.1", driverReady: true, receivedBytes: 100, sentBytes: 50};
const fast = {...item, interfaceId: "1234-abcd", ipv4Addresses: [item.ipv4], receivedBytes: 300, sentBytes: 100, statisticsReliable: true, sampledAt: 1000};
const result = items => ({ok: true, stdout: JSON.stringify(items)});

test("quick samples keep driver details but use only new byte counters", () => {
  const merged = JSON.parse(mergeFastSample(result([item]), result([fast])).stdout)[0];
  assert.equal(merged.gateway, item.gateway);
  assert.equal(merged.driverReady, true);
  assert.equal(merged.receivedBytes, 300);
  assert.equal(merged.sampledAt, 1000);
});

test("changed interface, address, status, duplicates, or missing adapter require full discovery", () => {
  for (const changed of [[], [fast, fast], [{...fast, interfaceId: "another"}], [{...fast, ipv4Addresses: ["10.0.0.2"]}], [{...fast, status: "Down"}], [{...fast, description: "Other"}]]) {
    assert.equal(mergeFastSample(result([item]), result(changed)), null);
  }
});

test("sampler refreshes metadata on expiry and explicit invalidation", async () => {
  let now = 0, full = 0, quick = 0;
  const sampler = createNetworkSampler({now: () => now, refreshMs: 60,
    readFull: async () => {full++; return result([item]);},
    readFast: async () => {quick++; return result([fast]);}});
  await sampler.sample();
  now = 20;
  await sampler.sample();
  now = 60;
  await sampler.sample();
  sampler.invalidate();
  await sampler.sample();
  assert.equal(full, 3);
  assert.equal(quick, 1);
});

test("failed or malformed quick reads never return old counters as fresh", async () => {
  for (const failed of [{ok: false, stderr: "unavailable"}, {ok: true, stdout: "bad JSON"}]) {
    let fullReads = 0;
    const sampler = createNetworkSampler({readFull: async () => ++fullReads === 1 ? result([item]) : {ok: false}, readFast: async () => failed});
    await sampler.sample();
    assert.equal((await sampler.sample()).ok, false);
    assert.equal(fullReads, 2);
  }
});

test("older adapters without quick counters still use fresh full reads", async () => {
  let fullReads = 0;
  const sampler = createNetworkSampler({readFull: async () => result([{...item, receivedBytes: ++fullReads * 100}]), readFast: async () => ({ok: false})});
  await sampler.sample();
  assert.equal(JSON.parse((await sampler.sample()).stdout)[0].receivedBytes, 200);
});

test("manual refresh waits for an existing sample then reads all details again", async () => {
  let finish, fullReads = 0;
  const sampler = createNetworkSampler({readFull: async () => {fullReads++; return result([item]);}, readFast: () => new Promise(resolve => {finish = resolve;})});
  await sampler.sample();
  const fastRead = sampler.sample();
  const manualRead = sampler.sample({refreshDetails: true});
  finish(result([fast]));
  await fastRead;
  await manualRead;
  assert.equal(fullReads, 2);
});

test("driver changes invalidate a discovery already in progress", async () => {
  let finish, reads = 0;
  const sampler = createNetworkSampler({readFull: () => {reads++; return new Promise(resolve => {finish = resolve;});}, readFast: async () => result([fast])});
  const before = sampler.sample();
  sampler.invalidate();
  finish(result([item]));
  await before;
  const after = sampler.sample();
  finish(result([item]));
  await after;
  assert.equal(reads, 2);
});

test("unplug and replug perform full discovery without leaking the previous adapter", async () => {
  let connected = true, reads = 0;
  const sampler = createNetworkSampler({readFull: async () => {reads++; return result(connected ? [item] : []);}, readFast: async () => result(connected ? [fast] : [])});
  await sampler.sample();
  connected = false;
  assert.deepEqual(JSON.parse((await sampler.sample()).stdout), []);
  connected = true;
  assert.equal(JSON.parse((await sampler.sample()).stdout)[0].interfaceId, item.interfaceId);
  assert.equal(reads, 3);
});

test("overlapping browser polls share one read and recover after rejection", async () => {
  let finish, reads = 0;
  const sampler = createNetworkSampler({readFull: () => {reads++; return new Promise(resolve => {finish = resolve;});}, readFast: async () => {throw new Error("offline");}});
  const a = sampler.sample(), b = sampler.sample();
  assert.equal(a, b);
  finish(result([item]));
  await a;
  await assert.rejects(sampler.sample(), /offline/);
  sampler.invalidate();
  const c = sampler.sample();
  finish(result([item]));
  await c;
  assert.equal(reads, 2);
});

test("manual refreshes reuse a full discovery already running", async () => {
  let finish, reads = 0;
  const sampler = createNetworkSampler({readFull: () => {reads++; return new Promise(resolve => {finish = resolve;});}, readFast: async () => result([fast])});
  const a = sampler.sample();
  const b = sampler.sample({refreshDetails: true});
  const c = sampler.sample({refreshDetails: true});
  assert.equal(a, b); assert.equal(b, c);
  finish(result([item]));
  await Promise.all([a, b, c]);
  assert.equal(reads, 1);
});

test("many manual refreshes behind a quick sample schedule only one full read", async () => {
  let finish, reads = 0;
  const sampler = createNetworkSampler({readFull: async () => {reads++; return result([item]);}, readFast: () => new Promise(resolve => {finish = resolve;})});
  await sampler.sample();
  const background = sampler.sample();
  const manual = Array.from({length: 5}, () => sampler.sample({refreshDetails: true}));
  assert.ok(manual.every(promise => promise === manual[0]));
  finish(result([fast]));
  await Promise.all([background, ...manual]);
  assert.equal(reads, 2);
});

test("a manual refresh queued behind a rejected quick sample can still recover", async () => {
  let reject, reads = 0;
  const sampler = createNetworkSampler({readFull: async () => {reads++; return result([item]);}, readFast: () => new Promise((resolve, fail) => {reject = fail;})});
  await sampler.sample();
  const background = sampler.sample();
  const failed = assert.rejects(background, /offline/);
  const manual = sampler.sample({refreshDetails: true});
  reject(new Error("offline"));
  await failed;
  assert.equal((await manual).ok, true);
  assert.equal(reads, 2);
});

test("manual refresh after invalidation never reuses pre-change full discovery", async () => {
  let finish, reads = 0;
  const sampler = createNetworkSampler({readFull: () => {reads++; return new Promise(resolve => {finish = resolve;});}, readFast: async () => result([fast])});
  const old = sampler.sample();
  sampler.invalidate();
  const fresh = sampler.sample({refreshDetails: true});
  finish(result([item]));
  await old;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads, 2);
  finish(result([{...item, ipv4: "10.0.0.2"}]));
  assert.equal(JSON.parse((await fresh).stdout)[0].ipv4, "10.0.0.2");
});
