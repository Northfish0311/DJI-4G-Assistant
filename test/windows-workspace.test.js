const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../web/public/app.js"), "utf8");

function trafficHarness() {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {textContent: "", dataset: {}, classList: {contains: () => true}});
    return elements.get(selector);
  };
  let now = 100000;
  class TestDate extends Date { static now() { return now; } }
  const context = vm.createContext({
    Date: TestDate, Map, localStorage: {getItem: () => "en"}, navigator: {language: "en"},
    document: {hidden: false, querySelector: element},
    requestAction: async () => ({data: {ok: true, stdout: "[]"}}),
  });
  vm.runInContext([
    source.slice(source.indexOf("const copy ="), source.indexOf("function applyLanguage()")),
    source.slice(source.indexOf("function formatBytes("), source.indexOf("function smsStatus(")),
    source.slice(source.indexOf("async function refreshTrafficQuietly()"), source.indexOf("async function refreshModuleStatusQuietly()")),
  ].join("\n"), context);
  return {
    ...vm.runInContext("({state, renderTraffic, renderTrafficSyncState, noteTrafficReadFailure, refreshTrafficQuietly})", context),
    context, element, advance: value => {now += value;}, now: () => now,
  };
}

const sample = overrides => JSON.stringify({name: "USB LTE", description: "Quectel ECM Adapter", status: "Up", receivedBytes: 1000, sentBytes: 500, sampledAt: 10000, ...overrides});

test("malformed traffic does not clear the last valid adapter or counters", () => {
  const ui = trafficHarness();
  ui.renderTraffic(sample());
  ui.renderTraffic(sample({sampledAt: 12000, receivedBytes: 5096}));
  const previousText = ui.state.networkText;
  for (const invalid of ["", "not json", "[null]", '"bad sample"', "[[]]"]) {
    assert.equal(ui.renderTraffic(invalid), false);
    assert.equal(ui.state.networkText, previousText);
    assert.equal(ui.element("#trafficRxRate").textContent, "2.00 KB/s");
  }
});

test("a language rerender does not turn stale traffic into a fresh sample", () => {
  const ui = trafficHarness();
  ui.renderTraffic(sample());
  const lastRead = ui.state.trafficLastRead;
  ui.noteTrafficReadFailure();
  const retryAfter = ui.state.trafficRetryAfter;
  ui.advance(2000);
  ui.state.language = "zh";
  ui.renderTraffic(ui.state.networkText, false);
  assert.equal(ui.state.trafficLastRead, lastRead);
  assert.equal(ui.state.trafficRetryAfter, retryAfter);
  assert.equal(ui.state.trafficReadError, true);
  assert.equal(ui.element("#trafficSyncState").textContent, "刷新失败 · 保留上次采样");
});

test("traffic failures back off, preserve values and recover on a valid sample", async () => {
  const ui = trafficHarness();
  ui.state.started = true;
  ui.renderTraffic(sample());
  let calls = 0;
  ui.context.requestAction = async () => {calls++; return {data: {ok: false, stdout: "[]"}};};
  await ui.refreshTrafficQuietly();
  assert.equal(ui.element("#trafficAdapter").textContent, "Quectel ECM Adapter | Up");
  assert.equal(ui.state.trafficRetryAfter - ui.now(), 8000);
  await ui.refreshTrafficQuietly();
  assert.equal(calls, 1);
  for (const delay of [16000, 30000, 30000]) {
    ui.advance(30000);
    await ui.refreshTrafficQuietly();
    assert.equal(ui.state.trafficRetryAfter - ui.now(), delay);
  }
  ui.advance(30000);
  ui.context.requestAction = async () => ({data: {ok: true, stdout: sample({sampledAt: 12000, receivedBytes: 5096})}});
  await ui.refreshTrafficQuietly();
  assert.equal(ui.state.trafficReadError, false);
  assert.equal(ui.state.trafficFailureCount, 0);
  assert.equal(ui.state.trafficRetryAfter, 0);
  assert.equal(ui.element("#trafficRxRate").textContent, "2.00 KB/s");
});

test("traffic polling shares one read and pauses during confirmation or hidden pages", async () => {
  const ui = trafficHarness();
  ui.state.started = true;
  let resolve, calls = 0;
  ui.context.requestAction = () => {calls++; return new Promise(finish => {resolve = finish;});};
  const pending = ui.refreshTrafficQuietly();
  await ui.refreshTrafficQuietly();
  assert.equal(calls, 1);
  assert.equal(ui.element("#trafficSyncState").textContent, "Refreshing");
  resolve({data: {ok: true, stdout: sample()}});
  await pending;
  ui.state.confirming = true;
  await ui.refreshTrafficQuietly();
  ui.state.confirming = false; ui.context.document.hidden = true;
  await ui.refreshTrafficQuietly();
  assert.equal(calls, 1);
  assert.equal(ui.state.trafficRefreshInFlight, false);
});

test("rapid page switching cannot restore scroll for a page that is no longer active", () => {
  const frames = [], positions = [];
  let active = "sms";
  const context = vm.createContext({
    state: {viewScrollPositions: new Map([["sms", 420], ["network", 110]])},
    requestAnimationFrame: callback => frames.push(callback),
    document: {querySelector: () => ({id: active})},
    window: {scrollTo: (x, y) => positions.push([x, y])},
  });
  vm.runInContext(source.slice(source.indexOf("function restoreViewScroll("), source.indexOf('for (const button of document.querySelectorAll(".nav-btn")) button.addEventListener')), context);
  vm.runInContext('restoreViewScroll("sms"); restoreViewScroll("network");', context);
  active = "network";
  frames.forEach(callback => callback());
  assert.deepEqual(positions, [[0, 110]]);
});
