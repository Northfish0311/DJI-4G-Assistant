const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");

const source = fs.readFileSync(path.join(__dirname, "../web/powershell-host.js"), "utf8");
const tick = () => new Promise((resolve) => setImmediate(resolve));

function fixture() {
  const hosts = [], killers = [], timers = new Set();
  const spawn = (command, args) => {
    const proc = new EventEmitter();
    proc.args = args;
    proc.exitCode = null;
    proc.signalCode = null;
    proc.kill = () => { proc.killed = true; return true; };
    if (command === "taskkill") { killers.push(proc); return proc; }
    proc.pid = 20000 + hosts.length;
    proc.stdin = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdout.setEncoding = proc.stderr.setEncoding = () => {};
    proc.stdin.write = (input, callback) => { proc.input = input; proc.writeCallback = callback; return true; };
    hosts.push(proc);
    return proc;
  };
  const context = {
    require: (name) => { assert.equal(name, "child_process"); return { spawn }; },
    module: { exports: {} }, Buffer, process: { platform: "win32" }, setImmediate,
    setTimeout: (fn, ms) => { const timer = { fn, ms }; timers.add(timer); return timer; },
    clearTimeout: (timer) => timers.delete(timer),
  };
  vm.runInNewContext(source, context);
  const host = context.module.exports.createPowerShellHost({ cleanupTimeoutMs: 500 });
  const close = (proc, code = 0) => { proc.exitCode = code; proc.emit("close", code); };
  return {
    host, hosts, killers, close,
    expire(ms) {
      const timer = [...timers].find((item) => item.ms === ms);
      assert.ok(timer, `Expected an active ${ms}ms deadline`);
      timers.delete(timer);
      timer.fn();
    },
    answer(proc, output = "answer") {
      const id = proc.input.split("|")[0];
      proc.stdout.emit("data", `<<<B:${id}>>>\n${output}\n<<<X:${id}>>>\n\n<<<E:${id}:0>>>\n`);
    },
    async dispose() {
      const result = host.dispose();
      for (const killer of killers) if (killer.exitCode === null) close(killer);
      for (const proc of hosts) if (proc.exitCode === null) close(proc);
      await result;
      await tick();
      assert.equal(timers.size, 0);
    },
  };
}

test("an asynchronous pipe error holds the job until tree cleanup and ignores late old-host events", async () => {
  const f = fixture();
  try {
    let settled = false;
    const first = f.host.run("first", 100).then((value) => { settled = true; return value; });
    const next = f.host.run("next", 100);
    const brokenPipe = Object.assign(new Error("broken pipe"), { code: "EPIPE" });
    assert.doesNotThrow(() => f.hosts[0].stdin.emit("error", brokenPipe));
    f.hosts[0].writeCallback(brokenPipe);
    await tick();
    assert.equal(f.killers.length, 1);
    assert.equal(settled, false);
    assert.equal(f.hosts.length, 1);
    assert.deepEqual(Array.from(f.killers[0].args), ["/pid", "20000", "/T", "/F"]);

    f.close(f.killers[0]);
    await tick();
    assert.equal(f.hosts.length, 1, "taskkill success alone must not release the old host");
    f.close(f.hosts[0]);
    assert.match((await first).stderr, /EPIPE/);
    await tick();
    assert.equal(f.hosts.length, 2);
    f.hosts[0].stdin.emit("error", brokenPipe);
    f.answer(f.hosts[0], "stale");
    f.answer(f.hosts[1], "fresh");
    assert.equal((await next).stdout, "fresh");
  } finally { await f.dispose(); }
});

test("a timeout retains the serial caller until both host close and taskkill completion", async () => {
  const f = fixture();
  try {
    let settled = false;
    const first = f.host.run("first", 100).then((value) => { settled = true; return value; });
    const next = f.host.run("next", 100);
    f.expire(100);
    f.close(f.hosts[0]);
    await tick();
    assert.equal(settled, false);
    assert.equal(f.hosts.length, 1, "parent exit alone does not prove descendants stopped");
    f.close(f.killers[0]);
    assert.match((await first).stderr, /Timed out after 100ms/);
    await tick();
    f.answer(f.hosts[1]);
    assert.equal((await next).ok, true);
  } finally { await f.dispose(); }
});

for (const mode of ["exit-failure", "spawn-error", "cleanup-deadline"]) {
  test(`failed cleanup blocks queued and new work (${mode})`, async () => {
    const f = fixture();
    try {
      const first = f.host.run("first", 100);
      const next = f.host.run("next", 100);
      f.expire(100);
      if (mode === "exit-failure") f.close(f.killers[0], 1);
      else if (mode === "spawn-error") f.killers[0].emit("error", new Error("not found"));
      else f.expire(500);
      const results = [await first, await next, await f.host.run("later", 100)];
      for (const result of results) {
        assert.equal(result.ok, false);
        assert.match(result.stderr, /Exit and reopen/);
      }
      assert.ok(f.host.blockedReason());
      assert.equal(f.hosts.length, 1);
    } finally { await f.dispose(); }
  });
}

test("dispose settles pending jobs and never respawns a host", async () => {
  const f = fixture();
  const first = f.host.run("first", 100), next = f.host.run("next", 100);
  const disposal = f.dispose();
  assert.equal((await next).ok, false);
  await disposal;
  assert.equal((await first).ok, false);
  assert.equal((await f.host.run("after disposal", 100)).ok, false);
  assert.equal(f.hosts.length, 1);
  assert.equal(f.host.pending(), 0);
});

test("a write callback failure is handled even without a stream error event", async () => {
  const f = fixture();
  try {
    const result = f.host.run("first", 100);
    f.hosts[0].writeCallback(Object.assign(new Error("closed"), { code: "ERR_STREAM_DESTROYED" }));
    f.close(f.killers[0]);
    f.close(f.hosts[0]);
    assert.match((await result).stderr, /ERR_STREAM_DESTROYED/);
  } finally { await f.dispose(); }
});

test("taskkill reporting an already-exited host does not disable later work", async () => {
  const f = fixture();
  try {
    const first = f.host.run("first", 100);
    f.expire(100);
    // The host died on its own before taskkill ran, so taskkill returns 128 "not found".
    f.close(f.hosts[0], 0);
    f.close(f.killers[0], 128);
    assert.match((await first).stderr, /Timed out after 100ms/);
    assert.equal(f.host.blockedReason(), "", "a missing process is a clean stop, not a failure");

    const next = f.host.run("next", 100);
    await tick();
    f.answer(f.hosts[1]);
    assert.equal((await next).ok, true);
  } finally { await f.dispose(); }
});

