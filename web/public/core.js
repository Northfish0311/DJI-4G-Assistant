const launchParameters = new URLSearchParams(location.search);
const nativePlatform = launchParameters.get("native");
const nativeCompanion = nativePlatform === "ios" || nativePlatform === "android";
if (nativeCompanion) document.documentElement.classList.add("native-companion", "native-" + nativePlatform);

const output = document.querySelector("#output");
const statusPill = document.querySelector("#statusPill");
const hostLine = document.querySelector("#hostLine");
const portInput = document.querySelector("#portInput");
const tokenInput = document.querySelector("#tokenInput");
const languageBtn = document.querySelector("#languageBtn");
const pairIosBtn = document.querySelector("#pairIosBtn");
const pairingDialog = document.querySelector("#pairingDialog");
const pairingQr = document.querySelector("#pairingQr");
const pairingQrPlaceholder = document.querySelector("#pairingQrPlaceholder");
const pairingUrl = document.querySelector("#pairingUrl");
const pairingStatus = document.querySelector("#pairingStatus");
const retryPairingBtn = document.querySelector("#retryPairingBtn");
const copyPairingBtn = document.querySelector("#copyPairingBtn");
let pairingDeepLink = "";
let pairingRequest = null;
const carrierValue = document.querySelector("#carrierValue");
const radioValue = document.querySelector("#radioValue");
const connectionBadge = document.querySelector("#connectionBadge");




