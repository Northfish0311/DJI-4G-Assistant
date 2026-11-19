const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "../web/public/api.js"), "utf8");

// The console API level is read by applyHealth, which runs on every health poll. It was
// briefly declared inside requestAction, so the page threw a ReferenceError the moment a
// health response arrived — invisible to a test that only checked the name was present.
test("the console API level is declared once, at module scope", () => {
  const declarations = [...SOURCE.matchAll(/^const CONSOLE_API_VERSION = (\d+);$/gm)];
  assert.equal(declarations.length, 1, "expected exactly one top-level declaration");
  const indented = [...SOURCE.matchAll(/^\s+const CONSOLE_API_VERSION/mg)];
  assert.equal(indented.length, 0, "the constant must not be declared inside a function");
});

function harness() {
  const warnings = [];
  const tokenRow = {style: {}};
  const context = vm.createContext({
    state: {},
    document: {querySelector: () => tokenRow},
    showFeedback: (...args) => warnings.push(args),
    t: (key, args) => ({key, ...args}),
    updateProfileHint() {},
    applyLanguage() {},
  });
  vm.runInContext(SOURCE, context, {filename: "api.js"});
  return {context, warnings, tokenRow};
}

test("health applies before any request action without a scope error", () => {
  const {context, warnings, tokenRow} = harness();
  context.applyHealth({apiVersion: 2, authRequired: true, smsDeleteEnabled: false});
  assert.equal(context.state.authRequired, true);
  assert.equal(context.state.smsDeleteEnabled, false);
  assert.equal(tokenRow.style.display, "grid");
  assert.equal(warnings.length, 0);
});

test("health API mismatch warns once using the shared client API level", () => {
  const {context, warnings} = harness();
  context.applyHealth({apiVersion: 999, version: "9.9.9"});
  context.applyHealth({apiVersion: 999, version: "9.9.9"});
  assert.equal(warnings.length, 1);
  // The message reaches showFeedback already formatted, so check the rendered text.
  assert.match(warnings[0][0], /999/);
  assert.equal(warnings[0][1], "warn");
});
