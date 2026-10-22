const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createSerialQueue } = require("../web/serial-queue");
const { readAppSource } = require("./helpers/app-source");
const source = fs.readFileSync(path.join(__dirname, "../web/server.js"), "utf8");
const browser = readAppSource();
const eid = "89000000000000000000000000000001";
const otherEid = "89000000000000000000000000000002";
const aid = "A0000005591010FFFFFFFF8900000100";

function serverHarness() {
  const operations = [];
  const context = vm.createContext({
    isEid: value => /^89[0-9]{30}$/.test(String(value || "")),
    RequestError: class extends Error {constructor(status, code, message) {super(message);this.statusCode = status;this.code = code;}},
    enqueueSerial: createSerialQueue(),
    runAtCommands: async () => ({ok: true, voiceCalls: []}),
    parseCallStatusResult: value => value, hasVoiceSession: value => value.voiceCalls.length > 0,
    parseLpacData: JSON.parse,
    runLpacProcess: async (exe, port, args) => {
      operations.push(args);
      return {ok: true, stdout: JSON.stringify({eidValue: eid})};
    },
  });
  vm.runInContext(source.slice(source.indexOf("function runLpacWrite("), source.indexOf("function runLpacProcess(")), context);
  return {context, operations, write: expectedEid => context.runLpacWrite("lpac", "COM5", ["profile", "download", "-a", "dummy"], 300000, aid, expectedEid)};
}

test("eSIM writes require an explicit expected EID", () => {
  const ui = serverHarness();
  for (const invalid of [undefined, "", "wrong", "89"]) assert.throws(() => ui.write(invalid), {code: "EID_REQUIRED"});
  assert.equal(ui.operations.length, 0);
});

test("a matching EID is checked in the same serial task before writing", async () => {
  const ui = serverHarness();
  assert.equal((await ui.write(eid)).ok, true);
  assert.deepEqual(Array.from(ui.operations[0]), ["chip", "info"]);
  assert.equal(ui.operations[1][1], "download");
});

test("a card replaced while waiting is rejected before any write", async () => {
  const ui = serverHarness();
  let release;
  const pending = ui.context.enqueueSerial(() => new Promise(resolve => {release = resolve;}));
  await Promise.resolve();
  const write = ui.write(eid);
  ui.context.runLpacProcess = async () => ({ok: true, stdout: JSON.stringify({eidValue: otherEid})});
  release(); await pending;
  await assert.rejects(write, {code: "EID_CHANGED"});
  assert.equal(ui.operations.length, 0);
});

test("unknown EIDs and active or unreadable calls fail closed", async () => {
  for (const [reply, code] of [[{ok: false, voiceCalls: []}, "CALL_STATUS_UNAVAILABLE"], [{ok: true, voiceCalls: [{}]}, "CALL_ACTIVE"]]) {
    const ui = serverHarness();
    ui.context.runAtCommands = async () => reply;
    await assert.rejects(ui.write(eid), {code});
    assert.equal(ui.operations.length, 0);
  }
  const ui = serverHarness();
  ui.context.runLpacProcess = async () => ({ok: false});
  await assert.rejects(ui.write(eid), {code: "EID_UNAVAILABLE"});
});

function browserHarness(response) {
  const input = {value: "LPA:1$example.invalid$dummy"}, requests = [], feedback = [], refreshed = [];
  const state = {activeAid: aid, activeEid: eid, cardEpoch: 1, profileDownloadEnabled: true, euiccInventory: []};
  const context = vm.createContext({
    state, AbortController, setTimeout, clearTimeout,
    document: {querySelector: () => input}, activeEuicc: () => null, shortEid: value => value,
    t: key => key, window: {confirm: () => true}, setBusy: value => {state.busy = value;},
    portInput: {value: "COM5"}, apiHeaders: value => value,
    fetch: async (url, options) => {requests.push(JSON.parse(options.body));return response;},
    textFromResult: data => data.stderr || data.stdout || "", append() {}, showFeedback: message => feedback.push(message),
    callApi: async action => {refreshed.push(action);return true;},
  });
  vm.runInContext(browser.slice(browser.indexOf("function profileWriteTarget()"), browser.indexOf("async function runProfileAction(")) + browser.slice(browser.indexOf("async function downloadProfile()"), browser.indexOf("async function addEuiccAid()")), context);
  return {context, state, input, requests, feedback, refreshed};
}