const state = {
  profileFilters: new Map(), profileDrafts: new Map(), profileDetailsOpen: new Set(), smsPendingKeys: new Set(),
  automaticCallAudioEnabled: localStorage.getItem("callAutomaticAudio") !== "0", callCapabilityRefresh: null,
  viewScrollPositions: new Map(), trafficLastRead: 0, trafficReadError: false, trafficFailureCount: 0, trafficRetryAfter: 0,
  logEntries: [], logCharacters: 0, logFollow: true, logPending: 0, logDropped: false, logCopying: false, logActionKey: "", logOpenViews: new Map(), atFeedback: null,
  overviewRefreshInFlight: false, moduleReadError: false,
  smsDrafts: new Map(), smsSentThisSession: [], cardEpoch: 0, smsSending: false, smsRefreshing: false, smsLastRead: 0, smsReadError: false, confirming: false, failedViews: new Set(),
  language: localStorage.getItem("uiLanguage") || (navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"),
  smsActiveSender: null, smsQuery: "", smsNewDraft: false, smsStorage: null, smsConversationOpen: false,
  authRequired: false, dangerousAtEnabled: false, profileActionsEnabled: false, profileDownloadEnabled: false, profileNicknameEnabled: false, profileNotificationsEnabled: false, profileDeleteEnabled: false, smsSendEnabled: false, smsDeleteEnabled: false, callActionsEnabled: false, ussdEnabled: false, usbModeEnabled: false, stockBootstrapEnabled: false, driverInstallEnabled: false, voiceRuntimeEnabled: false, smsPolling: false, callMonitoring: false, callRefreshInFlight: false, callActionInFlight: false, trafficRefreshInFlight: false, busy: false, busyKey: "running", busyParams: {},
  primaryUrl: "", euiccInventory: [], euiccCandidatesChecked: 0, activeEid: "", activeAid: "", inventoryLoaded: false, chipText: "", discoveryText: "", profileText: "", notificationText: "", smsText: "", networkText: "", callStatusData: null, callCapabilityData: null, voiceRuntimeStatus: null, voiceSetupBusy: false, callHistory: [], lastCallKey: "", lastVoiceCall: null, pendingPostDial: null, postDialRunning: false, postDialGeneration: 0, postDialAbortController: null, audioBridge: null, audioBridgeStarting: false, usb: "", atPort: "", networkKind: "", moduleIp: "", sim: "", signal: "", carrier: "", radio: "", registrationCode: "", deviceModel: "", deviceRevision: "", temperature: null, temperatureSensors: [], temperatureSupported: null, trafficPrevious: null, trafficBaseline: null, autoLoadedViews: new Set(),
};

function t(key, params = {}) {
  const languageCopy = copy[state.language] || copy.en;
  return String(languageCopy[key] || copy.en[key] || key).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
}

function applyLanguage() {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.title = t("title");
  for (const element of document.querySelectorAll("[data-i18n-aria]")) element.setAttribute("aria-label", t(element.dataset.i18nAria));
  document.querySelector("nav[aria-label]").setAttribute("aria-label", state.language === "zh" ? "分区" : "Sections");
  for (const element of document.querySelectorAll("[data-i18n]")) element.textContent = t(element.dataset.i18n);
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) element.placeholder = t(element.dataset.i18nPlaceholder);
  languageBtn.textContent = state.language === "zh" ? t("switchToEnglish") : t("switchToChinese");
  document.querySelector("#nativeLanguageBtn span").textContent = languageBtn.textContent;
  document.querySelector("#nativeRailLanguageBtn span").textContent = languageBtn.textContent;
  pairingQr.alt = t("pairingQrAlt");
  document.querySelector("#closePairingBtn").setAttribute("aria-label", t("close"));
  document.querySelector("#closePairingBtn").title = t("close");
  renderConnectionState();
  hostLine.textContent = state.primaryUrl ? t(state.accessMode === "local" ? "localConsoleUrl" : state.pairingAvailable === false ? "noLanConsoleUrl" : "ipadUrl", { url: state.primaryUrl }) : t("hostLocal");
  updateProfileHint();
  renderSummary();
  if (state.inventoryLoaded) renderEuiccInventory({ eids: state.euiccInventory, candidatesChecked: state.euiccCandidatesChecked });
  else if (state.chipText) renderChip(state.chipText);
  if (state.discoveryText) renderDiscovery(state.discoveryText);
  if (state.profileText && !state.inventoryLoaded) renderProfiles(state.profileText);
  if (state.notificationText) renderNotifications(state.notificationText);
  renderSms(state.smsText);
  document.querySelector("#smsSearchInput").setAttribute("aria-label", t("searchMessages"));
  document.querySelector("#dialBackspaceBtn").setAttribute("aria-label", state.language === "zh" ? "退格" : "Backspace");
  document.querySelector("#dialBackspaceBtn").title = state.language === "zh" ? "退格" : "Backspace";
  if (state.networkText) renderTraffic(state.networkText, false);
  renderTrafficSyncState();
  renderLogControls(); renderAtFeedback();
  if (state.callStatusData) {
    const readError = state.callStatusReadError;
    renderCallStatus(state.callStatusData);
    state.callStatusReadError = readError;
  }
  if (state.callCapabilityData) renderCallCapabilities(state.callCapabilityData);
  if (state.voiceRuntimeStatus) renderVoiceSetup(state.voiceRuntimeStatus);
  renderCallHistory();
  syncCallButtons(); renderSmsRefreshState(); updateSmsComposer();
  if (state.smsFeedback) setSmsFeedback(state.smsFeedback.key, state.smsFeedback.tone, state.smsFeedback.params);
  document.querySelector("#callNumberInput").setAttribute("aria-label", t("callNumberLabel"));
  refreshAudioDeviceOptions(false).catch(() => {});
  window.refreshDesktopIcons?.();
}

function showFeedback(message, tone = "neutral", view) {
  if (view && document.querySelector(".view.active")?.id !== view) return;
  clearTimeout(state.feedbackTimer);
  const element = document.querySelector("#operationFeedback");
  document.querySelector("#operationFeedbackText").textContent = message;
  element.dataset.tone = tone; element.hidden = !message;
  if (message && tone === "success") state.feedbackTimer = setTimeout(() => {element.hidden = true;}, 5000);
}

