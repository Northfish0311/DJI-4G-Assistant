const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {extractAtResponse, parseSmsStorage} = require("../web/server");
const source = fs.readFileSync(path.join(__dirname, "../web/server.js"), "utf8");
const context = vm.createContext({extractAtResponse, parseSmsStorage});
vm.runInContext(source.slice(source.indexOf("function parseSmsListResult("), source.indexOf("function normalizeNetworkTrafficResult(")), context);
const read = (text, ok = true) => context.parseSmsListResult({ok, stdout: text});
const prefix = '----- AT+CMGF=1 -----\nOK\n----- AT+CPMS? -----\n+CPMS: "MT",2,100\nOK\n';

test("SMS failures cannot borrow OK from earlier setup commands", () => {
  for (const tail of ["", '----- AT+CMGL="ALL" -----\n', '----- AT+CMGL="ALL" -----\n+CMS ERROR: 500\n', '----- AT+CMGL="ALL" -----\n+CMGL: 1,"REC READ","10086"\npartial message']) {
    const result = read(prefix + tail);
    assert.equal(result.ok, false);
    assert.equal(result.code, "SMS_READ_INCOMPLETE");
  }
});

test("a completed empty inbox is different from a failed read", () => {
  const result = read(prefix + '----- AT+CMGL="ALL" -----\nOK\n');
  assert.equal(result.ok, true);
  assert.equal(result.storage.used, 2);
  assert.equal(read('OK\n', false).ok, false);
});

test("literal error text in a message is not a modem error", () => {
  const result = read(prefix + '----- AT+CMGL="ALL" -----\n+CMGL: 1,"REC READ","10086"\nERROR\n\nOK\n');
  assert.equal(result.ok, true);
});

test("the SMS route uses validated results and returns an HTTP error for incomplete reads", () => {
  const route = source.slice(source.indexOf('if (url.pathname === "/api/sms-list")'), source.indexOf('if (url.pathname === "/api/sms-delete"'));
  assert.match(route, /parseSmsListResult\(await enqueueAt/);
  assert.match(route, /result\.ok \? 200 : 502/);
});
