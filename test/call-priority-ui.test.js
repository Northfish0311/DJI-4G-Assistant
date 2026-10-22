const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { readAppSource } = require("./helpers/app-source");
const source = readAppSource();

function harness() {
  const elements = new Map();
  const state = {busy: true, atPort: "COM5", callActionsEnabled: true, cardReady: true, callStatusData: {ok: true, voiceCalls: [{state: "incoming"}]}};
  const requests = [], busyChanges = [];
  const context = vm.createContext({
    state, localAudioBridgeHost: false,
    document: {querySelector(id) {if (!elements.has(id)) elements.set(id, {value: "10086", options: []});return elements.get(id);}},
    renderCallGuidance() {}, parseDialInput: value => ({compact: value}),
    cancelPendingPostDial() {}, setCallFeedback() {}, t: key => key, append() {},
    prepareLocalCallAudio: async () => {}, armAutomaticCallAudio() {},
    portInput: {value: "COM5"}, apiHeaders: value => value, AbortSignal,
    setTimeout: fn => {fn();}, refreshCallStatusQuietly: async () => {},
    setBusy: value => {state.busy = value;busyChanges.push(value);},
    textFromResult: () => "OK", fetch: async (url, options) => {
      requests.push(JSON.parse(options.body));return {ok: true, json: async () => ({ok: true})};
    },
  });
  vm.runInContext(source.slice(source.indexOf("function syncCallButtons()"), source.indexOf("function cancelPendingPostDial()")) + source.slice(source.indexOf("async function runCallAction("), source.indexOf("function updateProfileHint()")), context);
  return {context, state, elements, requests, busyChanges};
}

test("incoming calls can be answered or ended while a read is busy", () => {
  const ui = harness();ui.context.syncCallButtons();
  assert.equal(ui.elements.get("#answerCallBtn").disabled, false);
  assert.equal(ui.elements.get("#hangupCallBtn").disabled, false);
  assert.equal(ui.elements.get("#dialCallBtn").disabled, true);
  ui.state.callActionInFlight = true;ui.context.syncCallButtons();
  assert.equal(ui.elements.get("#answerCallBtn").disabled, true);
});

test("urgent actions do not release another operation's busy state", async () => {
  for (const action of ["answer", "hangup"]) {
    const ui = harness();await ui.context.runCallAction(action);
    assert.equal(ui.requests[0].action, action);
    assert.equal(ui.state.busy, true);
    assert.equal(ui.state.callActionInFlight, false);
    assert.deepEqual(ui.busyChanges, []);
  }
  const ui = harness();await ui.context.runCallAction("dial");
  assert.equal(ui.requests.length, 0);
});