function clearCardView() {
  state.profileFilters.clear(); state.profileDrafts.clear(); state.profileDetailsOpen.clear(); state.smsPendingKeys.clear();
  const profileList = document.querySelector("#profilesList");
  profileList.replaceChildren(); delete profileList.dataset.markup;
  state.cardEpoch += 1; state.smsDrafts.clear(); state.smsSentThisSession = []; state.smsLastRead = 0; state.smsReadError = false; state.failedViews.clear(); setSmsFeedback(null);
  state.activeEid = ""; state.activeAid = ""; state.euiccProbes = [];
  state.euiccCandidatesChecked = 0;
  state.autoLoadedViews.delete("euicc"); state.autoLoadedViews.delete("sms"); state.autoLoadedViews.delete("calls");
  state.chipText = ""; state.profileText = ""; state.discoveryText = ""; state.notificationText = "";
  state.smsText = ""; state.sim = ""; state.carrier = ""; state.radio = ""; state.moduleIp = ""; state.registrationCode = ""; state.signal = ""; state.moduleReadError = false;
  state.temperature = null; state.temperatureSensors = []; state.temperatureSupported = null;
  state.voiceNetwork = null; state.voiceSetupFeedback = null; state.callCapabilityData = null; state.voiceRuntimeStatus = null;
  state.callStatusData = null; state.callStatusReadError = true; state.lastVoiceCall = null;
  state.automaticCallAudio = null; state.callEndReadGeneration = (state.callEndReadGeneration || 0) + 1;
  if (state.audioBridge || state.audioBridgeStarting) stopAudioBridge();
  state.postDialGeneration += 1; state.postDialAbortController?.abort(); state.postDialAbortController = null; state.pendingPostDial = null; state.postDialRunning = false;
  state.cardSignature = null;
  state.networkKind = "";
  renderEuiccInventory({ eids: [], probes: [], candidatesChecked: 0 });
  state.smsActiveSender = null; state.smsQuery = ""; state.smsNewDraft = false; state.smsStorage = null;
  setNativeSmsPane(false);
  for (const id of ["smsNumberInput", "smsMessageInput", "smsSearchInput"]) document.getElementById(id).value = "";
  renderSms("");
  document.querySelector("#smsCount").textContent = "0";
  document.querySelector("#smsStorageWarning").hidden = true;
  document.querySelector("#notificationsList").textContent = t("noNotifications");
  document.querySelector("#pendingProfileCount").textContent = "--";
  renderSummary();
}

function setBusy(isBusy, labelKey = "running", params = {}) {
  state.busy = isBusy; state.busyKey = labelKey; state.busyParams = params;
  renderConnectionState();
  statusPill.classList.toggle("busy", isBusy);
  for (const button of document.querySelectorAll("button")) {
    if (button.matches(".nav-btn, [data-open-view], #languageBtn, #nativeMoreBtn, #nativeLanguageBtn, #nativeRailLanguageBtn, #nativeSmsBackBtn, #newSmsBtn, #smsPollingBtn, #smsNewMessagesBtn, #clearProfileSearchBtn, #clearSmsSearchBtn, [data-sms-thread], [data-copy-code], #dismissFeedbackBtn") || button.closest("#actionConfirmDialog, #nativeToolsDialog")) {button.disabled = false; continue;}
    if (button.closest(".log-actions, #calls, #pairingDialog")) continue;
    button.disabled = button.dataset.profileAction ? isBusy || !state.profileActionsEnabled
      : button.dataset.profileDownload ? isBusy || !state.profileDownloadEnabled
        : button.dataset.profileNickname ? isBusy || !state.profileNicknameEnabled
          : button.dataset.profileNotifications ? isBusy || !state.profileNotificationsEnabled
            : button.dataset.profileDelete ? isBusy || !state.profileDeleteEnabled
              : button.dataset.smsSend ? isBusy || !state.smsSendEnabled
                : button.dataset.smsDelete ? isBusy || !state.smsDeleteEnabled
                  : button.dataset.callAction ? isBusy || !state.callActionsEnabled
                  : button.dataset.ussd ? isBusy || !state.ussdEnabled
                  : button.dataset.usbMode ? isBusy || !state.usbModeEnabled
                    : button.dataset.driverInstall ? isBusy || !state.driverInstallEnabled || button.dataset.driverEligible !== "1" || button.dataset.driverReady === "1"
                      : button.dataset.euiccSelect ? isBusy || (!nativeCompanion && button.dataset.euiccSelect === state.activeEid) : isBusy;
    if (button.dataset.stockAction) button.disabled = isBusy || !state.stockBootstrapEnabled;
  }
  syncCallButtons(); updateSmsComposer(); renderCallGuidance();
  if (!isBusy) queueMicrotask(ensureCurrentViewLoaded);
}

