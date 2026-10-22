const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../web/public/app.js"), "utf8");
const fragment = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));

function fixture() {
  const state = { atPort: "COM5", cardEpoch: 1, callActionsEnabled: true, callStatusData: null };
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value: "10086", dataset: {}, options: [], classList: {add() {}, remove() {} }});
    return elements.get(id);
  };
  const events = {stops: 0, starts: 0, ended: 0, dtmf: 0, history: []};
  const context = vm.createContext({state, Date, localAudioBridgeHost: true, nativeCompanion: false,
    document: {querySelector: element}, statusPill: element("pill"),
    t: key => key, callStateText: call => call.state, parseDialInput: value => value,
    rememberCall: call => events.history.push(call),
    stopAudioBridge: () => {events.stops++;state.audioBridge = null;state.audioBridgeStarting = false;},
    inspectEndedCall: () => events.ended++, connectAutomaticCallAudio: () => events.starts++,
    runPendingPostDial: () => events.dtmf++, cancelPendingPostDial() {}, setCallFeedback() {}, renderConnectionState() {}, renderCallNextStep() {},
  });
  vm.runInContext([
    fragment("function renderCallGuidance()", "function renderCallNextStep("),
    fragment("function syncCallButtons()", "function cancelPendingPostDial()"),
    fragment("function renderCallStatus(", "function renderCallCapabilities("),
  ].join("\n"), context);
  const render = data => context.renderCallStatus(data);
  const active = () => render({ok: true, activity: 4, voiceCalls: [{id: 1, direction: "outgoing", state: "active", number: "10086"}]});
  return {state, events, element, render, active};
}

test("empty CLCC preserves known audio, call controls and last number until idle is confirmed", () => {
  for (const activity of [null, undefined, 1, 2, 3, 4, 5]) {
    const f = fixture();f.active();f.state.audioBridge = {};
    f.render({ok: true, activity, voiceCalls: []});
    assert.equal(f.events.stops, 0);
    assert.equal(f.events.ended, 0);
    assert.equal(f.events.starts, 1);
    assert.equal(f.events.dtmf, 1);
    assert.equal(f.state.callStatusData.callStateUncertain, true);
    assert.equal(f.state.callStatusData.voiceCalls[0].statusPending, true);
    assert.equal(f.element("#hangupCallBtn").disabled, false);
    assert.equal(f.element(".call-primary-actions").hidden, false);
    assert.equal(f.element("#dialCallBtn").disabled, true);
    assert.equal(f.element("#sendDtmfBtn").disabled, true);
    assert.equal(f.element("#callNumber").textContent, "10086");
    assert.equal(f.element("#callStateLabel").textContent, "callChecking");
    // Language changes rerender cached data, which must remain pending.
    f.render(f.state.callStatusData);
    assert.equal(f.state.callStatusData.callStateUncertain, true);
    assert.equal(f.events.starts, 1);
    f.render({ok: true, activity: 0, voiceCalls: []});
    assert.equal(f.events.stops, 1);
    assert.equal(f.events.ended, 1);
    assert.equal(f.state.lastVoiceCall, null);
    assert.equal(f.element("#callStateLabel").textContent, "callIdle");
    f.render({ok: true, activity: 0, voiceCalls: []});
    assert.equal(f.events.ended, 1);
  }
});

test("CPAS activity without call history stays pending without inventing caller details", () => {
  for (const activity of [3, 4]) {
    const f = fixture();f.render({ok: true, activity, voiceCalls: []});
    assert.equal(f.state.callStatusData.voiceCalls.length, 0);
    assert.equal(f.state.callStatusData.callStateUncertain, true);
    assert.equal(f.element("#callNumber").textContent, "--");
    assert.equal(f.element("#hangupCallBtn").disabled, false);
    assert.equal(f.element(".call-primary-actions").hidden, false);
    assert.equal(f.element("#answerCallBtn").disabled, activity !== 3);
    assert.equal(f.events.starts, 0);
  }
});

test("a valid CLCC recovers pending state, while a failed read cannot end a call", () => {
  const f = fixture();f.active();f.state.audioBridgeStarting = true;
  f.render({ok: false, voiceCalls: [], activity: 0});
  assert.equal(f.events.stops, 0);
  assert.equal(f.state.lastVoiceCall.id, 1);
  f.render({ok: true, voiceCalls: [], activity: 4});
  f.active();
  assert.equal(f.state.callStatusData.callStateUncertain, false);
  assert.equal(f.state.callStatusReadError, false);
  assert.equal(f.element("#callStateLabel").textContent, "active");
  assert.equal(f.events.ended, 0);
});

test("idle legacy modules without CPAS still work when there is no existing call or route", () => {
  const f = fixture();f.render({ok: true, voiceCalls: []});
  assert.equal(f.state.callStatusData.callStateUncertain, false);
  assert.equal(f.element("#dialCallBtn").disabled, false);
  assert.equal(f.events.stops, 0);
});
