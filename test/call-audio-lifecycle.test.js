const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../web/public/app.js"), "utf8");
const lifecycle = source.slice(source.indexOf("async function prepareLocalCallAudio()"), source.indexOf("function syncCallButtons()"));

function fixture(options = {}) {
  const state = { cardEpoch: 1, voiceRuntimeEnabled: true, callCapabilityData: { standardUsbAudio: true }, voiceRuntimeStatus: { runtime: { local: { downloaded: true }, prepared: false } }, callStatusData: { voiceCalls: [] } };
  const feedback = [], requests = [];
  let starts = 0;
  const context = vm.createContext({ state, localAudioBridgeHost: true, AbortSignal,
    t: (key, params) => key + (params?.reason || ""), setCallFeedback: (...args) => feedback.push(args),
    refreshAudioDeviceOptions: async () => [], apiHeaders: value => value,
    fetch: async (url, request) => { requests.push({ url, request }); return { ok: true, json: async () => ({ ok: true, prepared: true }) }; },
    startAudioBridge: async () => { starts++; return true; },
    fetchJson: async () => ({ ok: true, voiceNetwork: { lastFailure: "0,25" } }),
    portInput: { value: "COM5" }, renderVoiceNetwork() {}, append() {}, textFromResult: () => "diagnostic",
    ...options,
  });
  vm.runInContext(lifecycle, context);
  return { context, state, feedback, requests, starts: () => starts };
}

test("prepares verified temporary voice drivers before local calls without changing USB or IMS", async () => {
  const f = fixture();
  await vm.runInContext("prepareLocalCallAudio()", f.context);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, "/api/voice-runtime-prepare");
  assert.equal(f.requests[0].request.method, "POST");
  assert.equal(JSON.parse(f.requests[0].request.body).confirm, "PREPAREVOICE");
  assert.equal(f.state.voiceRuntimeStatus.runtime.prepared, true);
  await vm.runInContext("prepareLocalCallAudio()", f.context);
  assert.equal(f.requests.length, 1);
});

test("failed preparation or a card change cannot become a ready call route", async () => {
  const failed = fixture({ fetch: async () => ({ ok: false, json: async () => ({ ok: false, error: "driver failed" }) }) });
  await assert.rejects(vm.runInContext("prepareLocalCallAudio()", failed.context), /driver failed/);
  assert.equal(failed.state.voiceRuntimeStatus.runtime.prepared, false);
  const changed = fixture();
  changed.context.refreshAudioDeviceOptions = async () => { changed.state.cardEpoch++; };
  await assert.rejects(vm.runInContext("prepareLocalCallAudio()", changed.context), /cardChangedRetry/);
  assert.equal(changed.requests.length, 0);
});

test("automatic audio is armed by a local dial or answer and starts only once when that call is active", async () => {
  const f = fixture();
  f.context.call = { id: 3, state: "active", direction: "outgoing" };
  await vm.runInContext("connectAutomaticCallAudio(call)", f.context);
  assert.equal(f.starts(), 0);
  vm.runInContext('armAutomaticCallAudio("dial")', f.context);
  f.context.call.state = "alerting";
  await vm.runInContext("connectAutomaticCallAudio(call)", f.context);
  assert.equal(f.starts(), 0);
  f.context.call.state = "active";
  await vm.runInContext("connectAutomaticCallAudio(call)", f.context);
  await vm.runInContext("connectAutomaticCallAudio(call)", f.context);
  assert.equal(f.starts(), 1);
});

test("remote clients, another call ID, another direction and changed cards do not open a microphone", async () => {
  const f = fixture();
  f.state.callStatusData.voiceCalls = [{ id: 2, direction: "incoming", state: "incoming" }];
  f.context.call = { id: 3, direction: "incoming", state: "active" };
  vm.runInContext('armAutomaticCallAudio("answer")', f.context);
  await vm.runInContext("connectAutomaticCallAudio(call)", f.context);
  f.context.call.id = 2; f.context.call.direction = "outgoing";
  await vm.runInContext("connectAutomaticCallAudio(call)", f.context);
  f.context.call.direction = "incoming"; f.state.cardEpoch++;
  await vm.runInContext("connectAutomaticCallAudio(call)", f.context);
  assert.equal(f.starts(), 0);
  f.context.localAudioBridgeHost = false;
  vm.runInContext('armAutomaticCallAudio("dial")', f.context);
  assert.equal(f.state.automaticCallAudio, null);
});

