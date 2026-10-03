const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseCallStatusResult, hasVoiceSession } = require("../web/server");
const { VoiceRuntimeManager, RUNTIME_KERNEL } = require("../web/voice-runtime");
const serverSource = fs.readFileSync(path.join(__dirname, "../web/server.js"), "utf8");
const statusHandler = serverSource.slice(serverSource.indexOf('  if (url.pathname === "/api/call-status")'), serverSource.indexOf('  if (url.pathname === "/api/call-end-reason")'));
const call = '+CLCC: 1,0,0,0,0,"10086",129\nOK\n';
const framed = response => "----- AT+CLCC -----\n" + response + "\n----- AT+CPAS -----\n+CPAS: 4\nOK\n----- AT+CLIP? -----\n+CLIP: 1,1\nOK\n";

test("a failed, timed-out or malformed CLCC read is not an empty successful call list", () => {
  for (const result of [
    { ok: false, stdout: call },
    { ok: true, stdout: framed("ERROR\n") },
    { ok: true, stdout: framed("AT+CLCC\n") },
    { ok: true, stdout: framed("+CME ERROR: 3\n") },
    { ok: true, stdout: framed("+CLCC: truncated\nOK\n") },
    { ok: true, stdout: "----- AT+CPAS -----\nOK\n" },
  ]) {
    assert.equal(parseCallStatusResult(result).ok, false);
    assert.equal(parseCallStatusResult(result).code, "CALL_STATUS_UNAVAILABLE");
  }
});

test("only the CLCC response determines call validity, not optional CPAS or CLIP", () => {
  const result = parseCallStatusResult({ ok: true, stdout: framed(call).replace("+CPAS: 4\nOK", "ERROR") });
  assert.equal(result.ok, true);
  assert.equal(hasVoiceSession(result), true);
  assert.equal(parseCallStatusResult({ ok: true, stdout: "OK\n" }).voiceCalls.length, 0);
  const data = parseCallStatusResult({ ok: true, stdout: "+CLCC: 2,1,0,1,0\nOK\n" });
  assert.equal(data.dataCalls.length, 1);
  assert.equal(hasVoiceSession(data), false);
});

async function runStatus(first, second = first) {
  const queued = [], commands = [];
  let stops = 0, reply;
  const context = vm.createContext({
    parseCallStatusResult, hasVoiceSession, portArg: () => "COM5", console,
    enqueueAt: async (_port, items) => { commands.push(items); return commands.length === 1 ? first : second; },
    enqueueVoice: task => { queued.push(task); return Promise.resolve(); },
    voiceRuntime: { routeActive: true, stopRoute: async () => { stops++; } },
    sendJson: (_res, _status, data) => { reply = data; },
  });
  await vm.runInContext("(async function(req,res,url){" + statusHandler + "})", context)({}, {}, { pathname: "/api/call-status" });
  for (const task of queued) await task();
  return { stops, reply, commands, queued: queued.length };
}

test("a transport failure or modem ERROR never closes an existing voice route", async () => {
  for (const result of [{ ok: false, stdout: "" }, { ok: true, stdout: framed("ERROR\n") }, { ok: true, stdout: framed("AT+CLCC\n") }]) {
    const outcome = await runStatus(result);
    assert.equal(outcome.reply.ok, false);
    assert.equal(outcome.stops, 0);
    assert.equal(outcome.queued, 0);
  }
});

test("queued route cleanup rechecks call state and does not close a newly arrived call", async () => {
  const idle = { ok: true, stdout: "OK\n" };
  for (const next of [{ ok: true, stdout: call }, { ok: false, stdout: "" }, { ok: true, stdout: "+CLCC: 1,1,4,0,0\nOK\n" }]) {
    assert.equal((await runStatus(idle, next)).stops, 0);
  }
  const ended = await runStatus(idle);
  assert.equal(ended.stops, 1);
  assert.deepEqual(Array.from(ended.commands[1]), ["AT+CLCC"]);
});

test("a dialing, incoming or unrecognized live voice state cannot trigger cleanup", async () => {
  for (const state of [0, 1, 2, 3, 4, 5, 9]) {
    const outcome = await runStatus({ ok: true, stdout: `+CLCC: 1,0,${state},0,0\nOK\n` });
    assert.equal(outcome.stops, 0);
    assert.equal(outcome.queued, 0);
  }
});