function append(title, text) {
  const stamp = new Date().toLocaleTimeString();
  let entry = `[${stamp}] ${title}\n${text || "(no output)"}\n`;
  if (entry.length > 24000) entry = entry.slice(0, 24000) + `\n${t("logTruncated")}\n`;
  const top = output.scrollTop;
  const node = document.createElement("span");
  node.className = "log-entry";
  node.textContent = entry;
  output.append(node);
  state.logEntries.push(node); state.logCharacters += entry.length;
  const heightBeforeTrim = output.scrollHeight;
  // Bound both DOM size and text size without rebuilding entries being read.
  while (state.logEntries.length > 200 || state.logCharacters > 200000) {
    const removed = state.logEntries.shift();
    state.logCharacters -= removed.textContent.length;
    removed.remove(); state.logDropped = true;
  }
  if (state.logFollow) output.scrollTop = output.scrollHeight;
  else {
    output.scrollTop = Math.max(0, top - (heightBeforeTrim - output.scrollHeight));
    state.logPending += 1;
  }
  renderLogControls();
}

function renderLogControls() {
  document.querySelector("#logFollowInput").checked = state.logFollow;
  document.querySelector("#logCount").textContent = t(state.logDropped ? "logLimited" : "logCount", {count: state.logEntries.length});
  document.querySelector("#logReadState").textContent = t(state.logFollow ? "logLive" : state.logPending ? "logPending" : "logPaused", {count: state.logPending});
  document.querySelector("#logReadState").dataset.tone = state.logPending ? "pending" : "normal";
  document.querySelector("#logActionStatus").textContent = state.logActionKey ? t(state.logActionKey) : "";
  document.querySelector("#logEmpty").hidden = state.logEntries.length > 0;
  document.querySelector("#clearBtn").disabled = state.logEntries.length === 0;
  document.querySelector("#copyLogBtn").disabled = state.logCopying || state.logEntries.length === 0;
  document.querySelector("#logLatestBtn").disabled = state.logFollow || state.logEntries.length === 0;
}

function followLatestLog() {
  state.logFollow = true; state.logPending = 0;
  output.scrollTop = output.scrollHeight;
  renderLogControls();
}

function clearLog() {
  output.replaceChildren();
  state.logEntries = []; state.logCharacters = 0; state.logDropped = false;
  state.logActionKey = "";
  followLatestLog();
}

async function copyLog() {
  if (state.logCopying || !state.logEntries.length) return;
  state.logCopying = true; state.logActionKey = ""; renderLogControls();
  try { await navigator.clipboard.writeText(output.textContent); state.logActionKey = "logCopied"; }
  catch { state.logActionKey = "logCopyFailed"; }
  finally { state.logCopying = false; renderLogControls(); }
}

function renderAtFeedback() {
  const element = document.querySelector("#atFeedback");
  const feedback = state.atFeedback;
  element.textContent = t(feedback?.key || "atReady", {command: feedback?.command || ""});
  element.dataset.tone = feedback?.tone || "neutral";
}

