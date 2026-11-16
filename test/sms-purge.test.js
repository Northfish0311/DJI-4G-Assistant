const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../web/server.js"), "utf8");
const start = source.indexOf('if (url.pathname === "/api/sms-purge"');
const end = source.indexOf('if (url.pathname === "/api/sms-send"');
assert.ok(start > 0 && end > start, "the purge route must exist before the SMS send route");
const block = source.slice(start, end);

// Run the real route body against a fake serial queue so the destructive path is
// exercised without a modem.
async function callRoute({allow = "1", body = {keep: 2, confirm: "PURGE"}, indices = [1, 2, 3, 4, 5],
  purgeFails = false, listingIncomplete = false} = {}) {
  const commands = [];
  const removed = new Set();
  const listing = () => indices.filter((index) => !removed.has(index));
  const deps = {
    process: {env: allow === null ? {} : {ALLOW_SMS_DELETE: allow}},
    readJsonBody: async () => body,
    portArg: () => "COM3",
    extractAtResponse: (result) => String(result.stdout || ""),
    enqueueAt: async (_port, batch) => {
      commands.push(batch);
      const deletions = batch.filter((item) => /^AT\+CMGD=\d+$/.test(item));
      if (deletions.length) {
        if (purgeFails) return {ok: false, stdout: "ERROR"};
        for (const item of deletions) removed.add(Number(item.slice("AT+CMGD=".length)));
        return {ok: true, stdout: "OK"};
      }
      if (listingIncomplete) return {ok: false, stdout: '----- AT+CMGL="ALL" -----\n+CMS ERROR: 500\n'};
      const bodyText = listing().map((index) => `+CMGL: ${index},"REC READ","10086",,"","",""\nbody ${index}`).join("\n");
      return {ok: true, stdout: `----- AT+CMGL="ALL" -----\n${bodyText}\nOK\n`};
    },
    sendJson: (res, status, payload) => { res.status = status; res.payload = payload; },
  };
  const res = {};
  const run = new Function("url", "req", "res", "deps", `return (async () => {
    const {readJsonBody, portArg, enqueueAt, extractAtResponse, sendJson, process} = deps;
    ${block}
  })();`);
  await run({pathname: "/api/sms-purge"}, {method: "POST"}, res, deps);
  return {res, commands, remaining: listing()};
}

test("purge keeps the newest N messages and deletes the rest", async () => {
  const {res, commands} = await callRoute({keep: 2});
  assert.equal(res.status, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.purged, 3);
  assert.equal(res.payload.kept, 2);
  const deletions = commands.flat().filter((item) => item.startsWith("AT+CMGD="));
  assert.deepEqual(deletions, ["AT+CMGD=1", "AT+CMGD=2", "AT+CMGD=3"]);
});

test("purge never deletes when the listing is incomplete", async () => {
  const {res, commands} = await callRoute({listingIncomplete: true});
  assert.equal(res.status, 502);
  assert.equal(res.payload.ok, false);
  assert.equal(commands.flat().filter((item) => item.startsWith("AT+CMGD=")).length, 0);
});

test("purge is a no-op when the inbox already fits", async () => {
  const {res, commands} = await callRoute({body: {keep: 5, confirm: "PURGE"}});
  assert.equal(res.status, 200);
  assert.equal(res.payload.purged, 0);
  assert.equal(commands.flat().filter((item) => item.startsWith("AT+CMGD=")).length, 0);
});

test("purge reports a module failure instead of claiming success", async () => {
  const {res} = await callRoute({purgeFails: true});
  assert.equal(res.status, 502);
  assert.equal(res.payload.ok, false);
});

test("purge validates the delete switch, the keep count and the confirmation", async () => {
  const forbidden = await callRoute({allow: null});
  assert.equal(forbidden.res.status, 403);
  for (const body of [{keep: 0, confirm: "PURGE"}, {keep: 51, confirm: "PURGE"},
    {keep: 2, confirm: "DELETE"}, {keep: "abc", confirm: "PURGE"}, {keep: 2.5, confirm: "PURGE"}]) {
    const rejected = await callRoute({body});
    assert.equal(rejected.res.status, 400, JSON.stringify(body));
    assert.equal(rejected.commands.length, 0, "a rejected request must not touch the modem");
  }
});

test("zero-based module indices are not skipped", async () => {
  // This Unicom module numbers messages from 0. Treating 0 as invalid left the oldest
  // message undeletable and made a successful purge still report six messages.
  const {res, commands} = await callRoute({body: {keep: 1, confirm: "PURGE"}, indices: [0, 1, 2]});
  assert.equal(res.status, 200);
  const deletions = commands.flat().filter((item) => item.startsWith("AT+CMGD="));
  assert.deepEqual(deletions, ["AT+CMGD=0", "AT+CMGD=1"]);
  assert.equal(res.payload.purged, 2);
  assert.equal(res.payload.kept, 1);
});
