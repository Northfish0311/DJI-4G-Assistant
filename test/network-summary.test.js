const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../web/public/app.js"), "utf8");

function summaryHarness() {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { textContent: "", dataset: {}, classList: {
        toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
        contains: (name) => classes.has(name),
      } });
    }
    return elements.get(id);
  };
  element('.nav-btn[data-target="overview"]').classList.toggle("active", true);
  const context = vm.createContext({
    URL, Map, AbortController,
    localStorage: { getItem: () => "zh" }, navigator: { language: "zh" },
    document: { hidden: false, querySelector: element },
    portInput: {}, carrierValue: element("#carrierValue"), radioValue: element("#radioValue"),
    connectionBadge: element("#connectionBadge"), renderConnectionState: () => {},
    fetchJson: async () => ({ ok: true, stdout: "+CEREG: 0,1" }),
  });
  vm.runInContext([
    source.slice(source.indexOf("const copy ="), source.indexOf("function applyLanguage()")),
    source.slice(source.indexOf("function registrationLabel("), source.indexOf("function escapeHtml(")),
    source.slice(source.indexOf("function parseAtCsv("), source.indexOf("function decodeSmsBody(")),
    source.slice(source.indexOf("function formatBytes("), source.indexOf("function smsStatus(")),
    source.slice(source.indexOf("async function refreshModuleStatusQuietly()"), source.indexOf("async function openPairingDialog()")),
  ].join("\n"), context);
  const api = vm.runInContext("({ state, updateSummary, renderSummary, refreshModuleStatusQuietly, renderTraffic })", context);
  return { ...api, context, element, text: (id) => element(id).textContent };
}

function trafficSample(overrides = {}) {
  return JSON.stringify({ name: "USB 4G", description: "Quectel ECM Adapter", interfaceIndex: 9,
    status: "Up", statisticsSource: "windows-performance", statisticsReliable: true,
    receivedBytes: 1000, sentBytes: 500, sampledAt: 10000, ...overrides });
}

test("traffic speed waits for two samples, uses byte deltas and survives a language rerender", () => {
  const ui = summaryHarness();
  ui.renderTraffic(trafficSample());
  assert.equal(ui.text("#trafficRxRate"), "--");
  assert.equal(ui.text("#trafficStatus"), "正在采样速度…");
  const second = trafficSample({ sampledAt: 12000, receivedBytes: 5096, sentBytes: 2548 });
  ui.renderTraffic(second);
  assert.equal(ui.text("#trafficRxRate"), "2.00 KB/s");
  assert.equal(ui.text("#trafficTxRate"), "1.00 KB/s");
  assert.equal(ui.text("#trafficRxSession"), "4.00 KB");
  ui.state.language = "en";
  ui.renderTraffic(second);
  assert.equal(ui.text("#trafficRxRate"), "2.00 KB/s");
  assert.equal(ui.text("#trafficStatus"), "Live USB adapter statistics");
});

test("traffic resets without spikes on source changes, disconnects or counter resets", () => {
  for (const changes of [
    { statisticsSource: "adapter" }, { interfaceIndex: 12 }, { receivedBytes: 2000 }, { sentBytes: 1000 },
  ]) {
    const ui = summaryHarness();
    ui.renderTraffic(trafficSample());
    ui.renderTraffic(trafficSample({ sampledAt: 12000, receivedBytes: 5096, sentBytes: 2548 }));
    ui.renderTraffic(trafficSample({ sampledAt: 14000, receivedBytes: 6096, sentBytes: 3548, ...changes }));
    assert.equal(ui.text("#trafficRxRate"), "--");
    assert.equal(ui.text("#trafficRxSession"), "0 B");
  }
  const ui = summaryHarness();
  ui.renderTraffic(trafficSample());
  ui.renderTraffic("[]");
  assert.equal(ui.state.trafficBaseline, null);
  assert.equal(ui.text("#trafficRxSession"), "--");
  ui.renderTraffic(trafficSample({ sampledAt: 14000 }));
  assert.equal(ui.text("#trafficRxRate"), "--");
});

test("unavailable counters display an explicit reason instead of a false zero", () => {
  const ui = summaryHarness();
  ui.renderTraffic(trafficSample({ statisticsReliable: false }));
  assert.equal(ui.text("#trafficRxRate"), "--");
  assert.equal(ui.text("#trafficRxSession"), "--");
  assert.equal(ui.text("#trafficStatus"), "此网卡暂未返回有效流量计数。");
  ui.renderTraffic(trafficSample({ receivedBytes: null }));
  assert.equal(ui.text("#trafficRxRate"), "--");
});

test("actual zero-address response never claims cellular connectivity", () => {
  const ui = summaryHarness();
  ui.updateSummary('+CPIN: READY\n+COPS: 0\n+CEREG: 0,3\n+CSQ: 99,99\n+QNWINFO: No Service\n+CGPADDR: 1,"0.0.0.0,0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0"');
  assert.equal(ui.state.moduleIp, "");
  assert.equal(ui.text("#connectionBadge"), "注册被拒绝");
  assert.equal(ui.text("#carrierValue"), "未知");
  assert.equal(ui.text("#signalValue"), "未知");
  assert.equal(ui.text("#radioValue"), "无服务");
  assert.equal(ui.element("#connectionBadge").classList.contains("online"), false);
});