test("HTTP 200 with ok:false preserves an activation code and does not take the success path", async () => {
  const ui = browserHarness({ok: true, json: async () => ({ok: false, stderr: "lpac.exe not found"})});
  await ui.context.downloadProfile();
  assert.equal(ui.input.value, "LPA:1$example.invalid$dummy");
  assert.deepEqual(ui.refreshed, []);
  assert.deepEqual(ui.feedback, ["writeFailed"]);
  assert.equal(ui.requests[0].expectedEid, eid);
  assert.equal(ui.state.busy, false);
});

test("only confirmed successful downloads clear activation input", async () => {
  const ui = browserHarness({ok: true, json: async () => ({ok: true, stdout: "done"})});
  await ui.context.downloadProfile();
  assert.equal(ui.input.value, "");
  assert.deepEqual(ui.refreshed, ["lpac-profiles"]);
  assert.deepEqual(ui.feedback, ["writeDone"]);
});

test("local EID changes and active calls prevent submission", async () => {
  const ui = browserHarness();
  const target = ui.context.profileWriteTarget();
  ui.state.activeEid = otherEid;
  await assert.rejects(ui.context.postProfileWrite("/api/test", {}, target), {code: "EID_CHANGED"});
  ui.state.callStatusData = {voiceCalls: [{}]};
  await ui.context.downloadProfile();
  assert.equal(ui.requests.length, 0);
  assert.deepEqual(ui.feedback, ["finishCallFirst"]);
});

test("every existing profile mutation uses the execution-time identity guard", () => {
  for (const operation of ['args, 90000', '["profile", "nickname", id, nickname]', '["notification", "process", "-a", "-r"]', '["profile", "download", "-a", code]']) {
    assert.ok(source.includes('runLpacWrite(lpac, portArg(url), ' + operation));
  }
});

test("a completed write with a failed refresh shows a warning and never submits again", async () => {
  const ui = browserHarness({ok: true, json: async () => ({ok: true, stdout: "done"})});
  ui.context.callApi = async (action, options) => {
    assert.equal(options.manageBusy, false);
    assert.equal(ui.state.busy, true);
    return false;
  };
  await ui.context.downloadProfile();
  assert.deepEqual(ui.feedback, ["writeRefreshFailed"]);
  assert.equal(ui.input.value, "");
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.state.busy, false);
});

test("a late successful write never clears input or refreshes a different card", async () => {
  const ui = browserHarness();
  ui.context.fetch = async () => {
    ui.state.activeEid = otherEid;ui.input.value = "LPA:1$new.example$new-code";
    return {ok: true, json: async () => ({ok: true})};
  };
  await ui.context.downloadProfile();
  assert.deepEqual(ui.feedback, ["writeTargetChanged"]);
  assert.deepEqual(ui.refreshed, []);
  assert.equal(ui.input.value, "LPA:1$new.example$new-code");
});

test("a lost write response is uncertain and keeps the activation code", async () => {
  const ui = browserHarness();ui.context.fetch = async () => {throw new TypeError("Network error");};
  await ui.context.downloadProfile();
  assert.deepEqual(ui.feedback, ["writeUnknown"]);
  assert.equal(ui.input.value, "LPA:1$example.invalid$dummy");
  assert.deepEqual(ui.refreshed, []);
});

test("a newly typed activation code is not cleared by the previous completed download", async () => {
  const ui = browserHarness();ui.context.fetch = async () => {
    ui.input.value = "LPA:1$new.example$new-code";
    return {ok: true, json: async () => ({ok: true})};
  };
  await ui.context.downloadProfile();
  assert.equal(ui.input.value, "LPA:1$new.example$new-code");
  assert.deepEqual(ui.feedback, ["writeDone"]);
});
