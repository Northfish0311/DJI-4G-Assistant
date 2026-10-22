const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseCallStatusResult, hasVoiceSession, extractAtResponse, atAccepted } = require("../web/server");
const { VoiceRuntimeManager, RUNTIME_KERNEL, RUNTIME_FILES, routeLaunchCommand } = require("../web/voice-runtime");
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

async function runStatus(first, second = first, brief = false) {
  const queued = [], commands = [];
  let stops = 0, reply;
  const context = vm.createContext({
    parseCallStatusResult, hasVoiceSession, portArg: () => "COM5", console,
    enqueueAt: async (_port, items) => { commands.push(items); return commands.length === 1 ? first : second; },
    enqueueVoice: task => { queued.push(task); return Promise.resolve(); },
    voiceRuntime: { routeActive: true, stopRoute: async () => { stops++; } },
    sendJson: (_res, _status, data) => { reply = data; },
  });
  await vm.runInContext("(async function(req,res,url){" + statusHandler + "})", context)({}, {}, { pathname: "/api/call-status", searchParams: new URLSearchParams(brief ? "brief=1" : "") });
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

test("fast call polling includes CPAS confirmation but skips CLIP", async () => {
  const outcome = await runStatus({ ok: true, stdout: call }, undefined, true);
  assert.deepEqual(Array.from(outcome.commands[0]), ["AT+CLCC", "AT+CPAS"]);
  assert.equal(outcome.reply.ok, true);
  assert.equal(outcome.stops, 0);
});

test("live audio validates firmware and call state without a slow Windows PnP inventory", async () => {
  const handler = serverSource.slice(serverSource.indexOf('  if (url.pathname === "/api/voice-route-start"'), serverSource.indexOf('  if (url.pathname === "/api/voice-route-stop"'));
  for (const firmware of ["QDC507GLEFM21", "EC25_UNKNOWN", "QDC507GLEFM21_FAKE", "ERROR"]) {
    const commands = [];
    let starts = 0, reply, status;
    const context = vm.createContext({
      process: { env: { ALLOW_VOICE_RUNTIME: "1" } },
      readJsonBody: async () => ({ confirm: "AUDIO" }), portArg: () => "COM5",
      parseCallStatusResult, extractAtResponse, atAccepted,
      enqueueAt: async (_port, items) => { commands.push(items); return { ok: true, stdout: "----- AT+GMR -----\n" + firmware + "\nOK\n----- AT+CLCC -----\n" + call }; },
      enqueueVoice: async task => task(), voiceRuntime: { startRoute: async () => { starts++; return { ok: true, active: true }; } },
      voicePnpStatus: async () => { throw new Error("Full Windows inventory cannot run on the connected-call path"); },
      sendJson: (_res, code, data) => { status = code; reply = data; },
    });
    await vm.runInContext("(async function(req,res,url){" + handler + "})", context)({ method: "POST" }, {}, { pathname: "/api/voice-route-start" });
    assert.deepEqual(Array.from(commands[0]), ["AT+GMR", "AT+CLCC"]);
    assert.equal(starts, firmware === "QDC507GLEFM21" ? 1 : 0);
    assert.equal(status, firmware === "QDC507GLEFM21" ? 200 : 409);
    assert.equal(reply.ok, firmware === "QDC507GLEFM21");
  }
});

test("queued route cleanup rechecks call state and does not close a newly arrived call", async () => {
  const idle = { ok: true, stdout: framed("OK\n").replace("+CPAS: 4", "+CPAS: 0") };
  for (const next of [{ ok: true, stdout: call }, { ok: false, stdout: "" }, { ok: true, stdout: "+CLCC: 1,1,4,0,0\nOK\n" }]) {
    assert.equal((await runStatus(idle, next)).stops, 0);
  }
  const ended = await runStatus(idle);
  assert.equal(ended.stops, 1);
  assert.deepEqual(Array.from(ended.commands[1]), ["AT+CLCC", "AT+CPAS"]);
});

test("missing, failed, busy and active CPAS never confirm an empty CLCC as idle", async () => {
  const idle = { ok: true, stdout: framed("OK\n").replace("+CPAS: 4", "+CPAS: 0") };
  for (const response of ["ERROR\n", "OK\n", "+CPAS: 0\nERROR\n", "+CPAS: 0\n", "+CPAS: 10\nOK\n", ...[1, 2, 3, 4, 5].map(value => `+CPAS: ${value}\nOK\n`)]) {
    const ambiguous = { ok: true, stdout: framed("OK\n").replace("+CPAS: 4\nOK\n", response) };
    const first = await runStatus(ambiguous);
    assert.equal(first.queued, 0, response);
    assert.equal(first.stops, 0, response);
    const rechecked = await runStatus(idle, ambiguous);
    assert.equal(rechecked.queued, 1, response);
    assert.equal(rechecked.stops, 0, response);
  }
  assert.equal((await runStatus({ok: true, stdout: "OK\n"})).stops, 0);
  assert.equal(parseCallStatusResult(idle).activity, 0);
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
      assert.match(command, /nohup \/bin\/sh -c/);
      launches++;
      throw new Error("LIBUSB_ERROR_NO_DEVICE after audio_enable");
    } });
  } });
  runtime.prepared = true;
  runtime.recoverOwnedRoute = async () => false;
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
  runtime.recoverOwnedRoute = async () => false;
  runtime.routeReady = async () => false;
  await assert.rejects(runtime.startRoute(), /ADB driver unavailable/);
  assert.equal(connections, 2);
  assert.equal(runtime.routeActive, false);
});

