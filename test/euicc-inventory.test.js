const test = require("node:test");
const assert = require("node:assert/strict");
const { inventoryCandidateAids, scanEuiccInventory } = require("../web/server");

const SE0 = "A06573746B6D65FFFF4953442D522030";
const SE1 = "A06573746B6D65FFFF4953442D522031";
const DEFAULT = "A0000005591010FFFFFFFF8900000100";
const eid = (n) => "89" + String(n).padStart(30, "0");
const profile = (n) => ({ iccid: "890000000000000000" + n, profileState: "disabled" });
const ok = (data) => ({ ok: true, stdout: JSON.stringify({ type: "lpa", payload: { code: 0, data } }) });
const failed = { ok: false, stdout: "" };

test("checks both ESTK secure elements before the default alias", () => {
  const candidates = inventoryCandidateAids({ aids: {}, labels: {} });
  assert.deepEqual(candidates.slice(0, 2), [SE0, SE1]);
  assert.ok(candidates.indexOf(DEFAULT) > candidates.indexOf(SE1));
});

test("reads both ESTK profile lists and deduplicates the default EID alias", async () => {
  const calls = [];
  const result = await scanEuiccInventory([SE0, SE1, DEFAULT], async (aid, args) => {
    calls.push({ aid, args });
    const space = aid === SE1 ? 2 : 1;
    return args[0] === "chip" ? ok({ eidValue: eid(space) }) :
      ok(space === 1 ? [profile(1)] : [profile(2), profile(3)]);
  });
  assert.equal(result.count, 2);
  assert.equal(result.eids[0].aid, SE0);
  assert.equal(result.eids[1].aid, SE1);
  assert.deepEqual(result.eids.map((item) => item.profileCount), [1, 2]);
  assert.deepEqual(result.eids[0].aids, [SE0, DEFAULT]);
  assert.equal(result.profilesComplete, true);
  assert.equal(calls.filter((call) => call.args[0] === "profile").length, 3);
});

test("does not report a failed profile read as an empty space", async () => {
  const result = await scanEuiccInventory([SE0, SE1], async (aid, args) =>
    args[0] === "chip" ? ok({ eidValue: eid(aid === SE0 ? 1 : 2) }) :
      aid === SE0 ? ok([]) : failed);
  assert.equal(result.count, 2);
  assert.equal(result.eids[0].profileCount, 0);
  assert.equal(result.eids[1].profileCount, null);
  assert.equal(result.eids[1].profiles, null);
  assert.equal(result.eids[1].profilesLoaded, false);
  assert.equal(result.profilesComplete, false);
  assert.equal(result.probes[1].status, "profiles-unavailable");
});

test("accepts a successful alternate route after a failed profile read", async () => {
  const result = await scanEuiccInventory([SE0, DEFAULT], async (aid, args) =>
    args[0] === "chip" ? ok({ eidValue: eid(1) }) :
      aid === SE0 ? failed : ok([profile(1)]));
  assert.equal(result.count, 1);
  assert.equal(result.eids[0].aid, DEFAULT);
  assert.equal(result.eids[0].profileCount, 1);
  assert.equal(result.profilesComplete, true);
});

test("does not create a second EID when its entry is inaccessible", async () => {
  const result = await scanEuiccInventory([SE0, SE1], async (aid, args) =>
    aid === SE1 ? failed : args[0] === "chip" ? ok({ eidValue: eid(1) }) : ok([]));
  assert.equal(result.count, 1);
  assert.equal(result.probes[1].status, "eid-unavailable");
  assert.equal(result.discoveryScope, "known-aids");
});

test("keeps a third verified vendor entry and its own profiles", async () => {
  const third = "A0000005591010FFFFFFFF8900000199";
  const candidates = inventoryCandidateAids({ aids: { third }, labels: {} });
  const result = await scanEuiccInventory(candidates, async (aid, args) => {
    const space = [SE0, SE1, third].indexOf(aid) + 1;
    if (!space) return failed;
    return args[0] === "chip" ? ok({ eidValue: eid(space) }) : ok([profile(space)]);
  });
  assert.equal(result.count, 3);
  assert.deepEqual(result.eids.map((item) => item.profiles[0].iccid),
    [profile(1).iccid, profile(2).iccid, profile(3).iccid]);
});

test("rejects malformed or unsuccessful lpac payloads", async () => {
  const malformed = { ok: true, stdout: "not JSON" };
  const errorPayload = { ok: true, stdout: JSON.stringify({ type: "lpa", payload: { code: -1, data: [] } }) };
  const result = await scanEuiccInventory([SE0, SE1], async (aid, args) =>
    args[0] === "chip" ? aid === SE0 ? malformed : ok({ eidValue: eid(2) }) : errorPayload);
  assert.equal(result.count, 1);
  assert.equal(result.eids[0].profilesLoaded, false);
});