function actionTitle(action) {
  return ({ "device-check": t("deviceCheck"), "find-at": t("findAt"), "module-status": t("moduleStatus"), "module-temperature": t("moduleTemperature"), "euicc-inventory": t("esimLibrary"), "lpac-chip": t("euiccInfo"), "lpac-discovery": t("checkPendingProfiles"), "lpac-profiles": t("esimProfiles"), "lpac-notifications": t("profileNotifications"), "sms-list": t("readSms"), "call-status": t("callStatus"), "call-capabilities": t("callCapabilities"), "windows-network": t("windowsNetwork"), "network-traffic": t("networkTraffic"), "stock-module-probe": t("stockProbe"), baseline: t("baseline"), health: t("connection"), ports: t("ports") }[action] || action);
}

function apiHeaders(extra = {}) {
  const token = tokenInput.value.trim();
  return { ...extra, ...(token ? { "x-console-token": token } : {}) };
}

function textFromResult(data) { return [data.stdout, data.stderr, data.error].filter(Boolean).join("\n"); }

function registrationLabel(code) {
  const key = ({ "1": "registrationHome", "5": "registrationRoaming", "2": "registrationSearching", "3": "registrationDenied", "0": "registrationUnknown", "4": "registrationUnknown" })[String(code || "")];
  return key ? t(key) : "";
}

function renderSummary() {
  const registration = registrationLabel(state.registrationCode);
  const registered = ["1", "5"].includes(state.registrationCode);
  const noService = /no service/i.test(state.radio);
  const connected = registered && !noService && Boolean(state.moduleIp) && !state.moduleReadError;
  document.querySelector("#vidPid").textContent = state.usb || t("unknown");
  document.querySelector("#atPort").textContent = state.atPort || t("unknown");
  document.querySelector("#signalValue").textContent = state.signal && Number(state.signal) <= 31 ? `${state.signal}/31` : t("unknown");
  document.querySelector("#simState").textContent = state.sim || t("unknown");
  carrierValue.textContent = state.carrier || t("unknown");
  radioValue.textContent = noService ? t("noService") : state.radio || t("unknown");
  const temperatureValue = document.querySelector("#temperatureValue");
  temperatureValue.textContent = Number.isFinite(state.temperature) ? `${state.temperature} °C` : state.temperatureSupported === false ? t("unsupported") : "--";
  temperatureValue.dataset.tone = Number.isFinite(state.temperature) && state.temperature >= 80 ? "hot" : Number.isFinite(state.temperature) && state.temperature >= 65 ? "warm" : "normal";
  temperatureValue.title = state.temperatureSensors.map((sensor) => `${sensor.name}: ${sensor.valueC} °C`).join("\n");
  document.querySelector("#deviceTitle").textContent = state.deviceModel || t("waitingScan");
  document.querySelector("#deviceSubtitle").textContent = state.deviceRevision ? t("revision", { value: state.deviceRevision }) : t("insertScan");
  document.querySelector("#netState").textContent = state.moduleReadError ? t("networkStatusUnavailable") : registration || (state.networkKind === "disconnected" ? t("adapterDisconnected") : state.networkKind === "present" ? t("adapterPresent") : t("unknown"));
  const status = state.moduleReadError ? t("networkStatusUnavailable") : connected ? `${t("cellularConnected")} · ${state.moduleIp}` : registration ? registered ? `${t("registered")} · ${registration}` : registration : noService ? t("noService") : state.moduleIp ? `${t("addressAssigned")} · ${state.moduleIp}` : t("noNetwork");
  connectionBadge.textContent = status;
  connectionBadge.classList.toggle("online", connected);
  connectionBadge.classList.toggle("registered", registered && !connected && !state.moduleReadError);
  renderConnectionState();
}

function updateTemperature(data) {
  if (!data || !Object.hasOwn(data, "temperature")) return;
  const temperature = data.temperature;
  if (temperature && Number.isFinite(Number(temperature.maxC))) {
    state.temperature = Number(temperature.maxC);
    state.temperatureSensors = Array.isArray(temperature.sensors) ? temperature.sensors : [];
    state.temperatureSupported = true;
  } else {
    state.temperature = null;
    state.temperatureSensors = [];
    state.temperatureSupported = false;
  }
  renderSummary();
}

