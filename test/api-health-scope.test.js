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

test("applyHealth can actually resolve the API level at call time", () => {
  const sandbox = {
    state: {},
    t: (key, params) => key + JSON.stringify(params || {}),
    showFeedback: () => {},
    document: { querySelector: () => ({ style: {}, textContent: "" }) },
    updateProfileHint: () => {},
    applyLanguage: () => {},
  };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: "api.js" });
  // A mismatching level must reach showFeedback instead of throwing.
  const warnings = [];
  sandbox.showFeedback = (message, tone) => warnings.push({ message, tone });
  sandbox.state = {};
  sandbox.applyHealth({ apiVersion: 999, version: "9.9.9" });
  assert.equal(warnings.length, 1, "a version mismatch should warn exactly once");
  assert.equal(warnings[0].tone, "warn");
  assert.match(warnings[0].message, /999/);
  // A matching level must stay silent.
  sandbox.state = {};
  sandbox.applyHealth({ apiVersion: 2, version: "1.8.11" });
  assert.equal(warnings.length, 1);
});
