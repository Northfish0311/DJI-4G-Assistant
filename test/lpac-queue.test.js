const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");

const source = fs.readFileSync(path.join(__dirname, "../web/server.js"), "utf8");
const lpacSource = source.slice(source.indexOf("function runLpac("), source.indexOf("function euiccInventoryPath("));
const queueSource = source.slice(source.indexOf("function enqueueSerial("), source.indexOf("function enqueueAt("));

test("a rejected queue task reaches its caller without preventing the next task", async () => {
  const voiceSource = source.slice(source.indexOf("function enqueueVoice("), source.indexOf("function redactAtResult("));
  const context = vm.createContext({});
  vm.runInContext("let atQueue = Promise.resolve(), voiceQueue = Promise.resolve();\n" + queueSource + voiceSource, context);
  for (const name of ["enqueueSerial", "enqueueVoice"]) {
    const error = new Error("expected failure");
    const failed = context[name](() => { throw error; });
    const recovered = context[name](() => "next task completed");
    await assert.rejects(failed, item => item === error);
    assert.equal(await recovered, "next task completed");
  }
});

test("PowerShell spawn errors are handled at the child process, not by a global crash handler", async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  let cleared = 0;
  const context = vm.createContext({ root: ".", spawn: () => child, setTimeout: () => 1, clearTimeout: () => cleared++, diagnosticCode: error => error.code });
  vm.runInContext(source.slice(source.indexOf("function runPowerShell("), source.indexOf("function script(")), context);
  const result = context.runPowerShell(["-Command", "sensitive command"]);
  child.emit("error", Object.assign(new Error("sensitive command"), { code: "ENOENT" }));
  child.emit("close", -1);
  const value = await result;
  assert.equal(value.ok, false);
  assert.match(value.stderr, /ENOENT/);
  assert.doesNotMatch(value.stderr, /sensitive/);
  assert.equal(cleared, 1);
});

function harness(onSpawn) {
  const context = vm.createContext({
    spawn: (...args) => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      onSpawn(child, ...args);
      return child;
    },
    root: ".", process: { env: {} }, setTimeout, clearTimeout,
    normalizeIsdrAid: (value) => value, DEFAULT_ISDR_AID: "default",
  });
  vm.runInContext("let atQueue = Promise.resolve();\n" + queueSource + lpacSource, context);
  return context;
}

test("lpac and serial work share the same queue", async () => {
  const events = [];
  const context = harness((child) => {
    events.push("open");
    setTimeout(() => { child.stdout.emit("data", Buffer.from("done")); events.push("close"); child.emit("close", 0); }, 10);
  });
  const first = context.runLpac("lpac", "COM1", [], 1000);
  const second = context.enqueueSerial(() => events.push("at"));
  const result = await first;
  await second;
  assert.equal(result.ok, true);
  assert.equal(result.stdout, "done");
  assert.deepEqual(events, ["open", "close", "at"]);
});

test("passes the selected port to both current and legacy lpac drivers", async () => {
  const context = harness((child, _executable, _args, options) => {
    assert.equal(options.env.LPAC_APDU_AT_DEVICE, "COM5");
    assert.equal(options.env.AT_DEVICE, "COM5");
    setTimeout(() => child.emit("close", 0), 1);
  });
  assert.equal((await context.runLpac("lpac", "COM5", [], 1000)).ok, true);
});

test("a timeout waits for process exit before releasing serial ownership", async () => {
  const events = [];
  const context = harness((child) => {
    child.kill = () => {
      events.push("kill");
      setTimeout(() => { events.push("close"); child.emit("close", 0); }, 10);
    };
  });
  const first = context.runLpac("lpac", "COM1", [], 5);
  const second = context.enqueueSerial(() => events.push("at"));
  const result = await first;
  await second;
  assert.equal(result.ok, false);
  assert.match(result.stderr, /Timed out/);
  assert.deepEqual(events, ["kill", "close", "at"]);
});
