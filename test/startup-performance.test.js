const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const automation = fs.readFileSync(path.join(__dirname, "../web/public/automation.js"), "utf8");
const sms = fs.readFileSync(path.join(__dirname, "../web/public/sms.js"), "utf8");

function startup({legacy = false} = {}) {
  const state = {busy: false, connecting: false, atPort: "", cardEpoch: 0, autoLoadedViews: new Set(), failedViews: new Set()};
  const actions = [], feedback = [], rendered = [];
  const view = {id: "overview"};
  const card = {ok: true, ready: true, signature: "test-card"};
  const context = vm.createContext({
    state, document: {querySelector: () => view},
    requestAction: async (action, options) => {
      actions.push(action);
      if (action === "find-at") state.atPort = "COM5";
      if (["euicc-inventory", "network-traffic"].includes(action)) throw new Error("Expensive startup read");
      if (action === "module-status") assert.equal(options.startup, true);
      return {data: {ok: true, ...(action === "module-status" && !legacy ? {card} : {})}, text: action};
    },
    fetchJson: async url => {actions.push(url); return {ok: true, ready: true, signature: "test-card"};},
    setBusy: busy => {state.busy = busy;},
    showFeedback: (...value) => feedback.push(value),
    t: key => key, actionTitle: key => key,
    append() {}, updateSummary() {}, updateTemperature() {}, applyHealth() {}, clearCardView() {}, refreshVoiceSetup() {},
    renderSmsRefreshState() {}, callApi: action => {rendered.push(action);},
  });
  vm.runInContext(automation.slice(automation.indexOf("async function quickStart()"), automation.indexOf("async function monitorCard()")), context);
  vm.runInContext(sms.slice(sms.indexOf("function ensureCurrentViewLoaded()"), sms.indexOf("function renderSmsNewMessages()")), context);
  return {state, actions, feedback, rendered, view, context, card};
}

test("startup unlocks after basic identification without waiting for eSIM or adapter discovery", async () => {
  const ui = startup();
  await ui.context.quickStart();
  assert.deepEqual(ui.actions, ["health", "ports", "find-at", "module-status"]);
  assert.equal(ui.state.busy, false);
  assert.equal(ui.state.connecting, false);
  assert.equal(ui.state.cardSignature, "test-card");
  assert.equal(ui.state.autoLoadedViews.has("euicc"), false);
  assert.equal(ui.feedback.at(-1)[0], "deviceConnected");
});

test("each expensive view loads once on first visit and is not preloaded by overview", async () => {
  const ui = startup();
  await ui.context.quickStart();
  ui.state.started = true;
  ui.context.ensureCurrentViewLoaded();
  assert.deepEqual(ui.rendered, []);
  for (const id of ["euicc", "network", "sms"]) {
    ui.view.id = id;
    ui.context.ensureCurrentViewLoaded();
    ui.context.ensureCurrentViewLoaded();
  }
  assert.deepEqual(ui.rendered, ["euicc-inventory", "network-traffic", "sms-list"]);
});

test("deep-linked eSIM view still loads after startup and waits for the busy guard", async () => {
  const ui = startup();
  ui.view.id = "euicc";
  ui.state.started = true;
  ui.state.busy = true;
  ui.context.ensureCurrentViewLoaded();
  assert.deepEqual(ui.rendered, []);
  ui.state.busy = false;
  await ui.context.quickStart();
  ui.context.ensureCurrentViewLoaded();
  assert.deepEqual(ui.rendered, ["euicc-inventory"]);
});

test("missing SIM is not presented as a successful connection", async () => {
  const ui = startup();
  Object.assign(ui.card, {ready: false, signature: null});
  await ui.context.quickStart();
  assert.equal(ui.state.cardReady, false);
  assert.equal(ui.feedback.at(-1)[0], "cardRemoved");
  assert.equal(ui.state.busy, false);
});

test("failed card status does not report success or leave startup locked", async () => {
  const ui = startup();
  Object.assign(ui.card, {ok: false, error: "offline"});
  await ui.context.quickStart();
  assert.equal(ui.feedback.at(-1)[1], "error");
  assert.equal(ui.state.busy, false);
  assert.equal(ui.state.connecting, false);
});

test("failed eSIM discovery stays retryable rather than looping or blocking other views", async () => {
  const ui = startup();
  await ui.context.quickStart();
  ui.state.started = true;
  ui.state.failedViews.add("euicc");
  ui.view.id = "euicc";
  ui.context.ensureCurrentViewLoaded();
  assert.deepEqual(ui.rendered, []);
  ui.view.id = "sms";
  ui.context.ensureCurrentViewLoaded();
  assert.deepEqual(ui.rendered, ["sms-list"]);
});

test("an older server without combined SIM status keeps the separate read fallback", async () => {
  const ui = startup({legacy: true});
  await ui.context.quickStart();
  assert.deepEqual(ui.actions, ["health", "ports", "find-at", "module-status", "/api/card-status?port=COM5"]);
  assert.equal(ui.state.cardReady, true);
  assert.equal(ui.state.cardSignature, "test-card");
});