test("home and roaming registration are distinct from searching and denied", () => {
  for (const code of ["0", "1", "2", "3", "4", "5"]) {
    const ui = summaryHarness();
    ui.updateSummary(`+CEREG: 0,${code}\n+CGPADDR: 1,"10.20.30.40"`);
    assert.equal(ui.element("#connectionBadge").classList.contains("online"), ["1", "5"].includes(code));
    if (!["1", "5"].includes(code)) assert.doesNotMatch(ui.text("#connectionBadge"), /^已注册/);
  }
});

test("losing service clears the old IP and operator", () => {
  const ui = summaryHarness();
  ui.updateSummary('+CEREG: 0,5\n+COPS: 0,0,"Example"\n+CGPADDR: 1,"10.20.30.40"');
  assert.equal(ui.text("#carrierValue"), "Example");
  assert.equal(ui.element("#connectionBadge").classList.contains("online"), true);
  ui.updateSummary("+CEREG: 0,2\n+COPS: 0\n+QNWINFO: No Service");
  assert.equal(ui.state.moduleIp, "");
  assert.equal(ui.text("#carrierValue"), "未知");
  assert.equal(ui.element("#connectionBadge").classList.contains("online"), false);
});

test("reads dual-stack addresses without joining zero placeholders into the IP", () => {
  for (const payload of ['"10.20.30.40","::"', '"10.20.30.40,0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0"']) {
    const ui = summaryHarness();
    ui.updateSummary(`+CEREG: 0,1\n+CGPADDR: 1,${payload}`);
    assert.equal(ui.state.moduleIp, "10.20.30.40");
  }
  const ui = summaryHarness();
  ui.updateSummary('+CEREG: 0,1\n+CGPADDR: 1,"0.0.0.0","32.1.13.184.0.0.0.0.0.0.0.0.0.0.0.1"');
  assert.equal(ui.state.moduleIp, "2001:db8::1");
  ui.updateSummary('+CGPADDR: 1,"999.1.1.1","not-an-ip"');
  assert.equal(ui.state.moduleIp, "");
});

test("valid address without registration evidence is not labeled online", () => {
  const ui = summaryHarness();
  ui.updateSummary('+CGPADDR: 1,"10.20.30.40"');
  assert.equal(ui.text("#connectionBadge"), "已获得 IP · 10.20.30.40");
  assert.equal(ui.element("#connectionBadge").classList.contains("online"), false);
});

test("numeric operator and signal limits render without confusing COPS mode for a carrier", () => {
  const ui = summaryHarness();
  ui.updateSummary('+COPS: 0,2,"46001",7\n+CSQ: 0,99');
  assert.equal(ui.text("#carrierValue"), "46001");
  assert.equal(ui.text("#signalValue"), "0/31");
  ui.updateSummary("+CSQ: 31,99");
  assert.equal(ui.text("#signalValue"), "31/31");
  ui.state.language = "en";
  ui.updateSummary("+CEREG: 0,3\n+CSQ: 99,99\n+QNWINFO: No Service");
  assert.equal(ui.text("#signalValue"), "Unknown");
  assert.equal(ui.text("#connectionBadge"), "Registration denied");
});

test("overview polling shares one pending read and discards results after a card change", async () => {
  const ui = summaryHarness();
  ui.state.atPort = "COM5";
  let finish, calls = 0;
  ui.context.fetchJson = () => { calls++; return new Promise((resolve) => { finish = resolve; }); };
  const pending = ui.refreshModuleStatusQuietly();
  await ui.refreshModuleStatusQuietly();
  assert.equal(calls, 1);
  ui.state.cardEpoch++;
  finish({ ok: true, stdout: '+CEREG: 0,1\n+CGPADDR: 1,"10.20.30.40"' });
  await pending;
  assert.equal(ui.state.moduleIp, "");
  assert.equal(ui.state.overviewRefreshInFlight, false);
});

test("failed overview refresh cannot leave a stale green connected badge", async () => {
  const ui = summaryHarness();
  ui.state.atPort = "COM5";
  ui.updateSummary('+CEREG: 0,1\n+CGPADDR: 1,"10.20.30.40"');
  ui.context.fetchJson = async () => ({ ok: false });
  await ui.refreshModuleStatusQuietly();
  assert.equal(ui.text("#connectionBadge"), "网络状态待确认");
  assert.equal(ui.element("#connectionBadge").classList.contains("online"), false);
  ui.context.fetchJson = async () => ({ ok: true, stdout: "+CEREG: 0,3" });
  await ui.refreshModuleStatusQuietly();
  assert.equal(ui.text("#connectionBadge"), "注册被拒绝");
});

test("overview reads pause for calls, writes, hidden pages and inactive overview", async () => {
  for (const mode of ["busy", "call", "hidden", "inactive"]) {
    const ui = summaryHarness();
    ui.state.atPort = "COM5";
    if (mode === "busy") ui.state.busy = true;
    if (mode === "call") ui.state.callStatusData = { voiceCalls: [{}] };
    if (mode === "hidden") ui.context.document.hidden = true;
    if (mode === "inactive") ui.element('.nav-btn[data-target="overview"]').classList.toggle("active", false);
    ui.context.fetchJson = () => { assert.fail("Unexpected module read"); };
    await ui.refreshModuleStatusQuietly();
    assert.equal(ui.state.overviewRefreshInFlight, false);
  }
});
