const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("native navigation supplements, rather than removes, every desktop destination", () => {
  const html = read("web/public/index.html");
  for (const view of ["overview", "sms", "calls", "euicc", "network", "atlab", "system"]) {
    assert.ok(html.includes(`data-target="${view}"`));
  }
  assert.ok(html.indexOf('/native-ui.css') > html.indexOf('/desktop-refresh.css'));
  assert.match(html, /id="nativeMoreBtn"[^>]*aria-controls="nativeToolsDialog"[^>]*hidden/);
  assert.match(html, /id="nativeRailLanguageBtn"[^>]*hidden/);
  const css = read("web/public/native-ui.css");
  assert.match(css, /html\.native-companion \.rail/);
  assert.match(css, /@media \(max-width: 719px\)/);
  assert.match(css, /grid-template-columns: repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /grid-auto-flow: row; grid-auto-rows: min-content/);
});

test("viewing any of three EID spaces only selects the matching inventory and never writes", () => {
  const source = read("web/public/app.js");
  const selector = source.slice(source.indexOf("function selectEuicc(eid)"), source.indexOf("async function renameEuicc"));
  const eids = [0, 1, 2].map(n => ({ eid: "89" + String(n).padStart(30, "0"), aid: "aid-" + n }));
  const state = { busy: false, euiccInventory: eids, activeEid: eids[0].eid, activeAid: eids[0].aid, euiccCandidatesChecked: 3 };
  const elements = new Map();
  let renders = 0;
  const context = vm.createContext({ state, nativeCompanion: true, t: key => key,
    document: { activeElement: null, querySelector: key => {
      if (!elements.has(key)) elements.set(key, {});
      return elements.get(key);
    } },
    renderEuiccInventory: value => { assert.equal(value.eids, eids); renders++; },
    fetch: () => { throw new Error("Viewing EID must not send network writes"); },
  });
  vm.runInContext(selector, context);
  for (const entry of [eids[1], eids[2], eids[0]]) {
    context.target = entry.eid;
    vm.runInContext("selectEuicc(target)", context);
    assert.equal(state.activeEid, entry.eid);
    assert.equal(state.activeAid, entry.aid);
    assert.equal(state.discoveryText, "");
    assert.equal(state.notificationText, "");
  }
  assert.equal(renders, 3);
  vm.runInContext('selectEuicc("unknown")', context);
  assert.equal(renders, 3);
  state.busy = true;
  context.target = eids[2].eid;
  vm.runInContext("selectEuicc(target)", context);
  assert.equal(state.activeEid, eids[0].eid);
  assert.equal(renders, 3);
});

test("mobile profile selection keeps escaped labels and original write confirmations", () => {
  const app = read("web/public/app.js");
  const inventory = app.slice(app.indexOf("function renderEuiccInventory"), app.indexOf("function renderChip"));
  assert.match(inventory, /aria-pressed="\$\{selected\}"/);
  assert.match(inventory, /escapeHtml\(label\)/);
  assert.match(inventory, /escapeHtml\(item\.eid\)/);
  assert.match(app, /nativeCompanion && enabled \? "" : `<div class="profile-actions profile-primary-actions">/);
  const action = app.slice(app.indexOf("async function runProfileAction"), app.indexOf("async function deleteProfile"));
  assert.match(action, /confirmOperation/);
  assert.match(action, /const aid = state\.activeAid/);
});

test("native SMS navigation preserves separate reply and new-message drafts without writes", () => {
  const app = read("web/public/app.js");
  const draftFunctions = app.slice(app.indexOf("function smsDraftKey()"), app.indexOf("function setSmsFeedback("));
  const navigation = app.slice(app.indexOf("function selectSmsConversation("), app.indexOf("async function sendSmsMessage("));
  const state = {smsDrafts: new Map(), smsActiveSender: null, smsNewDraft: false, smsText: "", smsConversationOpen: false};
  const elements = new Map();
  let focused = "", detail = false, scrolls = 0;
  const element = key => {
    if (!elements.has(key)) elements.set(key, {value: "", scrollHeight: 100, focus: () => {focused = key;}, classList: {toggle: (name, open) => {assert.equal(name, "native-sms-detail"); detail = open;}}});
    return elements.get(key);
  };
  const threads = ["+447700900123", "+447700900124"].map(number => ({dataset: {smsThread: number}, focus: () => {focused = number;}}));
  const context = vm.createContext({state, nativeCompanion: true,
    document: {querySelector: element, querySelectorAll: selector => selector === "[data-sms-thread]" ? threads : []},
    updateSmsComposer() {}, setSmsFeedback() {}, renderSms() {}, resetViewScroll() {scrolls++;},
    fetch() {throw new Error("SMS navigation must not send requests");},
  });
  vm.runInContext(draftFunctions + navigation, context);
  vm.runInContext('selectSmsConversation("+447700900123")', context);
  assert.equal(detail, true);
  assert.equal(focused, "#smsConversationTitle", "Reading should not open the soft keyboard");
  element("#smsMessageInput").value = "reply draft";
  vm.runInContext('returnToSmsThreads(); selectSmsConversation("+447700900124")', context);
  assert.equal(element("#smsMessageInput").value, "");
  element("#smsMessageInput").value = "another reply";
  vm.runInContext('returnToSmsThreads(); selectSmsConversation("+447700900123")', context);
  assert.equal(element("#smsMessageInput").value, "reply draft");
  vm.runInContext('returnToSmsThreads(); selectSmsConversation(null)', context);
  assert.equal(focused, "#smsNumberInput");
  element("#smsNumberInput").value = "+447700900125";
  element("#smsMessageInput").value = "new draft";
  vm.runInContext('returnToSmsThreads(); selectSmsConversation(null)', context);
  assert.equal(element("#smsNumberInput").value, "+447700900125");
  assert.equal(element("#smsMessageInput").value, "new draft");
  vm.runInContext('returnToSmsThreads()', context);
  assert.equal(detail, false);
  assert.equal(focused, "#newSmsBtn");
  assert.ok(scrolls > 0);
  context.nativeCompanion = false;
  vm.runInContext('selectSmsConversation("+447700900124")', context);
  assert.equal(focused, "#smsMessageInput", "Desktop reply behavior is preserved");
});

test("native SMS returns to the list on a card change and keeps navigation available while busy", () => {
  const app = read("web/public/app.js");
  const clear = app.slice(app.indexOf("function clearCardView()"), app.indexOf("function setBusy("));
  assert.match(clear, /state\.smsDrafts\.clear\(\)/);
  assert.match(clear, /setNativeSmsPane\(false\)/);
  const busy = app.slice(app.indexOf("function setBusy("), app.indexOf("function append("));
  assert.match(busy, /#nativeSmsBackBtn/);
  const css = read("web/public/native-ui.css");
  assert.match(css, /#sms:not\(\.native-sms-detail\) \.sms-conversation \{ display: none; \}/);
  assert.match(css, /#sms\.native-sms-detail \.sms-threads-panel/);
  assert.match(css, /grid-column: auto; grid-row: auto/);
});

test("companion mode cannot mistake loopback preview for a Windows audio host", () => {
  const app = read("web/public/app.js");
  const expression = app.match(/const localAudioBridgeHost = (.+);/)[1];
  for (const hostname of ["localhost", "127.0.0.1", "192.0.2.20"]) {
    assert.equal(vm.runInNewContext(expression, {nativeCompanion: true, location: {hostname}}), false);
  }
  assert.equal(vm.runInNewContext(expression, {nativeCompanion: false, location: {hostname: "localhost"}}), true);
});
