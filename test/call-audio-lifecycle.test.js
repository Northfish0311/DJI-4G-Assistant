const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../web/public/app.js"), "utf8");
const lifecycle = source.slice(source.indexOf("async function prepareLocalCallAudio()"), source.indexOf("function syncCallButtons()"));

function fixture(options = {}) {
  const state = { cardEpoch: 1, voiceRuntimeEnabled: true, callCapabilityData: { ok: true, standardUsbAudio: true }, voiceRuntimeStatus: { runtime: { local: { downloaded: true }, prepared: false } }, callStatusData: { voiceCalls: [] } };
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

test("a SIM change cannot silently skip audio preparation because capability data was cleared", async () => {
  const f = fixture();
  f.state.callCapabilityData = null;
  let refreshes = 0;
  f.context.refreshVoiceSetup = async () => {
    refreshes++;
    f.state.callCapabilityData = { ok: true, standardUsbAudio: true };
  };
  await vm.runInContext("prepareLocalCallAudio()", f.context);
  assert.equal(refreshes, 1);
  assert.equal(f.requests.length, 1);
  assert.equal(f.state.voiceRuntimeStatus.runtime.prepared, true);
  f.state.callCapabilityData = null;
  f.context.refreshVoiceSetup = async () => null;
  await assert.rejects(vm.runInContext("prepareLocalCallAudio()", f.context), /callReadFailed/);
});

test("manual audio mode never prepares drivers, opens a microphone or arms automatic audio", async () => {
  const f = fixture({ refreshAudioDeviceOptions: async () => { throw new Error("Unexpected microphone access"); } });
  f.state.automaticCallAudioEnabled = false;
  f.state.callCapabilityData = null;
  await vm.runInContext("prepareLocalCallAudio()", f.context);
  vm.runInContext('armAutomaticCallAudio("dial")', f.context);
  assert.equal(f.requests.length, 0);
  assert.equal(f.state.automaticCallAudio, null);
  f.context.call = { id: 1, direction: "outgoing", state: "active" };
  await vm.runInContext("connectAutomaticCallAudio(call)", f.context);
  assert.equal(f.starts(), 0);
});

test("capability refresh is shared and a late old-card reply cannot repopulate the new card", async () => {
  const refreshSource = source.slice(source.indexOf("async function refreshVoiceSetup()"), source.indexOf("async function runVoiceSetupAction("));
  const replies = [], rendered = [];
  const state = { cardEpoch: 1, atPort: "COM5", voiceSetupBusy: false };
  const context = vm.createContext({ state, portInput: { value: "COM5" }, t: key => key,
    renderVoiceSetup() {}, append() {}, renderCallCapabilities: data => rendered.push(data),
    fetchJson: () => new Promise(resolve => replies.push(resolve)),
  });
  vm.runInContext(refreshSource, context);
  const first = vm.runInContext("refreshVoiceSetup()", context);
  const shared = vm.runInContext("refreshVoiceSetup()", context);
  assert.equal(replies.length, 1);
  state.cardEpoch = 2;
  const next = vm.runInContext("refreshVoiceSetup()", context);
  assert.equal(replies.length, 2);
  replies[0]({ ok: true, marker: "old" });
  await first;
  await shared;
  assert.equal(rendered.length, 0);
  assert.equal(state.voiceSetupBusy, true);
  replies[1]({ ok: true, marker: "new" });
  await next;
  assert.equal(rendered[0].marker, "new");
  assert.equal(state.voiceSetupBusy, false);
});

test("hidden windows still track existing calls and explicit refreshes, but pause idle polling", async () => {
  const refreshSource = source.slice(source.indexOf("async function refreshCallStatusQuietly("), source.indexOf("function toggleCallMonitoring("));
  const state = { cardEpoch: 1, callMonitoring: true, busy: false, callStatusData: { voiceCalls: [] } };
  let reads = 0, renders = 0;
  const context = vm.createContext({ state, document: { hidden: true }, Date,
    requestAction: async () => { reads++; return { data: { ok: true, voiceCalls: [] } }; },
    renderCallStatus() { renders++; }, syncCallButtons() {}, append() {}, t: key => key,
  });
  vm.runInContext(refreshSource, context);
  await vm.runInContext("refreshCallStatusQuietly()", context);
  assert.equal(reads, 0);
  state.callStatusData.voiceCalls = [{ id: 1, state: "active" }];
  state.callMonitoring = false;
  state.busy = true;
  await vm.runInContext("refreshCallStatusQuietly()", context);
  assert.equal(reads, 1);
  assert.equal(renders, 1);
  state.callStatusData.voiceCalls = [];
  await vm.runInContext("refreshCallStatusQuietly(true)", context);
  assert.equal(reads, 2);
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
  const streams = [], sinks = [], writes = [], captures = [];
  const elements = new Map([["#callMicrophoneSelect", { value: "headset-mic" }], ["#callSpeakerSelect", { value: "headset-output" }], ["#audioBridgeState", {}]]);
  const devices = [
    { kind: "audioinput", deviceId: "module-in", label: "AC Interface" },
    { kind: "audiooutput", deviceId: "module-out", label: "AC Interface" },
    { kind: "audioinput", deviceId: "headset-mic", label: "Headset Microphone" },
    { kind: "audiooutput", deviceId: "headset-output", label: "Headphones" },
  ];
  const context = vm.createContext({ state, localAudioBridgeHost: true, AbortSignal, setTimeout, portInput: { value: "COM5" },
    navigator: { mediaDevices: { enumerateDevices: async () => devices, getUserMedia: async (request) => {
      captures.push(request);
      const stream = { stopped: false, getTracks: () => [{ stop: () => { stream.stopped = true; } }] };
      streams.push(stream); return stream;
    } } },
    Audio: class { async setSinkId(id) { sinks.push(id); } async play() {} pause() {} },
    document: { querySelector: id => elements.get(id) },
    renderAudioDeviceOptions: list => ({ systemInputs: list.filter(device => device.kind === "audioinput" && !/AC Interface/.test(device.label)), systemOutputs: list.filter(device => device.kind === "audiooutput" && !/AC Interface/.test(device.label)) }),
    isModuleAudioDevice: device => /AC Interface/.test(device.label), t: key => key,
    syncCallButtons() {}, setCallFeedback() {}, append() {}, apiHeaders: value => value,
    fetch: async (url) => { writes.push(url); if (endDuringRoute && url.startsWith("/api/voice-route-start")) state.callStatusData.voiceCalls = []; return { ok: true, json: async () => ({ ok: true }) }; },
  });
  vm.runInContext(bridgeSource, context);
  return { state, streams, sinks, writes, captures, context, devices };
}

test("voice output targets the selected headphones and microphone targets only the module speaker", async () => {
  const f = audioFixture();
  assert.equal(await vm.runInContext("startAudioBridge()", f.context), true);
  assert.deepEqual(f.sinks, ["headset-output", "module-out"]);
  assert.equal(f.streams[0].stopped, false);
  assert.equal(f.captures[0].audio.deviceId.exact, "headset-mic");
  assert.equal(f.captures.length, 2);
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

test("USB audio is reacquired after route startup and never targets default-device aliases", async () => {
  const f = audioFixture();
  let reads = 0;
  f.context.navigator.mediaDevices.enumerateDevices = async () => {
    reads++;
    if (reads <= 2) return [f.devices[2], f.devices[3], { kind: "audioinput", deviceId: "default", label: "Default - AC Interface" }, { kind: "audiooutput", deviceId: "communications", label: "Communications - AC Interface" }];
    return f.devices.map(device => ({ ...device, deviceId: device.deviceId.startsWith("module-") ? "new-" + device.deviceId : device.deviceId }));
  };
  assert.equal(await vm.runInContext("startAudioBridge()", f.context), true);
  assert.equal(reads, 3);
  assert.equal(f.captures[1].audio.deviceId.exact, "new-module-in");
  assert.deepEqual(f.sinks, ["headset-output", "new-module-out"]);
  vm.runInContext("stopAudioBridge()", f.context);
});

test("permission capture never opens the default modem microphone or a default-output alias", async () => {
  const f = audioFixture();
  const alias = { kind: "audioinput", deviceId: "default", label: "Default - AC Interface", groupId: "modem" };
  f.devices.unshift(alias);
  assert.equal(await vm.runInContext("startAudioBridge()", f.context), true);
  assert.equal(f.captures[0].audio.deviceId.exact, "headset-mic");
  assert.equal(f.captures.every(request => request.audio !== true && !["default", "communications"].includes(request.audio.deviceId?.exact)), true);
  assert.equal(f.streams.length, 2);
  vm.runInContext("stopAudioBridge()", f.context);
  assert.equal(f.streams.every(stream => stream.stopped), true);
});

test("the modem route is enabled before Windows capture or device enumeration can block on idle UAC", async () => {
  const f = audioFixture();
  const enumerate = f.context.navigator.mediaDevices.enumerateDevices;
  const capture = f.context.navigator.mediaDevices.getUserMedia;
  f.context.navigator.mediaDevices.enumerateDevices = async () => {
    assert.equal(f.writes.some(url => url.startsWith("/api/voice-route-start")), true);
    return enumerate();
  };
  f.context.navigator.mediaDevices.getUserMedia = async request => {
    assert.equal(f.writes.some(url => url.startsWith("/api/voice-route-start")), true);
    return capture(request);
  };
  assert.equal(await vm.runInContext("startAudioBridge()", f.context), true);
  vm.runInContext("stopAudioBridge()", f.context);
});
