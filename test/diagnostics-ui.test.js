const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { readAppSource } = require("./helpers/app-source");

const source = readAppSource();

function harness() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {textContent: "", dataset: {}, value: ""});
    return elements.get(id);
  };
  const nodes = [];
  const output = {
    scrollTop: 0,
    get scrollHeight() { return nodes.length * 40; },
    get textContent() { return nodes.map(node => node.textContent).join(""); },
    append(node) { nodes.push(node); },
    replaceChildren() { nodes.length = 0; },
  };
  const timers = new Map();
  const context = vm.createContext({
    Map, AbortController, localStorage: {getItem: () => "en"}, navigator: {language: "en", clipboard: {writeText: async () => {}}}, output,
    document: {querySelector: element, createElement: () => ({textContent: "", remove() {nodes.splice(nodes.indexOf(this), 1);}})},
    portInput: {value: "COM5"}, apiHeaders: value => value, updateSummary() {},
    setTimeout: fn => {const id = timers.size + 1; timers.set(id, fn); return id;},
    clearTimeout: id => timers.delete(id),
  });
  vm.runInContext([
    source.slice(source.indexOf("const copy ="), source.indexOf("function applyLanguage()")),
    source.slice(source.indexOf("function append("), source.indexOf("function actionTitle(")),
    source.slice(source.indexOf("function textFromResult("), source.indexOf("function registrationLabel(")),
    source.slice(source.indexOf("async function sendAt("), source.indexOf("async function runProfileAction(")),
    "function setBusy(value) { state.busy = value; }",
  ].join("\n"), context);
  return {context, element, nodes, output, timers, ...vm.runInContext("({state, append, clearLog, copyLog, followLatestLog, renderLogControls, renderAtFeedback, sendAt})", context)};
}

test("logs append as literal text, preserve existing nodes and bound retained history", () => {
  const ui = harness();
  ui.append("AT", '<img src=x onerror="bad()">');
  const first = ui.nodes[0];
  ui.append("second", "OK");
  assert.equal(ui.nodes[0], first);
  assert.match(first.textContent, /<img src=x/);
  for (let n = 0; n < 220; n++) ui.append("sample", String(n));
  assert.equal(ui.nodes.length, 200);
  assert.equal(ui.state.logEntries.length, 200);
  assert.equal(ui.state.logDropped, true);
  assert.ok(ui.state.logCharacters <= 200000);
  assert.equal(ui.state.logCharacters, ui.output.textContent.length);
  assert.equal(ui.output.scrollTop, ui.output.scrollHeight);
});

test("large log entries and total retained text are bounded independently", () => {
  const ui = harness();
  for (let n = 0; n < 20; n++) ui.append("long", "x".repeat(30000));
  assert.ok(ui.nodes.length < 200);
  assert.ok(ui.nodes.every(node => node.textContent.length < 24100));
  assert.ok(ui.state.logCharacters <= 200000);
  assert.match(ui.output.textContent, /Entry shortened/);
});

test("paused reading compensates for trimmed entries and clear resets all log state", () => {
  const ui = harness();
  for (let n = 0; n < 200; n++) ui.append("sample", "OK");
  ui.state.logFollow = false; ui.output.scrollTop = 400;
  ui.append("next", "OK");
  assert.equal(ui.output.scrollTop, 360);
  assert.equal(ui.state.logPending, 1);
  assert.equal(ui.element("#logLatestBtn").disabled, false);
  ui.followLatestLog();
  assert.equal(ui.state.logPending, 0);
  assert.equal(ui.output.scrollTop, ui.output.scrollHeight);
  ui.clearLog();
  assert.equal(ui.nodes.length, 0);
  assert.equal(ui.state.logCharacters, 0);
  assert.equal(ui.state.logDropped, false);
  assert.equal(ui.element("#logEmpty").hidden, false);
  assert.equal(ui.element("#copyLogBtn").disabled, true);
});

test("clipboard failure is visible and copying never calls a server", async () => {
  const ui = harness();
  ui.append("AT", "OK");
  let copied;
  ui.context.navigator.clipboard.writeText = async text => {copied = text;};
  await ui.copyLog();
  assert.equal(copied, ui.output.textContent);
  assert.match(ui.element("#logActionStatus").textContent, /personal data/);
  ui.context.navigator.clipboard = undefined;
  await ui.copyLog();
  assert.match(ui.element("#logActionStatus").textContent, /Copy unavailable/);
  assert.equal(ui.state.logCopying, false);
});

test("AT submission is single-flight and opens results without clearing earlier entries", async () => {
  const ui = harness();
  ui.element("#atInput").value = "AT+CSQ";
  let complete, count = 0;
  ui.context.fetch = async () => {count++; return new Promise(resolve => {complete = resolve;});};
  ui.append("previous", "kept");
  const pending = ui.sendAt();
  await ui.sendAt();
  assert.equal(count, 1);
  assert.equal(ui.element("#logPanel").open, true);
  assert.equal(ui.state.busy, true);
  complete({ok: true, json: async () => ({ok: true, stdout: "+CSQ: 20,99\nOK"})});
  await pending;
  assert.equal(ui.state.busy, false);
  assert.equal(ui.element("#atFeedback").dataset.tone, "success");
  assert.match(ui.output.textContent, /previous/);
  assert.equal(ui.timers.size, 0);
});

test("HTTP guards, AT errors and malformed responses never report success", async () => {
  for (const response of [
    {ok: false, json: async () => ({ok: false, stderr: "Blocked by safe AT guard"})},
    {ok: true, json: async () => ({ok: false, error: "Port busy"})},
    {ok: true, json: async () => ({ok: true, stdout: "AT\r\nERROR\r\n"})},
    {ok: true, json: async () => ({ok: true, stdout: "+CME ERROR: 10\r\n"})},
    {ok: true, json: async () => ({ok: true, stdout: "----- AT+CSQ -----\n"})},
    {ok: true, json: async () => ({ok: true, stdout: ""})},
    {ok: true, json: async () => {throw new SyntaxError("Bad JSON");}},
  ]) {
    const ui = harness();
    ui.element("#atInput").value = "AT";
    ui.context.fetch = async () => response;
    ui.context.updateSummary = () => assert.fail("Failed result updated summary");
    await ui.sendAt();
    assert.equal(ui.element("#atFeedback").dataset.tone, "error");
    assert.equal(ui.state.busy, false);
    assert.equal(ui.timers.size, 0);
  }
});

test("AT timeout releases busy controls without automatically retrying", async () => {
  const ui = harness();
  ui.element("#atInput").value = "AT";
  let count = 0;
  ui.context.fetch = (url, options) => {
    count++;
    return new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(Object.assign(new Error("timeout"), {name: "AbortError"}))));
  };
  const pending = ui.sendAt();
  [...ui.timers.values()][0]();
  await pending;
  assert.equal(count, 1);
  assert.equal(ui.state.busy, false);
  assert.equal(ui.element("#atFeedback").textContent, "AT request timed out.");
  assert.equal(ui.timers.size, 0);
  ui.state.confirming = true;
  await ui.sendAt();
  assert.equal(count, 1);
});