test("detached child records its own PID and birth before exec can re-enumerate USB", () => {
  const launch = routeLaunchCommand();
  assert.match(launch, /nohup \/bin\/sh -c/);
  assert.match(launch, /pid=\$\$/);
  assert.ok(launch.indexOf("printf") < launch.indexOf("exec /tmp/dji4g-assistant-voice/mavo-pcm-bridge.armv7"));
  assert.match(launch, /> \/run\/dji4g-assistant-route\.pid \|\| exit 71/);
  assert.doesNotMatch(launch, /pid=\$!/);
});

test("orphan recovery requires the private path, exact route argument and pinned executable checksum", async () => {
  let command;
  const runtime = new VoiceRuntimeManager(__dirname);
  const recovered = await runtime.recoverOwnedRoute({ shellChecked: async value => {
    command = value;
    return { status: 0, output: "OWNED_ROUTE=1\n" };
  } });
  assert.equal(recovered, true);
  assert.match(command, /\/tmp\/dji4g-assistant-voice\/mavo-pcm-bridge\.armv7/);
  assert.match(command, /grep -Fxq -- '--voice-route-session'/);
  assert.match(command, /grep -Fxq -- "--voice-route-session"/);
  assert.ok(command.includes(RUNTIME_FILES.find(file => file.name === "mavo-pcm-bridge.armv7").sha256));
  assert.match(command, /sha256sum/);
  assert.doesNotMatch(command, /kill|pkill|killall/);
  assert.equal(await runtime.recoverOwnedRoute({ shellChecked: async () => ({ status: 0, output: "OWNED_ROUTE=0\n" }) }), false);
  await assert.rejects(runtime.recoverOwnedRoute({ shellChecked: async () => ({ status: 79, output: "" }) }), /Multiple verified/);
  await assert.rejects(runtime.recoverOwnedRoute({ shellChecked: async () => ({ status: 0, output: "unexpected" }) }), /valid owned/);
});

test("an orphaned inactive route is stopped before one fresh helper is launched", async () => {
  const events = [];
  const runtime = new VoiceRuntimeManager(__dirname, { withAdb: async task => task({ shellChecked: async () => {
    events.push("launch"); return { status: 0, output: "" };
  } }) });
  runtime.prepared = true;
  runtime.recoverOwnedRoute = async () => { events.push("recover"); return true; };
  let checks = 0;
  runtime.routeReady = async () => ++checks > 1;
  runtime.stopRouteWithAdb = async () => { events.push("stop-orphan"); };
  assert.equal((await runtime.startRoute()).active, true);
  assert.deepEqual(events, ["recover", "stop-orphan", "launch"]);
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