test("voice status rechecks actual temporary devices after a reboot and clears stale ready flags", async () => {
  let ready = false;
  const commands = [];
  const runtime = new VoiceRuntimeManager(__dirname, { withAdb: async task => task({ shellChecked: async command => {
    commands.push(command);
    if (command === "id -u") return { status: 0, output: "0\n" };
    if (command === "uname -r") return { status: 0, output: RUNTIME_KERNEL + "\n" };
    return { status: ready ? 0 : 1, output: "" };
  } }) });
  runtime.localStatus = async () => ({ downloaded: true });
  runtime.routeReady = async () => ready;
  runtime.prepared = true;
  runtime.routeActive = true;
  const cold = await runtime.status();
  assert.equal(cold.prepared, false);
  assert.equal(cold.routeActive, false);
  ready = true;
  const prepared = await runtime.status();
  assert.equal(prepared.prepared, true);
  assert.equal(prepared.routeActive, true);
  runtime.withAdb = async () => { throw new Error("Module disconnected"); };
  const detached = await runtime.status();
  assert.equal(detached.prepared, false);
  assert.equal(detached.routeActive, false);
  assert.ok(commands.every(command => !/insmod|nohup|echo|rm -f|printf/.test(command)));
});

test("missing, unreadable and unsupported modules cannot expose USB voice writes", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/public/app.js"), "utf8");
  const render = source.slice(source.indexOf("function setVoiceStep("), source.indexOf("async function refreshVoiceSetup()"));
  const elements = new Map();
  const state = { voiceRuntimeEnabled: true, voiceSetupBusy: false, atPort: "", callCapabilityData: { ok: false } };
  const context = vm.createContext({ state, localAudioBridgeHost: true, t: key => key,
    renderVoiceNetwork() {}, syncCallButtons() {},
    document: { querySelector: id => { if (!elements.has(id)) elements.set(id, { dataset: {} }); return elements.get(id); } },
  });
  vm.runInContext(render, context);
  context.data = { runtime: { local: { downloaded: true } }, voiceUsb: { adbInterfacePresent: false, standardUsbAudio: false } };
  for (const capabilities of [{ ok: false }, { ok: true, voiceSetupSupported: false }]) {
    state.callCapabilityData = capabilities;
    vm.runInContext("renderVoiceSetup(data)", context);
    for (const id of ["#enableVoiceUsbBtn", "#restoreVoiceUsbBtn", "#prepareVoiceRuntimeBtn"]) assert.equal(elements.get(id).disabled, true);
  }
  assert.equal(elements.get("#voiceSetupMessage").textContent, "callConnectFirst");
  state.atPort = "COM5";
  state.callCapabilityData = { ok: true, voiceSetupSupported: true };
  vm.runInContext("renderVoiceSetup(data)", context);
  assert.equal(elements.get("#enableVoiceUsbBtn").disabled, false);
});

test("a lost launch reply reconnects ADB and verifies the owned route without relaunching", async () => {
  let connections = 0, launches = 0;
  const runtime = new VoiceRuntimeManager(__dirname, { withAdb: async task => {
    const id = ++connections;
    if (id === 3) throw new Error("USB gadget re-enumerating");
    return task({ id, shellChecked: async command => {
      assert.match(command, /if .*--voice-route-session/);
      launches++;
      throw new Error("LIBUSB_ERROR_NO_DEVICE after audio_enable");
    } });
  } });
  runtime.prepared = true;
  runtime.routeReady = async adb => adb.id >= 4;
  const result = await runtime.startRoute();
  assert.equal(result.active, true);
  assert.equal(runtime.routeActive, true);
  assert.equal(launches, 1);
  assert.equal(connections, 4);
});

test("failure to connect before launch does not pretend that the helper was started", async () => {
  let connections = 0;
  const runtime = new VoiceRuntimeManager(__dirname, { withAdb: async task => {
    if (++connections > 1) throw new Error("ADB driver unavailable");
    return task({});
  } });
  runtime.prepared = true;
  runtime.routeReady = async () => false;
  await assert.rejects(runtime.startRoute(), /ADB driver unavailable/);
  assert.equal(connections, 2);
  assert.equal(runtime.routeActive, false);
});

test("route cleanup reconnects after the helper disables USB audio", async () => {
  let connections = 0;
  const runtime = new VoiceRuntimeManager(__dirname, { withAdb: async task => {
    if (++connections === 1) throw new Error("USB disconnected during audio_enable rollback");
    return task({});
  } });
  runtime.routeActive = true;
  runtime.stopRouteWithAdb = async () => { runtime.routeActive = false; return { ok: true, active: false }; };
  assert.equal((await runtime.stopRoute()).active, false);
  assert.equal(connections, 2);
});