function updateSummary(text) {
  const at = text.match(/AT_PORT=(COM\d+)/i) || text.match(/Quectel USB AT Port \((COM\d+)\)/i);
  if (at) { state.atPort = at[1].toUpperCase(); portInput.value = state.atPort; state.usb = t("quectelDetected"); }
  if (/Baiwang[\s\S]*QDC507/i.test(text) && /QCFG.*usbnet.*1/i.test(text)) state.usb = "2C7C:0125";
  if (/Quectel Wireless Ethernet Adapter/i.test(text)) state.networkKind = /Disconnected/i.test(text) ? "disconnected" : "present";
  const cpin = text.match(/\+CPIN:\s*([^\r\n]+)/), cereg = text.match(/\+CEREG:\s*([^\r\n]+)/), cops = text.match(/\+COPS:\s*([^\r\n]+)/), qnwinfo = text.match(/\+QNWINFO:\s*([^\r\n]+)/);
  if (cpin) state.sim = cpin[1].trim();
  if (cereg) {
    const registrationFields = cereg[1].split(",").map((field) => field.trim());
    state.registrationCode = registrationFields.length > 1 ? registrationFields[1] : registrationFields[0];
    state.moduleReadError = false;
  }
  if (cops) {
    state.carrier = parseAtCsv(cops[1])[2] || "";
  }
  if (qnwinfo) {
    const fields = [...qnwinfo[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    state.radio = fields.filter((field, index) => index === 0 || /BAND|NR5G|LTE/i.test(field)).join(" / ") || fields[0] || qnwinfo[1].trim();
  }
  const csq = text.match(/\+CSQ:\s*(\d+)/); if (csq) state.signal = csq[1];
  const temperatures = [...text.matchAll(/\+QTEMP:\s*"([^"]+)"\s*,\s*(-?\d+(?:\.\d+)?)/gi)]
    .map((match) => ({ name: match[1], valueC: Number(match[2]) }))
    .filter((sensor) => Number.isFinite(sensor.valueC) && sensor.valueC >= -50 && sensor.valueC <= 150);
  if (temperatures.length) {
    state.temperatureSensors = temperatures;
    state.temperature = Math.max(...temperatures.map((sensor) => sensor.valueC));
    state.temperatureSupported = true;
  }
  const model = text.match(/Baiwang[\s\S]*?QDC507[\s\S]*?Revision:\s*([^\r\n]+)/i);
  if (model) { state.deviceModel = "Baiwang / QDC507"; state.deviceRevision = model[1].trim(); }
  const ip = text.match(/\+CGPADDR:\s*1\s*,([^\r\n]*)/);
  if (ip) state.moduleIp = parseAtCsv(ip[1]).flatMap((field) => field.split(",")).map(normalizeModuleAddress).filter(Boolean).join(" / ");
  if ((state.registrationCode && !["1", "5"].includes(state.registrationCode)) || /no service/i.test(state.radio)) state.moduleIp = "";
  renderSummary();
}

function normalizeModuleAddress(value) {
  const address = value.trim();
  const octets = address.split(".");
  const decimal = octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  if (decimal && octets.length === 4) return octets.some((part) => Number(part) !== 0) ? octets.map(Number).join(".") : "";
  const ipv6 = decimal && octets.length === 16
    ? Array.from({ length: 8 }, (_, index) => ((Number(octets[index * 2]) << 8) | Number(octets[index * 2 + 1])).toString(16)).join(":")
    : address;
  if (!/^[0-9a-f:.]+$/i.test(ipv6) || !ipv6.includes(":")) return "";
  try {
    const normalized = new URL(`http://[${ipv6}]/`).hostname.slice(1, -1);
    return normalized === "::" ? "" : normalized;
  } catch { return ""; }
}

function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }

