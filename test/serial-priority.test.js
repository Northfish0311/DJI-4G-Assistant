const test = require("node:test");
const assert = require("node:assert/strict");
const { createSerialQueue } = require("../web/serial-queue");

test("urgent calls precede queued reads without interrupting the current write", async () => {
  const queue = createSerialQueue(), events = [];
  let release;
  const first = queue(() => new Promise(resolve => {events.push("write-start"); release = () => {events.push("write-end");resolve();};}));
  await Promise.resolve();
  const read = queue(() => events.push("read"));
  const call = queue(() => events.push("hangup"), {priority: 10});
  assert.deepEqual(events, ["write-start"]);
  release();
  await Promise.all([first, read, call]);
  assert.deepEqual(events, ["write-start", "write-end", "hangup", "read"]);
});

test("expired queue entries reject and can never run later", async () => {
  const queue = createSerialQueue();
  let release, executed = false;
  const first = queue(() => new Promise(resolve => {release = resolve;}));
  await Promise.resolve();
  const expired = queue(() => {executed = true;}, {waitMs: 5});
  await assert.rejects(expired, {code: "SERIAL_QUEUE_TIMEOUT"});
  release(); await first;
  await queue(() => "next");
  assert.equal(executed, false);
});

test("queue limits pending tasks and still drains accepted work", async () => {
  const queue = createSerialQueue();
  let release;
  const first = queue(() => new Promise(resolve => {release = resolve;}));
  await Promise.resolve();
  const pending = Array.from({length: 64}, (_, n) => queue(() => n));
  await assert.rejects(queue(() => "overflow"), {code: "SERIAL_QUEUE_FULL"});
  release(); await first;
  assert.equal((await Promise.all(pending)).length, 64);
});
