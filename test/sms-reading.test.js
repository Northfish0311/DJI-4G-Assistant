const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { readAppSource } = require("./helpers/app-source");
const source = readAppSource();
const context = vm.createContext({});
const fragment = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
vm.runInContext(fragment("function escapeHtml(", "function parseLpaData(") + fragment("function parseAtCsv(", "function extractVerificationCode("), context);
const read = text => Array.from(context.parseSmsMessages(text), message => ({header: Array.from(context.parseAtCsv(message[1])), body: context.decodeSmsBody(message[2])}));
const header = (index, status = "REC READ") => `+CMGL: ${index},"${status}","10086","","26/10/22,12:00:00+32"`;

test("SMS terminal OK is removed once without truncating body lines", () => {
  for (const newline of ["\n", "\r\n", "\r"]) {
    const body = ["First", "OK", "OKAY", "ERROR", "OK"].join(newline);
    assert.equal(read(`${header(1)}${newline}${body}${newline}${newline}OK${newline}`)[0].body, "First\nOK\nOKAY\nERROR\nOK");
  }
});

test("SMS headers are anchored and must contain a valid index and status", () => {
  const body = 'Inline +CMGL: example\n+CMGL: no header\n+CMGL: 2,"unknown","10086"\nStill body';
  assert.equal(read(`${header(1)}\n${body}\nOK`)[0].body, body);
  assert.equal(read("+CMGL: malformed\nOK").length, 0);
});

test("SMS parser retains empty messages and separates stored statuses", () => {
  const result = read([header(1, "REC UNREAD"), "Hello", header(2, "STO SENT"), "Reply", header(3, "STO UNSENT"), "", "OK"].join("\n"));
  assert.deepEqual(result.map(item => item.body), ["Hello", "Reply", ""]);
  assert.deepEqual(result.map(item => item.header[1]), ["REC UNREAD", "STO SENT", "STO UNSENT"]);
  assert.equal(read(`${header(1)}\nOK`).length, 1);
  assert.equal(read("OK\n").length, 0);
});

test("SMS setup output is not shown as a message and UCS2 remains decoded", () => {
  const result = read(`----- AT+CMGF=1 -----\nOK\n----- AT+CPMS? -----\n+CPMS: "MT",1,23\nOK\n----- AT+CMGL="ALL" -----\n${header(1)}\n4F60597D\nOK`);
  assert.equal(result.length, 1);
  assert.equal(result[0].body, "\u4f60\u597d");
});

test("SMS search treats regex metacharacters as literal text", () => {
  assert.equal(context.highlightSmsText("Code [a+b]. Next [a+b].", " [a+b]. "), "Code <mark>[a+b].</mark> Next <mark>[a+b].</mark>");
  assert.equal(context.highlightSmsText("Invoice INVOICE", "invoice"), "<mark>Invoice</mark> <mark>INVOICE</mark>");
  assert.equal(context.highlightSmsText("Anything", "  "), "Anything");
});

test("SMS highlighting always escapes both matching and nonmatching text", () => {
  const payload = '<img src=x onerror="alert(1)">&';
  for (const query of ["img", payload, "<", "&", "missing"]) {
    const rendered = context.highlightSmsText(payload, query);
    assert.ok(!rendered.includes("<img"));
    assert.ok(!rendered.includes('onerror="'));
  }
  assert.equal(context.highlightSmsText("<tag>", "<tag>"), "<mark>&lt;tag&gt;</mark>");
});

test("SMS previews put a distant match in view and remain bounded", () => {
  const body = "prefix ".repeat(60) + "Invoice available\n" + "tail ".repeat(60);
  const preview = context.smsSearchPreview(body, "invoice");
  assert.ok(preview.includes("Invoice available"));
  assert.ok(preview.startsWith("\u2026"));
  assert.ok(preview.endsWith("\u2026"));
  assert.ok(preview.length <= 122);
  assert.ok(!preview.includes("\n"));
});
