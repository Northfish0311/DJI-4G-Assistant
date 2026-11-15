const test = require("node:test");
const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const path = require("node:path");
const {smsSubmitResult} = require("../web/server");

test("Windows SMS submission stops at terminal replies and never automatically resends", {skip: process.platform !== "win32"}, () => {
  const ok = "\r\nOK\r\n", prompt = "\r\n> ", ack = "\r\n+CMGS: 0\r\nOK\r\n";
  const cases = [
    {parts:2, chunks:[ok, prompt, "+CM", "GS: 4,00\r", "\n+CMTI: \"SM\",2\r\n", ok, prompt, ack], status:"submitted", count:2, submits:2},
    {parts:1, chunks:["\r\n+CM", "E ERROR: SIM busy\r\n"], status:"rejected", count:0, submits:0, reason:"+CME ERROR: SIM busy"},
    {parts:1, chunks:[ok, "+CMTI: \"SM>slot\",2\r\n", "+CMS ERROR: 3", "30\r\n"], status:"rejected", count:0, submits:0, reason:"+CMS ERROR: 330"},
    {parts:3, chunks:[ok, prompt, ack, prompt, "+CMS ERROR: 331\r\n"], status:"rejected", count:1, submits:2, reason:"+CMS ERROR: 331"},
    {parts:2, chunks:[ok, prompt, "\r\n+CMGS: 3\r\nERROR\r\n"], status:"rejected", count:0, submits:1, reason:"ERROR"},
    {parts:2, chunks:[ok, prompt, ok], status:"unconfirmed", count:0, submits:1},
    {parts:2, chunks:[ok, prompt, "+CMGS: 1\r\n"], status:"unconfirmed", count:0, submits:1},
    {parts:1, chunks:[ok, prompt, "!disconnect!"], status:"unconfirmed", count:0, submits:1},
    {parts:1, chunks:[ok, "not a prompt: >\r\n"], status:"not-submitted", count:0, submits:0, esc:true},
    {parts:1, chunks:[ok, prompt, "+CMGS: invalid\r\nOK\r\n"], status:"unconfirmed", count:0, submits:1},
  ];
  const script = path.join(__dirname, "fixtures", "fake-sms-port.ps1");
  const output = execFileSync("powershell.exe", ["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",script],
    {input: JSON.stringify(cases), encoding:"utf8", windowsHide:true, timeout:30000});
  const results = JSON.parse(output.replace(/^\uFEFF/, ""));
  assert.equal(results.length, cases.length);
  cases.forEach((c, i) => {
    const {result, writes, reads, closed} = results[i];
    assert.equal(result.status, c.status, "case " + i);
    assert.equal(result.submittedSegments, c.count); assert.equal(result.totalSegments, c.parts);
    assert.equal(result.modemError, c.reason ?? null);
    assert.equal(writes.filter(x => x === "submit").length, c.submits);
    assert.equal(writes.includes("escape"), !!c.esc); assert.equal(closed, true);
    if (c.status === "rejected") assert.equal(reads, c.chunks.length, "must not poll again after rejection");
    const api = smsSubmitResult({ok:true, stdout:JSON.stringify(result)}, c.parts);
    assert.equal(api.status, c.status); assert.equal(api.ok, c.status === "submitted");
  });
});

test("missing, inconsistent or interrupted worker output never confirms an SMS or exposes its payload", () => {
  for (const run of [
    {ok:true, stdout:"not a receipt"},
    {ok:false, stderr:"sensitive diagnostic"},
    {ok:true, stdout:'{"status":"submitted","totalSegments":2,"submittedSegments":1}'},
    {ok:true, stdout:'{"status":"submitted","totalSegments":1,"submittedSegments":1}'},
    {ok:true, stdout:'{"status":"rejected","totalSegments":2,"submittedSegments":2}'},
  ]) {
    const result = smsSubmitResult(run, 2);
    assert.equal(result.ok, false); assert.equal(result.status, "unconfirmed"); assert.equal(result.submittedSegments, null);
    assert.doesNotMatch(JSON.stringify(result), /sensitive diagnostic|not a receipt/);
  }
});

test("a rejected segment retains its modem reason and the count of earlier accepted parts", () => {
  const parse = modemError => smsSubmitResult({ok:true, stdout:JSON.stringify({status:"rejected", submittedSegments:1, totalSegments:2, modemError})}, 2);
  assert.match(parse("+CMS ERROR: 330").error, /\+CMS ERROR: 330.*1\/2/);
  assert.equal(parse("+CMS ERROR: 330\nunrelated").modemError, null);
});
