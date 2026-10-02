const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("iOS manual reload confirms draft loss without reloading healthy pages on resume", () => {
  const view = read("ios/DJI4GAssistant/Views/ConsoleView.swift");
  assert.match(view, /else \{ confirmingReload = true \}/);
  assert.match(view, /confirmationDialog\("console.reload_title"/);
  assert.match(view, /Text\("console.reload_warning"\)/);
  const resume = view.slice(view.indexOf(".onChange(of: scenePhase)"), view.indexOf("private func launchURL"));
  assert.match(resume, /phase == \.active && loadError != nil/);
  assert.match(resume, /retryCount \+= 1/);
  assert.doesNotMatch(resume, /retry\(\)/);
});

test("iOS response failures and disposed views cannot become a successful connection", () => {
  const view = read("ios/DJI4GAssistant/Views/ConsoleView.swift");
  assert.match(view, /navigationResponse\.isForMainFrame/);
  assert.match(view, /automaticRetryAllowed\.wrappedValue = failure\.allowsAutomaticRetry/);
  assert.match(view, /didFinish[\s\S]*?guard isActive, errorMessage\.wrappedValue == nil else \{ return \}/);
  assert.match(view, /static func dismantleUIView[\s\S]*?coordinator\.invalidate\(\)[\s\S]*?webView\.navigationDelegate = nil[\s\S]*?webView\.stopLoading\(\)/);
  for (const language of ["en", "zh-Hans"]) {
    const strings = read(`ios/DJI4GAssistant/Resources/${language}.lproj/Localizable.strings`);
    for (const key of ["reload_title", "reload_warning", "authorization_failed", "server_error"]) assert.ok(strings.includes(`"console.${key}" =`));
  }
});
