const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../web/public/app.js"), "utf8");

function harness() {
  const state = {busy: false, cardEpoch: 1, atPort: "COM5", activeAid: "aid-one", activeEid: "eid-one", euiccInventory: [{eid: "eid-one", profiles: [{iccid: "test"}]}], failedViews: new Set(), autoLoadedViews: new Set()};
  const rendered = [], feedback = [], busy = [], requests = [];
  const context = vm.createContext({
    state, AbortController, setTimeout, clearTimeout, portInput: {value: "COM5"},
    document: {querySelector: () => ({id: "euicc"}), hidden: false},
    t: key => key, actionTitle: key => key, apiHeaders: () => ({}),
    textFromResult: data => data.stdout || data.stderr || "",
    parseLpaData: text => {try {return JSON.parse(text);} catch {return null;}},
    fetch: async url => {requests.push(url);return {ok: true, status: 200, json: async () => ({ok: false, stderr: "Read failed"})};},
    append() {}, updateSummary() {}, updateTemperature() {}, applyHealth() {},
    showFeedback: (...args) => feedback.push(args),
    setBusy: value => {state.busy = value;busy.push(value);},
    renderSmsRefreshState() {}, noteTrafficReadFailure() {},
  });
  for (const name of ["renderProfiles", "renderEuiccInventory", "renderChip", "renderDiscovery", "renderNotifications", "renderSms", "renderCallStatus", "renderCallCapabilities", "renderTraffic"]) context[name] = (...args) => {rendered.push({name, args});return true;};
  vm.runInContext(source.slice(source.indexOf("async function fetchJson("), source.indexOf("function applyHealth(")) + source.slice(source.indexOf("async function callApi("), source.indexOf("async function quickStart()")), context);
  return {context, state, rendered, feedback, busy, requests};
}

test("HTTP errors are rejected even if a proxy returns an ok:true body", async () => {
  const ui = harness();
  ui.context.fetch = async () => ({ok: false, status: 503, json: async () => ({ok: true})});
  await assert.rejects(ui.context.fetchJson("/api/health"), error => error.status === 503);
});

test("failed and malformed profile reads never replace the last valid list", async () => {
  for (const reply of [{ok: false, stderr: "Read failed"}, {ok: true, stdout: "incomplete reply"}]) {
    const ui = harness();ui.context.fetch = async () => ({ok: true, status: 200, json: async () => reply});
    assert.equal(await ui.context.callApi("lpac-profiles"), false);
    assert.equal(ui.rendered.length, 0);
    assert.equal(ui.state.euiccInventory[0].profiles[0].iccid, "test");
    assert.equal(ui.state.failedViews.has("euicc"), true);
  }
});

test("a confirmed empty profile list remains a valid successful read", async () => {
  const ui = harness();ui.context.fetch = async () => ({ok: true, status: 200, json: async () => ({ok: true, stdout: "[]"})});
  assert.equal(await ui.context.callApi("lpac-profiles"), true);
  assert.equal(ui.rendered[0].name, "renderProfiles");
});

test("delayed responses from another EID or card are ignored", async () => {
  for (const change of [state => {state.activeEid = "eid-two";}, state => {state.cardEpoch++;}]) {
    const ui = harness();let finish;
    ui.context.fetch = async () => new Promise(resolve => {finish = () => resolve({ok: true, status: 200, json: async () => ({ok: true, stdout: "[]"})});});
    const result = ui.context.callApi("lpac-profiles");change(ui.state);finish();
    assert.equal(await result, false);
    assert.equal(ui.rendered.length, 0);
    assert.equal(ui.feedback.length, 0);
  }
});

test("an unreadable inventory preserves previous cards but an ordinary SIM is not an exception", async () => {
  const reply = {ok: false, eids: [], probes: [], discoveryScope: "known-aids", warning: "No accessible eUICC EID was found."};
  const ui = harness();ui.context.fetch = async () => ({ok: true, status: 200, json: async () => reply});
  assert.equal(await ui.context.callApi("euicc-inventory"), false);
  assert.equal(ui.rendered.length, 0);
  ui.state.euiccInventory = [];
  assert.equal(await ui.context.callApi("euicc-inventory"), true);
  assert.equal(ui.rendered[0].name, "renderEuiccInventory");
});

test("a nested refresh leaves its parent operation busy", async () => {
  const ui = harness();ui.state.busy = true;
  assert.equal(await ui.context.callApi("lpac-profiles", {manageBusy: false}), false);
  assert.equal(ui.state.busy, true);
  assert.deepEqual(ui.busy, []);
});

test("automatic scanning does not turn a failed SMS read into an empty inbox", async () => {
  const ui = harness();await ui.context.autoScan();
  assert.equal(ui.rendered.some(item => item.name === "renderSms"), false);
  assert.equal(ui.state.smsReadError, true);
});

test("background SMS polling pauses during a voice call", async () => {
  const ui = harness();ui.state.started = true;ui.state.callStatusData = {voiceCalls: [{state: "active"}]};
  vm.runInContext(source.slice(source.indexOf("async function refreshSmsQuietly()"), source.indexOf("function renderConnectionState()")), ui.context);
  await ui.context.refreshSmsQuietly();assert.equal(ui.requests.length, 0);
});

test("a delayed HTTP failure from an old card does not mark the new card as failed", async () => {
  const ui = harness();let finish;
  ui.context.fetch = () => new Promise(resolve => {finish = () => resolve({ok: false, status: 503});});
  const result = ui.context.callApi("lpac-profiles");ui.state.cardEpoch++;finish();
  assert.equal(await result, false);
  assert.equal(ui.state.failedViews.size, 0);
  assert.equal(ui.feedback.length, 0);
});

test("an explicit no-port result removes a previously detected port", async () => {
  const ui = harness();ui.context.fetch = async () => ({ok: true, status: 200, json: async () => ({ok: false, port: "", error: "No AT port"})});
  await assert.rejects(ui.context.requestAction("find-at"), /No AT port/);
  assert.equal(ui.state.atPort, "");
  assert.equal(ui.context.portInput.value, "");
});