test("a late end-reason result cannot overwrite a new call or new card", async () => {
  let resolve;
  const f = fixture({ fetchJson: () => new Promise(done => { resolve = done; }) });
  const pending = vm.runInContext("inspectEndedCall()", f.context);
  f.state.callStatusData.voiceCalls = [{ id: 4, state: "active" }];
  resolve({ ok: true, voiceNetwork: { lastFailure: "0,25" } });
  await pending;
  assert.equal(f.feedback.length, 0);
});

test("call-end diagnostics are read-only and display the exact modem code without assigning blame", async () => {
  const f = fixture();
  await vm.runInContext("inspectEndedCall()", f.context);
  assert.equal(f.requests.length, 0);
  assert.equal(f.feedback[0][0], "callEndedReason0,25");
});

function audioFixture(endDuringRoute = false) {
  const bridgeSource = source.slice(source.indexOf("function stopStream(stream)"), source.indexOf("async function prepareLocalCallAudio()"));
  const state = { cardEpoch: 1, callStatusData: { voiceCalls: [{ id: 5, direction: "outgoing", state: "active" }] }, callCapabilityData: { standardUsbAudio: true }, voiceRuntimeStatus: { runtime: { local: { downloaded: true } } } };
  const streams = [], sinks = [], writes = [];
  const elements = new Map([["#callMicrophoneSelect", { value: "headset-mic" }], ["#callSpeakerSelect", { value: "headset-output" }], ["#audioBridgeState", {}]]);
  const devices = [
    { kind: "audioinput", deviceId: "module-in", label: "AC Interface" },
    { kind: "audiooutput", deviceId: "module-out", label: "AC Interface" },
    { kind: "audioinput", deviceId: "headset-mic", label: "Headset Microphone" },
    { kind: "audiooutput", deviceId: "headset-output", label: "Headphones" },
  ];
  const context = vm.createContext({ state, localAudioBridgeHost: true, portInput: { value: "COM5" },
    navigator: { mediaDevices: { enumerateDevices: async () => devices, getUserMedia: async () => {
      const stream = { stopped: false, getTracks: () => [{ stop: () => { stream.stopped = true; } }] };
      streams.push(stream); return stream;
    } } },
    Audio: class { async setSinkId(id) { sinks.push(id); } async play() {} pause() {} },
    document: { querySelector: id => elements.get(id) },
    renderAudioDeviceOptions: () => ({ systemInputs: [devices[2]], systemOutputs: [devices[3]] }),
    isModuleAudioDevice: device => device.label === "AC Interface", t: key => key,
    syncCallButtons() {}, setCallFeedback() {}, append() {}, apiHeaders: value => value,
    fetch: async (url) => { writes.push(url); if (endDuringRoute && url.startsWith("/api/voice-route-start")) state.callStatusData.voiceCalls = []; return { ok: true, json: async () => ({ ok: true }) }; },
  });
  vm.runInContext(bridgeSource, context);
  return { state, streams, sinks, writes, context };
}

test("voice output targets the selected headphones and microphone targets only the module speaker", async () => {
  const f = audioFixture();
  assert.equal(await vm.runInContext("startAudioBridge()", f.context), true);
  assert.deepEqual(f.sinks, ["headset-output", "module-out"]);
  assert.equal(f.streams[0].stopped, true);
  vm.runInContext("stopAudioBridge()", f.context);
  assert.equal(f.streams.every(stream => stream.stopped), true);
});

test("a call ending during audio setup releases the route without opening a stale microphone", async () => {
  const f = audioFixture(true);
  assert.equal(await vm.runInContext("startAudioBridge()", f.context), false);
  assert.equal(f.state.audioBridge, undefined);
  assert.equal(f.streams.every(stream => stream.stopped), true);
  assert.equal(f.sinks.length, 0);
  assert.equal(f.writes.includes("/api/voice-route-stop"), true);
});
