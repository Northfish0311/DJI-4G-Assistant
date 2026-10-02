const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../web/public/app.js"), "utf8");
const payload = `"><img src=x onerror="window.injected=1"><script>window.injected=1</script>&'`;

function harness(nativeCompanion = false) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent: "", innerHTML: "", value: "", dataset: {}, querySelectorAll: () => [] });
    return elements.get(id);
  };
  const context = vm.createContext({
    nativeCompanion, window: {},
    Map, localStorage: { getItem: () => "en" }, navigator: { language: "en" },
    document: { querySelector: element },
    renderSmsStorage: () => {}, parseSmsStorageText: () => null, updateSmsComposer: () => {}, renderSmsRefreshState: () => {},
  });
  const fragment = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
  vm.runInContext([
    fragment("const copy =", "function applyLanguage()"),
    fragment("function escapeHtml(", "function formatBytes("),
    fragment("function smsStatus(", "function parseSmsStorageText("),
    fragment("function normalizePhone(", "function parseDialInput("),
    fragment("function renderSms(", "function selectSmsConversation("),
    fragment("function callStateText(", "function rememberCall("),
    fragment("function renderCallHistory(", "function setVoiceStep("),
  ].join("\n"), context);
  context.renderActiveEuicc = () => {};
  return { context, state: vm.runInContext("state", context), html: id => element(id).innerHTML };
}

function escaped(html) {
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("<script>"));
}

for (const nativeCompanion of [false, true]) {
const surface = nativeCompanion ? "native" : "desktop";
test(`${surface}: eUICC names and EID attributes escape external markup`, () => {
  const ui = harness(nativeCompanion);
  ui.context.renderEuiccInventory({ eids: [{ eid: payload, aid: "test", label: payload, profiles: [] }] });
  escaped(ui.html("#euiccInventory"));
  assert.ok(ui.html("#euiccInventory").includes(`${nativeCompanion ? "data-euicc-select" : "title"}="&quot;&gt;&lt;img`));
});

test(`${surface}: profile text, identifiers and nickname inputs escape external markup`, () => {
  const ui = harness(nativeCompanion);
  ui.context.renderProfileItems([{ iccid: payload, profileNickname: payload, serviceProviderName: payload, profileClass: payload }]);
  escaped(ui.html("#profilesList"));
  assert.ok(ui.html("#profilesList").includes('value="&quot;&gt;&lt;img'));
  assert.ok(ui.html("#profilesList").includes('data-profile-id="&quot;&gt;&lt;img'));
});

test(`${surface}: notification fields escape external markup`, () => {
  const ui = harness(nativeCompanion);
  ui.context.renderNotifications(JSON.stringify({ payload: { data: [{ profileManagementOperation: payload, notificationAddress: payload, iccid: payload }] } }));
  escaped(ui.html("#notificationsList"));
});

test(`${surface}: SMS previews and message bodies escape external markup`, () => {
  const ui = harness(nativeCompanion);
  ui.context.renderSms(`+CMGL: 1,"REC READ","+447700900123","","26/09/28"\r\n${payload}\r\nOK`);
  escaped(ui.html("#smsThreads"));
  escaped(ui.html("#smsList"));
});

test(`${surface}: call numbers and direction attributes escape external markup`, () => {
  const ui = harness(nativeCompanion);
  ui.state.callHistory = [{ observedAt: "2026-09-28T00:00:00Z", number: payload, direction: payload, state: "disconnected" }];
  ui.context.renderCallHistory();
  escaped(ui.html("#callHistory"));
  assert.ok(ui.html("#callHistory").includes('call-history-direction &quot;&gt;&lt;img'));
});
}
