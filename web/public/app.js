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

function parseLpaData(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith("{"));
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const message = JSON.parse(lines[index]);
      if (message?.type === "lpa" && message?.payload) return message.payload.data;
    } catch (_) {
      // Ignore progress lines and malformed diagnostic output.
    }
  }
  return null;
}

function euiccDisplayLabel(item, index = 0) {
  const estk = ["A06573746B6D65FFFF4953442D522030", "A06573746B6D65FFFF4953442D522031"].indexOf(item?.aid);
  return item?.label || (estk >= 0 ? t("estkSpace", { index: "SE" + estk }) : t("defaultEidLabel", { index: index + 1 }));
}

function shortEid(value) {
  const eid = String(value || "");
  return eid.length > 12 ? `${eid.slice(0, 6)}...${eid.slice(-6)}` : eid || "--";
}

function activeEuicc() {
  return state.euiccInventory.find((item) => item.eid === state.activeEid) || null;
}

function renderActiveEuicc() {
  const item = activeEuicc();
  document.querySelector("#renameSelectedEidBtn").disabled = !item || state.busy;
  const label = document.querySelector("#activeEuiccLabel");
  const eid = document.querySelector("#eidValue");
  const status = document.querySelector("#activeEuiccState");
  const installed = document.querySelector("#installedProfileCount");
  const active = document.querySelector("#activeProfileCount");
  const memory = document.querySelector("#euiccMemory");
  if (!item) {
    label.textContent = t("noEidSelected");
    eid.textContent = "--";
    status.className = "profile-state inactive";
    status.textContent = t("notSelected");
    installed.textContent = "--";
    active.textContent = "--";
    memory.textContent = "--";
    renderProfileItems(null);
    return;
  }
  const index = state.euiccInventory.indexOf(item);
  label.textContent = euiccDisplayLabel(item, index);
  eid.textContent = item.eid;
  status.className = "profile-state active";
  status.textContent = t("selected");
  installed.textContent = String(item.profileCount ?? item.profiles?.length ?? "--");
  active.textContent = String(item.activeCount ?? item.profiles?.filter((profile) => profile.profileState === "enabled").length ?? "--");
  memory.textContent = item.freeMemory ? formatBytes(item.freeMemory) : "--";
  renderProfileItems(Array.isArray(item.profiles) ? item.profiles : null);
}

function selectEuicc(eid) {
  if (state.busy) return;
  const item = state.euiccInventory.find((entry) => entry.eid === eid);
  if (!item || item.eid === state.activeEid) return;
  const restoreFocus = nativeCompanion && document.activeElement?.dataset.euiccSelect === eid;
  state.activeEid = item.eid;
  state.activeAid = item.aid;
  state.profileText = "";
  state.discoveryText = "";
  state.notificationText = "";
  document.querySelector("#pendingProfileCount").textContent = "--";
  document.querySelector("#discoveryState").textContent = t("discoveryNotChecked");
  const notifications = document.querySelector("#notificationsList");
  notifications.className = "notification-list empty";
  notifications.textContent = t("noNotifications");
  renderEuiccInventory({ eids: state.euiccInventory, candidatesChecked: state.euiccCandidatesChecked });
  if (restoreFocus) document.querySelector(`[data-euicc-select="${CSS.escape(eid)}"]`)?.focus({ preventScroll: true });
}

async function renameEuicc(eid) {
  const item = state.euiccInventory.find((entry) => entry.eid === eid);
  if (!item) return;
  const next = window.prompt(t("eidLabelPrompt"), item.label || "");
  if (next === null || next.trim().length > 40) return;
  try {
    const res = await fetch("/api/euicc-label", {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ eid, label: next.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save EID label.");
    item.label = data.label || "";
    append(t("eidSpaceLabel"), t("eidLabelSaved"));
    renderEuiccInventory({ eids: state.euiccInventory, candidatesChecked: state.euiccCandidatesChecked });
  } catch (error) { append(t("eidSpaceLabel"), error.stack || error.message); }
}

function renderEuiccInventory(data) {
  const items = Array.isArray(data?.eids) ? data.eids : [];
  state.euiccInventory = items;
  if (Array.isArray(data?.probes)) state.euiccProbes = data.probes;
  state.euiccCandidatesChecked = Number(data?.candidatesChecked) || state.euiccCandidatesChecked || 0;
  state.inventoryLoaded = true;
  if (!items.some((item) => item.eid === state.activeEid)) {
    state.activeEid = items[0]?.eid || "";
    state.activeAid = items[0]?.aid || "";
  } else {
    state.activeAid = items.find((item) => item.eid === state.activeEid)?.aid || "";
  }
  document.querySelector("#eidLibraryCount").textContent = t("eidsSummary", { count: items.length });
  document.querySelector("#euiccProbeState").textContent = t("probeSummary", { count: items.length, checked: state.euiccCandidatesChecked });
  const readStatus = document.querySelector("#euiccReadStatus");
  const loaded = items.filter((item) => Array.isArray(item.profiles)).length;
  const estkProbes = (state.euiccProbes || []).filter((probe) =>
    ["A06573746B6D65FFFF4953442D522030", "A06573746B6D65FFFF4953442D522031"].includes(probe.aid));
  const estkCount = estkProbes.filter((probe) => probe.status !== "eid-unavailable").length;
  readStatus.textContent = t("inventoryReadStatus", { loaded, count: items.length }) +
    (estkCount ? " " + t("estkReadStatus", { count: estkCount }) : "");
  readStatus.hidden = !items.length;
  const inventory = document.querySelector("#euiccInventory");
  if (!items.length) {
    inventory.className = "euicc-slot-grid empty";
    inventory.textContent = t("chipInfoUnavailable");
    renderActiveEuicc();
    return;
  }
  inventory.className = "euicc-slot-grid";
  inventory.innerHTML = items.map((item, index) => {
    const selected = item.eid === state.activeEid;
    const label = euiccDisplayLabel(item, index);
    if (nativeCompanion) {
      return `<button class="euicc-slot-card ${selected ? "active" : ""}" data-euicc-select="${escapeHtml(item.eid)}" aria-pressed="${selected}" ${state.busy ? "disabled" : ""}>
        <span class="euicc-slot-top"><strong>${escapeHtml(label)}</strong><span class="euicc-selection-mark" aria-hidden="true">${selected ? '<i data-lucide="check"></i>' : ""}</span></span>
        <span class="euicc-slot-copy"><code>EID ${escapeHtml(shortEid(item.eid))}</code><span class="euicc-slot-count">${escapeHtml(Array.isArray(item.profiles) ? t("compactProfiles", {count:item.profiles.length, active:item.profiles.filter(p => p.profileState === "enabled").length}) : t("profilesReadFailed"))}</span></span>
      </button>`;
    }
    return `<article class="euicc-slot-card ${selected ? "active" : ""}">
      <div class="euicc-slot-copy"><strong>${escapeHtml(label)}</strong><code title="${escapeHtml(item.eid)}">${escapeHtml(shortEid(item.eid))}</code><span class="euicc-slot-count">${escapeHtml(Array.isArray(item.profiles) ? t("compactProfiles", {count:item.profiles.length, active:item.profiles.filter(p => p.profileState === "enabled").length}) : t("profilesReadFailed"))}</span></div>
      <button data-euicc-select="${escapeHtml(item.eid)}" aria-pressed="${selected}" ${selected || state.busy ? "disabled" : ""}>${escapeHtml(selected ? t("viewing") : t("viewProfiles"))}</button>
    </article>`;
  }).join("");
  for (const button of inventory.querySelectorAll("[data-euicc-select]")) button.addEventListener("click", () => selectEuicc(button.dataset.euiccSelect));
  for (const button of inventory.querySelectorAll("[data-euicc-label]")) button.addEventListener("click", () => renameEuicc(button.dataset.euiccLabel));
  if (nativeCompanion) window.lucide?.createIcons();
  renderActiveEuicc();
}

function renderChip(text) {
  state.chipText = text;
  const data = parseLpaData(text);
  const eid = document.querySelector("#eidValue");
  const memory = document.querySelector("#euiccMemory");
  if (!data || Array.isArray(data)) {
    eid.textContent = t("chipInfoUnavailable");
    memory.textContent = "--";
    return;
  }
  eid.textContent = data.eidValue || "--";
  const bytes = data.EUICCInfo2?.extCardResource?.freeNonVolatileMemory;
  memory.textContent = Number.isFinite(Number(bytes)) ? formatBytes(bytes) : "--";
}

function renderDiscovery(text) {
  state.discoveryText = text;
  const data = parseLpaData(text);
  const count = document.querySelector("#pendingProfileCount");
  const detail = document.querySelector("#discoveryState");
  if (!Array.isArray(data)) {
    count.textContent = "--";
    detail.textContent = t("chipInfoUnavailable");
    return;
  }
  count.textContent = String(data.length);
  detail.textContent = data.length ? t("pendingProfileSummary", { count: data.length }) : t("noPendingProfiles");
}
function renderProfiles(text) {
  state.profileText = text;
  const profiles = parseLpaData(text);
  if (!Array.isArray(profiles)) {
    renderProfileItems(null);
    return;
  }
  const item = activeEuicc();
  if (item) {
    item.profiles = profiles;
    item.profilesLoaded = true;
    item.profileCount = profiles.length;
    item.activeCount = profiles.filter((profile) => profile.profileState === "enabled").length;
    renderEuiccInventory({ eids: state.euiccInventory, candidatesChecked: state.euiccCandidatesChecked });
    return;
  }
  renderProfileItems(profiles);
}

function profileViewKey(id) {
  return JSON.stringify([state.activeEid, id]);
}

function filterProfiles(profiles, filter) {
  const terms = filter.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return profiles.filter(profile => {
    const text = [profile.profileNickname, profile.profileName, profile.serviceProviderName, profile.iccid, profile.isdpAid].filter(Boolean).join(" ").toLocaleLowerCase();
    return (filter.status === "all" || profile.profileState === filter.status) && terms.every(term => text.includes(term));
  });
}

function renderProfileItems(profiles) {
  const list = document.querySelector("#profilesList");
  const count = document.querySelector("#profileCount");
  for (const card of list.querySelectorAll("[data-profile-key]")) {
    if (card.querySelector("details").open) state.profileDetailsOpen.add(card.dataset.profileKey);
    else state.profileDetailsOpen.delete(card.dataset.profileKey);
  }
  const filter = state.profileFilters.get(state.activeEid) || {query: "", status: "all"};
  document.querySelector("#profileToolbar").hidden = !Array.isArray(profiles);
  document.querySelector("#profileSearchInput").value = filter.query;
  document.querySelector("#profileStatusFilter").value = filter.status;
  document.querySelector("#clearProfileSearchBtn").hidden = !filter.query;
  document.querySelector("#clearProfileSearchBtn").title = t("clearSearch");
  if (!Array.isArray(profiles)) {
    delete list.dataset.markup;
    list.className = "profile-list empty";
    list.textContent = state.activeEid ? t("noProfileData") : t("selectEidFirst");
    count.textContent = t("profilesNotLoaded");
    return;
  }
  const activeCount = profiles.filter((profile) => profile.profileState === "enabled").length;
  count.textContent = t("profilesSummary", { count: profiles.length, active: activeCount });
  document.querySelector("#installedProfileCount").textContent = String(profiles.length);
  document.querySelector("#activeProfileCount").textContent = String(activeCount);
  const filtered = filterProfiles(profiles, filter);
  document.querySelector("#profileFilterCount").textContent = t("profileFilterCount", {visible: filtered.length, total: profiles.length});
  // Prune UI-only state when a refreshed inventory no longer contains a profile.
  const validKeys = new Set(profiles.map(profile => profileViewKey(profile.iccid || profile.isdpAid || "")));
  for (const key of state.profileDrafts.keys()) if (JSON.parse(key)[0] === state.activeEid && !validKeys.has(key)) state.profileDrafts.delete(key);
  for (const key of state.profileDetailsOpen) if (JSON.parse(key)[0] === state.activeEid && !validKeys.has(key)) state.profileDetailsOpen.delete(key);
  if (!profiles.length) {
    delete list.dataset.markup;
    list.className = "profile-list empty";
    list.textContent = t("noProfiles");
    return;
  }
  if (!filtered.length) {
    delete list.dataset.markup;
    list.className = "profile-list empty";
    list.textContent = t("noMatchingProfiles");
    return;
  }
  list.className = "profile-list";
  const focused = list.contains(document.activeElement) ? document.activeElement : null;
  const focusId = focused?.dataset.profileNicknameInput;
  const selection = focusId ? [focused.selectionStart, focused.selectionEnd] : null;
  const markup = [...filtered].sort((a, b) => Number(b.profileState === "enabled") - Number(a.profileState === "enabled")).map((profile) => {
    const enabled = profile.profileState === "enabled";
    const key = profileViewKey(profile.iccid || profile.isdpAid || "");
    const id = escapeHtml(profile.iccid || profile.isdpAid || "");
    const action = enabled ? "disable" : "enable";
    const savedName = profile.profileNickname || profile.profileName || "";
    if (state.profileDrafts.get(key) === savedName) state.profileDrafts.delete(key);
    const nickname = escapeHtml(state.profileDrafts.get(key) ?? savedName);
    const title = escapeHtml(profile.profileNickname || profile.profileName || profile.serviceProviderName || t("unnamed"));
    const provider = escapeHtml(profile.serviceProviderName || profile.profileName || "");
    const profileClass = escapeHtml(profile.profileClass || "operational");
    const actionLabel = enabled ? t("disable") : t("switchProfile");
    const actionButton = `<button class="profile-action ${enabled ? "secondary" : ""}" data-profile-action="${action}" data-profile-id="${id}" ${state.profileActionsEnabled && !state.busy ? "" : "disabled"}>${escapeHtml(actionLabel)}</button>`;
    return `<article class="profile-card ${enabled ? "active" : ""}" data-profile-key="${escapeHtml(key)}">
      <div class="profile-card-head">
        <div class="profile-title">${provider && provider !== title ? `<span>${provider}</span>` : ""}<strong>${title}</strong></div>
        <span class="profile-state ${enabled ? "active" : "inactive"}">${enabled ? t("currentProfile") : t("inactiveProfile")}</span>
      </div>
      ${nativeCompanion && enabled ? "" : `<div class="profile-actions profile-primary-actions">${actionButton}</div>`}
      <details class="profile-more" ${state.profileDetailsOpen.has(key) ? "open" : ""}>
      <summary>${escapeHtml(t("moreProfile"))}</summary>
      ${nativeCompanion && enabled ? `<div class="profile-actions">${actionButton}</div>` : ""}
      <div class="profile-detail-grid">
        <div><span>${escapeHtml(t("iccidLabel"))}</span><code>${id}</code></div>
        <div><span>${escapeHtml(t("profileClassLabel"))}</span><strong>${profileClass}</strong></div>
        <div class="profile-traffic"><span>${escapeHtml(t("trafficBalance"))}</span><strong>${escapeHtml(t("trafficUnavailable"))}</strong></div>
      </div>
      <div class="profile-actions">
        ${enabled ? "" : `<button class="profile-action danger" data-profile-delete data-profile-id="${id}" ${state.profileDeleteEnabled && !state.busy ? "" : "disabled"}>${escapeHtml(t("deleteProfile"))}</button>`}
        <div class="inline-edit"><input class="nickname-input" data-profile-nickname-input="${id}" value="${nickname}" maxlength="64" aria-label="${t("profileNickname")}"><button class="secondary" data-profile-nickname data-profile-id="${id}" ${state.profileNicknameEnabled && !state.busy ? "" : "disabled"}>${t("save")}</button></div>
      </div>
      </details>
    </article>`;
  }).join("");
  if (list.dataset.markup === markup) return;
  list.innerHTML = markup; list.dataset.markup = markup;
  for (const card of list.querySelectorAll("[data-profile-key]")) {
    const key = card.dataset.profileKey;
    const details = card.querySelector("details");
    details.addEventListener("toggle", () => {
      if (!details.isConnected) return;
      if (details.open) state.profileDetailsOpen.add(key); else state.profileDetailsOpen.delete(key);
    });
    card.querySelector(".nickname-input").addEventListener("input", event => state.profileDrafts.set(key, event.target.value));
  }
  for (const button of list.querySelectorAll("button[data-profile-action]")) button.addEventListener("click", () => runProfileAction(button.dataset.profileAction, button.dataset.profileId));
  for (const button of list.querySelectorAll("button[data-profile-nickname]")) button.addEventListener("click", () => renameProfile(button.dataset.profileId));
  for (const button of list.querySelectorAll("button[data-profile-delete]")) button.addEventListener("click", () => deleteProfile(button.dataset.profileId));
  if (focusId) {
    const input = [...list.querySelectorAll(".nickname-input")].find(input => input.dataset.profileNicknameInput === focusId);
    input?.focus({preventScroll: true}); input?.setSelectionRange(...selection);
  }
}

function renderNotifications(text) {
  state.notificationText = text;
  const list = document.querySelector("#notificationsList");
  const jsonLine = text.split(/\r?\n/).find((line) => line.trim().startsWith("{"));
  if (!jsonLine) { list.className = "notification-list empty"; list.textContent = t("noNotifications"); return; }
  try {
    const notifications = JSON.parse(jsonLine)?.payload?.data || [];
    if (!notifications.length) { list.className = "notification-list empty"; list.textContent = t("noPendingNotifications"); return; }
    list.className = "notification-list";
    list.innerHTML = notifications.map((item) => `<article class="notification-card"><strong>${escapeHtml(item.profileManagementOperation || "profile")}</strong><div>${escapeHtml(item.notificationAddress || "")}</div><code>${escapeHtml(item.iccid || item.seqNumber || "")}</code></article>`).join("");
  } catch (error) { list.className = "notification-list empty"; list.textContent = t("notificationsParseError", { error: error.message }); }
}

function parseAtCsv(line) {
  return [...line.matchAll(/(?:^|,)(?:"([^"]*)"|([^,]*))/g)].map((match) => (match[1] ?? match[2] ?? "").trim());
}

function decodeSmsBody(value) {
  const body = value.trim();
  if (!/^(?:[0-9a-f]{4})+$/i.test(body)) return body;
  const decoded = body.match(/.{4}/g).map((chunk) => String.fromCharCode(Number.parseInt(chunk, 16))).join("");
  return /[\p{L}\p{N}\p{P}\p{Z}\r\n]/u.test(decoded) ? decoded : body;
}

function parseSmsMessages(text) {
  // Only the final OK terminates the response; an OK inside a message is content.
  const response = String(text || "").replace(/\r\n?/g, "\n").replace(/(?:^|\n)[\t ]*OK[\t ]*\n*$/, "");
  const headers = [...response.matchAll(/^\+CMGL:[\t ]*(\d+[\t ]*,[\t ]*"(?:REC (?:READ|UNREAD)|STO (?:SENT|UNSENT))"[\t ]*,[^\n]*)(?:\n|$)/gm)];
  return headers.map((header, index) => ["", header[1], response.slice(header.index + header[0].length, headers[index + 1]?.index ?? response.length)]);
}

function smsSearchPattern(query) {
  const value = String(query || "").trim();
  return value ? new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu") : null;
}

function highlightSmsText(value, query) {
  const text = String(value || ""), pattern = smsSearchPattern(query);
  if (!pattern) return escapeHtml(text);
  let html = "", offset = 0;
  for (const match of text.matchAll(pattern)) {
    html += escapeHtml(text.slice(offset, match.index)) + `<mark>${escapeHtml(match[0])}</mark>`;
    offset = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(offset));
}

function smsSearchPreview(value, query) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const match = smsSearchPattern(query)?.exec(text);
  const start = match ? Math.max(0, match.index - 8) : 0;
  const end = Math.max(start + 120, (match?.index || 0) + (match?.[0].length || 0));
  return (start ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function extractVerificationCode(body) {
  const patterns = [
    /(?:验证码|校验码|动态码|验证代码|verification\s*code|security\s*code|one[-\s]?time\s*(?:password|code)|otp|passcode|login\s*code|code)\D{0,12}([0-9]{4,8})/i,
    /([0-9]{4,8})\D{0,12}(?:验证码|校验码|动态码|verification\s*code|security\s*code|one[-\s]?time\s*(?:password|code)|otp|passcode|login\s*code)/i,
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function formatBytes(value, perSecond = false) {
  const bytes = Math.max(0, Number(value) || 0);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = bytes;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  const digits = amount >= 100 || index === 0 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(digits)} ${units[index]}${perSecond ? "/s" : ""}`;
}

function renderTraffic(text, freshSample = true) {
  let adapters = [];
  try {
    const parsed = JSON.parse(String(text || "").trim());
    adapters = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    if (adapters.some(item => !item || typeof item !== "object" || Array.isArray(item))) return false;
  } catch {
    return false;
  }
  state.networkText = text;
  if (freshSample) {
    state.trafficReadError = false; state.trafficFailureCount = 0; state.trafficRetryAfter = 0; state.trafficLastRead = Date.now();
  }
  renderTrafficSyncState();
  const adapter = adapters.find((item) => String(item.status).toLowerCase() === "up") || adapters[0];
  const ids = {
    adapter: document.querySelector("#trafficAdapter"),
    rxRate: document.querySelector("#trafficRxRate"),
    txRate: document.querySelector("#trafficTxRate"),
    rxSession: document.querySelector("#trafficRxSession"),
    txSession: document.querySelector("#trafficTxSession"),
    ipv4: document.querySelector("#trafficIpv4"),
    gateway: document.querySelector("#trafficGateway"),
    driver: document.querySelector("#trafficDriver"),
    dhcp: document.querySelector("#trafficDhcp"),
    driverBadge: document.querySelector("#ecmDriverBadge"),
    driverDetail: document.querySelector("#ecmDriverDetail"),
    repairButton: document.querySelector("#installEcmDriverBtn"),
    status: document.querySelector("#trafficStatus"),
  };
  if (!adapter) {
    ids.adapter.textContent = t("noAdapter");
    for (const key of ["rxRate", "txRate", "rxSession", "txSession", "ipv4", "gateway", "dhcp"]) ids[key].textContent = "--";
    ids.driver.textContent = t("driverMissing");
    ids.driverBadge.textContent = t("driverMissing");
    ids.driverBadge.className = "driver-badge warning";
    ids.driverDetail.textContent = t("noAdapter");
    ids.repairButton.dataset.driverReady = "0";
    ids.repairButton.dataset.driverEligible = "0";
    ids.repairButton.textContent = t("repairDriver");
    ids.repairButton.disabled = true;
    state.trafficPrevious = null;
    state.trafficBaseline = null;
    ids.status.textContent = t("noAdapter");
    return true;
  }
  const rx = adapter.receivedBytes;
  const tx = adapter.sentBytes;
  const connected = String(adapter.status).toLowerCase() === "up";
  const statisticsReliable = adapter.statisticsReliable !== false && Number.isSafeInteger(rx) && rx >= 0 && Number.isSafeInteger(tx) && tx >= 0;
  const now = Number(adapter.sampledAt) || Date.now();
  const key = `${adapter.name}|${adapter.description}|${adapter.interfaceIndex || ""}|${adapter.statisticsSource || "adapter"}`;
  const previous = state.trafficPrevious;
  const reset = previous?.key === key && (rx < previous.rx || tx < previous.tx || now < previous.time);
  if (statisticsReliable && (!state.trafficBaseline || state.trafficBaseline.key !== key || reset)) {
    state.trafficBaseline = { key, rx, tx };
    state.trafficPrevious = null;
  }
  let rxRate = null;
  let txRate = null;
  if (statisticsReliable && connected && state.trafficPrevious?.key === key) {
    if (now === state.trafficPrevious.time) {
      rxRate = state.trafficPrevious.rxRate;
      txRate = state.trafficPrevious.txRate;
    } else {
      const seconds = (now - state.trafficPrevious.time) / 1000;
      rxRate = Math.max(0, rx - state.trafficPrevious.rx) / seconds;
      txRate = Math.max(0, tx - state.trafficPrevious.tx) / seconds;
    }
  }
  state.trafficPrevious = statisticsReliable && connected ? { key, rx, tx, time: now, rxRate, txRate } : null;
  if (!statisticsReliable) state.trafficBaseline = null;
  ids.adapter.textContent = `${adapter.description || adapter.name || t("unknown")} | ${adapter.status || "--"}`;
  ids.rxRate.textContent = !state.trafficReadError && rxRate !== null ? formatBytes(rxRate, true) : "--";
  ids.txRate.textContent = !state.trafficReadError && txRate !== null ? formatBytes(txRate, true) : "--";
  ids.status.textContent = t(state.trafficReadError ? "trafficStale" : !connected ? "trafficDisconnected" : !statisticsReliable ? "trafficCountersUnavailable" : rxRate === null ? "trafficWaiting" : "trafficActive");
  ids.rxSession.textContent = statisticsReliable ? formatBytes(rx - state.trafficBaseline.rx) : "--";
  ids.txSession.textContent = statisticsReliable ? formatBytes(tx - state.trafficBaseline.tx) : "--";
  ids.ipv4.textContent = adapter.ipv4 || "--";
  ids.gateway.textContent = adapter.gateway || "--";
  ids.driver.textContent = adapter.driverVersion || t("driverMissing");
  ids.dhcp.textContent = adapter.dhcp || "--";

  const driverTargetPresent = Boolean(adapter.driverTargetPresent);
  const driverReady = Boolean(adapter.driverReady);
  ids.driverBadge.textContent = driverReady ? t("driverReady") : driverTargetPresent ? t("driverOutdated") : t("driverMissing");
  ids.driverBadge.className = `driver-badge ${driverReady ? "ready" : "warning"}`;
  ids.driverDetail.textContent = driverReady
    ? t("driverReadyDetail", { version: adapter.driverVersion || "--", ip: adapter.ipv4 || "--" })
    : driverTargetPresent
      ? t("driverOutdatedDetail", { name: adapter.driverName || adapter.description || t("unknown"), version: adapter.driverVersion || "--" })
      : t("driverUnsupportedDetail");
  ids.repairButton.dataset.driverEligible = driverTargetPresent ? "1" : "0";
  ids.repairButton.dataset.driverReady = driverReady ? "1" : "0";
  ids.repairButton.textContent = driverReady ? t("driverReady") : t("repairDriver");
  ids.repairButton.disabled = state.busy || !state.driverInstallEnabled || !driverTargetPresent || driverReady;
  return true;
}

function renderTrafficSyncState() {
  const element = document.querySelector("#trafficSyncState");
  const time = state.trafficLastRead ? new Date(state.trafficLastRead).toLocaleTimeString(state.language === "zh" ? "zh-CN" : "en-GB", {hour:"2-digit", minute:"2-digit", second:"2-digit"}) : "";
  element.textContent = t(state.trafficReadError ? "trafficRefreshFailed" : state.trafficRefreshInFlight ? "trafficRefreshing" : time ? "trafficUpdated" : "trafficNotSynced", {time});
  element.dataset.tone = state.trafficReadError ? "error" : "normal";
  if (state.trafficReadError) {
    document.querySelector("#trafficRxRate").textContent = "--";
    document.querySelector("#trafficTxRate").textContent = "--";
    document.querySelector("#trafficStatus").textContent = t("trafficStale");
  }
}

function noteTrafficReadFailure() {
  state.trafficReadError = true;
  state.trafficFailureCount += 1;
  state.trafficRetryAfter = Date.now() + Math.min(30000, 4000 * 2 ** Math.min(state.trafficFailureCount, 3));
  renderTrafficSyncState();
}
function smsStatus(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized.includes("UNREAD")) return { label: t("smsUnread"), className: "unread" };
  if (normalized.includes("UNSENT")) return { label: t("smsUnsent"), className: "unsent" };
  if (normalized.includes("SENT")) return { label: t("smsSent"), className: "sent" };
  return { label: t("smsRead"), className: "read" };
}

function parseSmsStorageText(text) {
  const matches = [...String(text || "").matchAll(/\+CPMS:\s*(?:"[^"]+"\s*,\s*)?(\d+)\s*,\s*(\d+)/gi)];
  const values = matches.map((match) => ({ used: Number(match[1]), total: Number(match[2]) })).filter((item) => item.total > 0 && item.used >= 0 && item.used <= item.total);
  if (!values.length) return null;
  const storage = values[values.length - 1];
  return { ...storage, full: storage.used >= storage.total, percent: Math.round((storage.used / storage.total) * 100) };
}

function renderSmsStorage(storage) {
  const banner = document.querySelector("#smsStorageWarning");
  if (!banner) return;
  if (!storage?.total) {
    banner.hidden = true;
    banner.textContent = "";
    return;
  }
  banner.hidden = false;
  banner.className = "sms-storage-banner " + (storage.full ? "full" : storage.percent >= 80 ? "warning" : "healthy");
  banner.textContent = storage.full
    ? t("smsStorageFull", storage)
    : storage.percent >= 80
      ? t("smsStorageNearFull", storage)
      : t("smsStorageUsage", storage);
}

async function deleteSmsMessage(index) {
  if (!state.smsDeleteEnabled) {
    append(t("smsInbox"), t("smsDeleteLocked"));
    return;
  }
  if (!window.confirm(t("confirmDeleteSms", { index }))) return;
  const port = encodeURIComponent(portInput.value.trim());
  try {
    const res = await fetch("/api/sms-delete?port=" + port, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ index, confirm: "DELETE" }),
    });
    const data = await res.json();
    append(t("deleteSms"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (!res.ok) throw new Error(data.error || t("smsDeleteLocked"));
    append(t("smsInbox"), t("smsDeleted"));
    await callApi("sms-list");
  } catch (error) {
    append(t("deleteSms"), error.message || String(error));
  }
}

function normalizePhone(value) {
  return String(value).trim().replace(/[\s()-]/g, "");
}

function parseDialInput(value) {
  const compact = normalizePhone(value);
  const separator = compact.indexOf(",");
  const number = separator < 0 ? compact : compact.slice(0, separator);
  const postDial = separator < 0 ? "" : compact.slice(separator);
  if (!/^\+?[0-9]{3,20}$/.test(number)) return null;
  if (postDial && (postDial.length > 64 || !/^[,0-9*#]+$/.test(postDial) || !/[0-9*#]/.test(postDial))) return null;
  return { number, postDial, compact };
}

function smsDraftKey() { return state.smsNewDraft ? "new" : (state.smsActiveSender || "new"); }

function saveSmsDraft() {
  const draft = { number: document.querySelector("#smsNumberInput").value, message: document.querySelector("#smsMessageInput").value };
  if (draft.message || (smsDraftKey() === "new" && draft.number)) state.smsDrafts.set(smsDraftKey(), draft);
  else state.smsDrafts.delete(smsDraftKey());
  updateSmsComposer();
  for (const badge of document.querySelectorAll("[data-draft-for]")) badge.hidden = !state.smsDrafts.get(badge.dataset.draftFor)?.message;
}

function setSmsFeedback(key, tone = "neutral", params = {}) {
  state.smsFeedback = key ? { key, tone, params } : null;
  const element = document.querySelector("#smsComposeFeedback");
  element.hidden = !key;
  element.textContent = key ? t(key, params) : "";
  element.dataset.tone = tone;
}

function updateSmsComposer() {
  const number = normalizePhone(document.querySelector("#smsNumberInput").value);
  const message = document.querySelector("#smsMessageInput").value;
  const validNumber = /^\+?[0-9]{3,20}$/.test(number);
  const button = document.querySelector("#sendSmsBtn");
  button.disabled = state.busy || state.smsSending || !state.smsSendEnabled || !state.atPort || state.cardReady === false || !validNumber || !message.trim() || message.length > 480;
  button.title = !state.smsSendEnabled ? t("smsSendLocked") : !validNumber || !message.trim() ? t("invalidSms") : t("smsShortcut");
  document.querySelector("#smsCharacterCount").textContent = `${message.length} / 480`;
  document.querySelector("#smsDraftHint").textContent = message ? t("draftKept") : nativeCompanion ? "" : t("smsShortcut");
  const input = document.querySelector("#smsNumberInput");
  input.setAttribute("aria-invalid", String(Boolean(number) && !validNumber));
  const replying = !state.smsNewDraft && Boolean(state.smsActiveSender) && validNumber;
  document.querySelector("#smsRecipientRow").hidden = replying;
  document.querySelector("#smsReplyTarget").textContent = replying ? t("replyTo", {number}) : "";
  document.querySelector("#smsMessageInput").placeholder = t(replying ? "replyMessage" : "writeMessage");
  document.querySelector("#smsSendHint").hidden = state.smsSendEnabled;
}

function renderSmsRefreshState() {
  const button = document.querySelector("#smsPollingBtn");
  button.textContent = t(state.smsPolling ? "pauseSmsRefresh" : "resumeSmsRefresh");
  button.setAttribute("aria-pressed", String(state.smsPolling));
  {
    button.title = button.textContent;
    button.setAttribute("aria-label", button.textContent);
    button.classList.add(nativeCompanion ? "native-icon-button" : "desktop-icon-button");
    const icon = document.createElement("i");
    icon.dataset.lucide = state.smsPolling ? "pause" : "play";
    icon.setAttribute("aria-hidden", "true");
    button.replaceChildren(icon);
    window.lucide?.createIcons();
  }
  const time = state.smsLastRead ? new Date(state.smsLastRead).toLocaleTimeString(state.language === "zh" ? "zh-CN" : "en-GB", {hour:"2-digit", minute:"2-digit", second:"2-digit"}) : "";
  document.querySelector("#smsRefreshState").textContent = state.smsRefreshing ? t("smsRefreshing") : state.smsReadError ? t("smsRefreshFailed") : time ? t(state.smsPolling ? "smsLastSynced" : "smsSyncPaused", {time}) : t("smsNotSynced");
  document.querySelector("#smsRetryBtn").hidden = !state.smsReadError;
}

async function refreshSmsQuietly() {
  if (!state.started || state.busy || state.smsRefreshing || state.smsSending || !state.atPort || state.cardReady === false || state.confirming || document.hidden || state.callActionInFlight || state.callStatusData?.callStateUncertain || state.callStatusData?.voiceCalls?.length) return;
  const epoch = state.cardEpoch;
  state.smsRefreshing = true;
  renderSmsRefreshState();
  try {
    const {data, text} = await requestAction("sms-list");
    if (!data.ok) throw new Error(data.error || "SMS read failed");
    if (epoch !== state.cardEpoch) return;
    state.smsLastRead = Date.now(); state.smsReadError = false;
    renderSms(text, data);
  } catch (error) {
    if (epoch === state.cardEpoch) {state.smsReadError = true; append(t("readSms"), error.message);}
  } finally { state.smsRefreshing = false; renderSmsRefreshState(); }
}

function renderConnectionState() {
  const call = state.callStatusData?.voiceCalls?.[0];
  statusPill.textContent = state.busy ? t(state.busyKey, state.busyParams) : call?.state === "incoming" ? t("callIncoming") : state.atPort && state.cardReady !== false ? t("deviceConnected", {port: state.atPort}) : t("cardNotConnected");
}

function renderCallGuidance() {
  const call = state.callStatusData?.voiceCalls?.[0];
  const hasDevice = Boolean(state.atPort) && state.cardReady !== false;
  let key = !hasDevice ? "callConnectFirst" : !state.callActionsEnabled ? "callControlsLocked" : !state.callStatusData ? "callChecking" : call ? "callInProgressHint" : "callReadyFeedback";
  if (hasDevice && state.callStatusReadError) key = "callReadFailed";
  if (hasDevice && state.callStatusData?.callStateUncertain) key = "callStatePending";
  const availability = document.querySelector("#callAvailability");
  availability.textContent = t(key);
  availability.hidden = nativeCompanion && key === "callReadyFeedback";
  if (!call) document.querySelector("#callStateLabel").textContent = t(!hasDevice ? "cardNotConnected" : !state.callActionsEnabled ? "callReadOnly" : !state.callStatusData || state.callStatusData.callStateUncertain ? "callChecking" : "callIdle");
  if (!call && state.callStatusReadError && !state.callStatusData?.callStateUncertain) document.querySelector("#callStateLabel").textContent = t("callStatusUncertain");
  document.querySelector(".call-inline-control").hidden = state.callStatusData?.callStateUncertain || !call || !["active", "held"].includes(call.state);
  document.querySelector(".call-primary-actions").hidden = !call && !state.callStatusData?.callStateUncertain;
  document.querySelector(".call-audio-actions").hidden = !call && !state.audioBridge;
  renderCallNextStep(call, hasDevice);
}


function renderCallNextStep(call, hasDevice) {
  document.querySelector(".call-identity").hidden = !call && !state.callStatusData?.callStateUncertain;
  document.querySelector("#callNextStep").hidden = Boolean(call) || Boolean(state.callStatusData?.callStateUncertain);
  const button = document.querySelector("#callNextBtn");
  const uncertain = state.callStatusReadError || state.callStatusData?.ok !== true;
  const key = !hasDevice ? "callNextDisconnected" : !state.callActionsEnabled ? "callNextLocked" : uncertain ? "callNextWaiting" : "callNextReady";
  document.querySelector("#callNextDescription").textContent = t(key);
  button.hidden = Boolean(call) || (hasDevice && !state.callActionsEnabled);
  button.dataset.next = !hasDevice ? "scan" : uncertain ? "retry" : "dial";
  button.textContent = t(!hasDevice ? "autoScan" : uncertain ? "callRetryStatus" : "callFocusDialer");
  button.disabled = state.busy || state.callRefreshInFlight;
  const runtime = state.voiceRuntimeStatus?.runtime, usb = state.voiceRuntimeStatus?.voiceUsb;
  const audioKey = !hasDevice || !state.callCapabilityData?.ok || state.voiceRuntimeStatus?.ok !== true ? "voiceSummaryUnknown"
    : !localAudioBridgeHost ? "voiceSummaryRemote"
    : !state.callCapabilityData.voiceSetupSupported ? "voiceSummaryUnsupported"
    : !runtime?.local?.downloaded ? "voiceSummaryRuntime"
    : !usb?.adbWinUsb || !usb?.standardUsbAudio ? "voiceSummaryUsb"
    : !runtime?.prepared || !runtime?.adb?.root || !runtime?.adb?.kernelCompatible ? "voiceSummaryPrepare" : "voiceSummaryReady";
  document.querySelector("#voiceSetupSummary").textContent = t(audioKey);
}

function confirmOperation({title, description, details = [], confirmLabel}) {
  if (state.confirming || state.busy) return Promise.resolve(false);
  state.confirming = true;
  const dialog = document.querySelector("#actionConfirmDialog");
  document.querySelector("#actionConfirmTitle").textContent = title;
  document.querySelector("#actionConfirmDescription").textContent = description;
  const list = document.querySelector("#actionConfirmDetails");
  list.replaceChildren();
  for (const [label, value] of details) {
    const row = document.createElement("div"), name = document.createElement("dt"), detail = document.createElement("dd");
    name.textContent = label; detail.textContent = value; row.append(name, detail); list.append(row);
  }
  document.querySelector("#actionConfirmSubmit").textContent = confirmLabel;
  dialog.returnValue = "cancel";
  dialog.showModal();
  document.querySelector("#actionConfirmCancel").focus();
  return new Promise(resolve => dialog.addEventListener("close", () => {state.confirming = false; resolve(dialog.returnValue === "confirm");}, {once:true}));
}

function ensureCurrentViewLoaded() {
  const target = document.querySelector(".view.active")?.id;
  if ((state.callStatusData?.callStateUncertain || state.callStatusData?.voiceCalls?.length) && ["sms", "euicc"].includes(target)) return;
  if (state.failedViews.has(target)) return;
  if (!state.started || state.busy || state.connecting || state.autoLoadedViews.has(target)) return;
  state.autoLoadedViews.add(target);
  if (target === "sms") {state.smsPolling = true; renderSmsRefreshState(); callApi("sms-list");}
  if (target === "network") callApi("network-traffic");
  if (target === "euicc") callApi("euicc-inventory");
}

function renderSmsNewMessages() {
  const button = document.querySelector("#smsNewMessagesBtn");
  const list = document.querySelector("#smsList");
  if (list.scrollHeight - list.scrollTop - list.clientHeight < 24) state.smsPendingKeys.clear();
  button.hidden = !state.smsPendingKeys.size;
  document.querySelector("#smsNewMessagesText").textContent = t("newSmsMessages", {count: state.smsPendingKeys.size});
}

function renderSms(text, data = {}) {
  state.smsText = text;
  const list = document.querySelector("#smsList");
  const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
  const previousTop = list.scrollTop;
  const previousCards = [...list.querySelectorAll("[data-sms-key]")];
  const previousKeys = new Set(previousCards.map(card => card.dataset.smsKey));
  const listTop = list.getBoundingClientRect().top;
  const anchor = previousCards.find(card => card.getBoundingClientRect().bottom > listTop);
  const anchorOffset = anchor ? anchor.getBoundingClientRect().top - listTop : 0;
  state.smsStorage = data.storage || parseSmsStorageText(text) || state.smsStorage;
  renderSmsStorage(state.smsStorage);
  const matches = parseSmsMessages(text);
  const storedSent = matches.filter(m => smsStatus(parseAtCsv(m[1])[1]).className === "sent").map(m => normalizePhone(parseAtCsv(m[1])[2]) + "\n" + decodeSmsBody(m[2]));
  for (const sent of state.smsSentThisSession) {
    const key = sent.number + "\n" + sent.message, index = storedSent.indexOf(key);
    if (index >= 0) {storedSent.splice(index, 1); continue;}
    const match = ["", `local,"STO SENT","${sent.number}","","${sent.time}"`, sent.message];
    match.local = true; matches.push(match);
  }
  const groups = new Map();
  for (const match of matches) {
    const sender = normalizePhone(parseAtCsv(match[1])[2] || "");
    if (!groups.has(sender)) groups.set(sender, []);
    groups.get(sender).push(match);
  }
  for (const [key, draft] of state.smsDrafts) if (key !== "new" && draft.message && !groups.has(key)) groups.set(key, []);
  if (!state.smsNewDraft && !groups.has(state.smsActiveSender)) {
    if (document.querySelector("#smsMessageInput").value.trim()) {saveSmsDraft(); groups.set(state.smsActiveSender, []);}
    else {state.smsActiveSender = groups.keys().next().value ?? null; document.querySelector("#smsNumberInput").value = state.smsActiveSender ?? "";}
  }
  const threads = document.querySelector("#smsThreads");
  const query = state.smsQuery.trim(), pattern = smsSearchPattern(query);
  const containsQuery = value => !pattern || String(value).search(pattern) >= 0;
  const filtered = [...groups].filter(([sender, messages]) => containsQuery(sender) || messages.some(m => containsQuery(decodeSmsBody(m[2]))) || containsQuery(state.smsDrafts.get(sender)?.message || ""));
  const searchCount = document.querySelector("#smsSearchCount");
  searchCount.hidden = !state.smsLastRead && !text && !groups.size;
  searchCount.textContent = t(query ? "smsSearchCount" : "smsThreadCount", {visible: filtered.length, total: groups.size});
  document.querySelector("#clearSmsSearchBtn").hidden = !state.smsQuery;
  document.querySelector("#clearSmsSearchBtn").title = t("clearSearch");
  threads.className = "sms-threads" + (filtered.length ? "" : " empty");
  const threadHtml = filtered.map(([sender, messages]) => {
    const unread = messages.filter(m => smsStatus(parseAtCsv(m[1])[1]).className === "unread").length;
    const draft = state.smsDrafts.get(sender)?.message;
    const matching = query && messages.find(m => containsQuery(decodeSmsBody(m[2])));
    const preview = matching ? decodeSmsBody(matching[2]) : query && draft && containsQuery(draft) ? draft : messages.length ? decodeSmsBody(messages.at(-1)[2]) : t("draftKept");
    return `<button class="sms-thread" data-sms-thread="${escapeHtml(sender)}" aria-pressed="${sender === state.smsActiveSender && !state.smsNewDraft}"><span class="thread-avatar" aria-hidden="true">${escapeHtml(sender.replace(/\D/g, "").slice(-2) || "SMS")}</span><span class="thread-copy"><strong>${highlightSmsText(sender || t("unknown"), query)}</strong><small>${highlightSmsText(smsSearchPreview(preview, query), query)}</small><em data-draft-for="${escapeHtml(sender)}" ${draft ? "" : "hidden"}>${t("draftLabel")}</em></span><span class="thread-count ${unread ? "has-unread" : ""}" aria-label="${escapeHtml(t(unread ? "unreadCount" : "conversationMessages", {count: unread || messages.length}))}">${unread || messages.length}</span></button>`;
  }).join("") || escapeHtml(query ? t("noMatchingThreads") : t(state.smsLastRead ? "smsNoConversations" : "noSms"));
  if (threads.dataset.markup !== threadHtml) {
    const threadTop = threads.scrollTop, focusSender = document.activeElement?.dataset.smsThread;
    threads.innerHTML = threadHtml; threads.dataset.markup = threadHtml;
    for (const button of threads.querySelectorAll("[data-sms-thread]")) button.addEventListener("click", () => selectSmsConversation(button.dataset.smsThread));
    threads.scrollTop = threadTop;
    if (focusSender !== undefined) [...threads.querySelectorAll("[data-sms-thread]")].find(button => button.dataset.smsThread === focusSender)?.focus({preventScroll: true});
  }
  const visible = state.smsNewDraft ? [] : (groups.get(state.smsActiveSender) || []);
  const conversationKey = JSON.stringify([state.cardEpoch, state.smsNewDraft, state.smsActiveSender]);
  const sameConversation = list.dataset.conversation === conversationKey;
  list.dataset.conversation = conversationKey;
  if (!sameConversation) state.smsPendingKeys.clear();
  document.querySelector("#smsCount").textContent = t(visible.length === 1 ? "conversationMessage" : "conversationMessages", {count:visible.length});
  document.querySelector("#smsConversationTitle").textContent = state.smsNewDraft ? t("newMessage") : (state.smsActiveSender || t("smsInbox"));
  list.className = "sms-list" + (visible.length ? "" : " empty");
  const markup = visible.map(match => {
    const [index, rawStatus, sender, , receivedAt] = parseAtCsv(match[1]), status = smsStatus(rawStatus || "READ"), body = decodeSmsBody(match[2]), code = extractVerificationCode(body);
    const key = JSON.stringify([index, sender, receivedAt, body]);
    return `<article data-sms-key="${escapeHtml(key)}" class="sms-card ${["sent","unsent"].includes(status.className) ? "outgoing" : "incoming"}"><div class="sms-card-head"><div class="sms-contact"><strong>${highlightSmsText(sender || t("unknown"), query)}</strong></div><span class="sms-status ${status.className}">${escapeHtml(status.label)}</span></div>${receivedAt ? `<time>${escapeHtml(receivedAt)}</time>` : ""}<p class="sms-body">${highlightSmsText(body, query)}</p>${code ? `<div class="sms-code"><span>${t("otpCode")}</span><strong>${escapeHtml(code)}</strong><button class="secondary compact" data-copy-code="${escapeHtml(code)}">${t("copyCode")}</button></div>` : ""}<div class="sms-card-foot"><span>${escapeHtml(match.local ? t("sentThisSession") : t("smsMessageNumber", {value:index}))}</span>${match.local ? "" : `<button class="secondary compact danger-text" data-sms-delete="${escapeHtml(index)}" ${state.smsDeleteEnabled ? "" : "disabled"}>${t("deleteSms")}</button>`}</div></article>`;
  }).join("") || escapeHtml(state.smsNewDraft || state.smsDrafts.get(state.smsActiveSender)?.message ? t("newMessageHint") : state.smsLastRead || text.includes("+CPMS:") ? t("smsEmpty") : t("noSmsData"));
  if (list.dataset.markup !== markup) {
    list.innerHTML = markup; list.dataset.markup = markup;
    for (const button of list.querySelectorAll("[data-copy-code]")) button.addEventListener("click", async () => {try {await navigator.clipboard.writeText(button.dataset.copyCode); button.textContent = t("copied");} catch {setSmsFeedback("copyCodeFailed", "error");}});
    for (const button of list.querySelectorAll("[data-sms-delete]")) {
      button.addEventListener("click", () => deleteSmsMessage(Number(button.dataset.smsDelete)));
      if (nativeCompanion) {
        button.title = t(state.smsDeleteEnabled ? "deleteSms" : "smsDeleteLocked");
        button.setAttribute("aria-label", `${t("deleteSms")} · ${t("smsMessageNumber", {value: button.dataset.smsDelete})}`);
        const icon = document.createElement("i");
        icon.dataset.lucide = "trash-2";
        icon.setAttribute("aria-hidden", "true");
        button.replaceChildren(icon);
      }
    }
    if (nativeCompanion) window.lucide?.createIcons();
    const currentCards = [...list.querySelectorAll("[data-sms-key]")];
    if (sameConversation && !wasAtBottom) {
      const keys = new Set(currentCards.map(card => card.dataset.smsKey));
      for (const key of keys) if (!previousKeys.has(key)) state.smsPendingKeys.add(key);
      for (const key of state.smsPendingKeys) if (!keys.has(key)) state.smsPendingKeys.delete(key);
      list.scrollTop = previousTop;
      const restored = currentCards.find(card => card.dataset.smsKey === anchor?.dataset.smsKey);
      if (restored) list.scrollTop += restored.getBoundingClientRect().top - list.getBoundingClientRect().top - anchorOffset;
    } else {list.scrollTop = list.scrollHeight; state.smsPendingKeys.clear();}
  }
  updateSmsComposer(); renderSmsRefreshState(); renderSmsNewMessages();
}

function selectSmsConversation(sender) {
  saveSmsDraft();
  state.smsActiveSender = sender; state.smsNewDraft = sender === null;
  const draft = state.smsDrafts.get(sender === null ? "new" : sender);
  document.querySelector("#smsNumberInput").value = draft?.number ?? sender ?? "";
  document.querySelector("#smsMessageInput").value = draft?.message ?? "";
  setSmsFeedback(null); renderSms(state.smsText);
  setNativeSmsPane(true);
  if (nativeCompanion) resetViewScroll();
  const list = document.querySelector("#smsList"); list.scrollTop = list.scrollHeight;
  scrollToSmsSearchMatch();
  document.querySelector(sender === null ? "#smsNumberInput" : nativeCompanion ? "#smsConversationTitle" : "#smsMessageInput").focus({preventScroll: nativeCompanion});
}

function scrollToSmsSearchMatch() {
  if (!state.smsQuery?.trim()) return;
  const list = document.querySelector("#smsList"), match = list.querySelector(".sms-body mark");
  if (!match) return;
  const matchTop = match.getBoundingClientRect().top, cardTop = match.closest(".sms-card").getBoundingClientRect().top;
  const top = matchTop - cardTop < list.clientHeight - 48 ? cardTop : matchTop;
  list.scrollTop += top - list.getBoundingClientRect().top - 16;
}

function setNativeSmsPane(open) {
  if (!nativeCompanion) return;
  state.smsConversationOpen = open;
  document.querySelector("#sms").classList.toggle("native-sms-detail", open);
}

function returnToSmsThreads() {
  if (!nativeCompanion) return;
  saveSmsDraft();
  setNativeSmsPane(false);
  renderSms(state.smsText);
  const thread = [...document.querySelectorAll("[data-sms-thread]")].find(button => button.dataset.smsThread === state.smsActiveSender);
  (state.smsNewDraft ? document.querySelector("#newSmsBtn") : thread || document.querySelector("#smsSearchInput")).focus({preventScroll: true});
  resetViewScroll();
}

async function sendSmsMessage() {
  if (state.busy || state.smsSending || state.confirming) return;
  const number = normalizePhone(document.querySelector("#smsNumberInput").value), message = document.querySelector("#smsMessageInput").value.trim();
  if (!state.smsSendEnabled) {setSmsFeedback("smsSendLocked", "error"); return;}
  if (!/^\+?[0-9]{3,20}$/.test(number) || !message || message.length > 480) {setSmsFeedback("invalidSms", "error"); return;}
  const epoch = state.cardEpoch, key = smsDraftKey();
  if (!await confirmOperation({title:t("sendSms"), description:t("smsConfirmDescription"), details:[[t("recipient"), number], [t("message"), message]], confirmLabel:t("sendSms")})) return;
  if (epoch !== state.cardEpoch) {setSmsFeedback("cardChangedRetry", "error"); return;}
  state.smsSending = true; setBusy(true, "sendSms"); setSmsFeedback("smsSending", "working", {number});
  try {
    const found = await requestAction("find-at"); updateSummary(found.text);
    if (!state.atPort || epoch !== state.cardEpoch) throw new Error("Card unavailable");
    const res = await fetch(`/api/sms-send?port=${encodeURIComponent(state.atPort)}`, {method:"POST", headers:apiHeaders({"content-type":"application/json"}), body:JSON.stringify({number, message, confirm:"SEND"})});
    const data = await res.json(); append(t("sendSms"), textFromResult(data) || JSON.stringify(data));
    if (!res.ok || data.ok === false) throw new Error(data.error || "Send failed");
    if (epoch !== state.cardEpoch) return;
    state.smsSentThisSession.push({number, message, time:new Date().toLocaleTimeString()});
    if (state.smsDrafts.get(key)?.message.trim() === message) state.smsDrafts.delete(key);
    if (smsDraftKey() === key && document.querySelector("#smsMessageInput").value.trim() === message && normalizePhone(document.querySelector("#smsNumberInput").value) === number) {
      document.querySelector("#smsMessageInput").value = ""; state.smsActiveSender = number; state.smsNewDraft = false;
    }
    renderSms(state.smsText); setSmsFeedback("smsSentTo", "success", {number});
  } catch (error) {if (epoch === state.cardEpoch) setSmsFeedback("smsSendFailedDraft", "error"); append(t("sendSms"), error.message);}
  finally {state.smsSending = false; setBusy(false);}
}


function callStateText(call) {
  const key = ({ active: "callActive", held: "callHeld", dialing: "callDialing", alerting: "callAlerting", incoming: "callIncoming", waiting: "callWaiting", disconnected: "callDisconnected" })[call?.state];
  return key ? t(key) : t("callIdle");
}

function rememberCall(call) {
  const key = [call.id, call.direction, call.state, call.number].join(":");
  if (key === state.lastCallKey) return;
  state.lastCallKey = key;
  state.callHistory.unshift({ ...call, observedAt: new Date().toISOString() });
  state.callHistory = state.callHistory.slice(0, 20);
  renderCallHistory();
}

function renderCallHistory() {
  const list = document.querySelector("#callHistory");
  if (!list) return;
  if (!state.callHistory.length) {
    list.className = "call-history empty";
    list.textContent = t("noCallHistory");
    return;
  }
  list.className = "call-history";
  list.innerHTML = state.callHistory.map((call) => {
    const time = new Date(call.observedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const direction = call.direction === "incoming" ? t("incomingCall") : t("outgoingCall");
    return `<article class="call-history-row">
      <span class="call-history-direction ${escapeHtml(call.direction)}">${escapeHtml(direction.slice(0, 1))}</span>
      <div><strong>${escapeHtml(call.number || t("numberUnavailable"))}</strong><span>${escapeHtml(direction)} · ${escapeHtml(callStateText(call))}</span></div>
      <time>${escapeHtml(time)}</time>
    </article>`;
  }).join("");
}



function voiceNetworkText(network) {
  const key = { IMS_DISABLED: "voiceImsDisabled", LTE_NOT_REGISTERED: "voiceLteMissing", VOLTE_NOT_READY: "voiceVolteMissing", IMS_BEARER_INACTIVE: "voiceImsInactive", VOICE_NETWORK_UNVERIFIED: "voiceNetworkUnverified" }[network?.diagnosis];
  return t(key || "voiceNetworkUnknown");
}

function renderVoiceNetwork(network) {
  state.voiceNetwork = network;
  const configured = network?.imsMode === 1;
  const key = network?.imsMode === 2 ? "imsDisabled" : configured ? "imsEnabled" : network?.imsMode === 0 ? "imsDefault" : "statusPending";
  setVoiceStep("voiceNetworkStep", "voiceNetworkState", key, configured && network?.volteEnabled ? "ready" : network?.imsMode === null || !network ? "pending" : "warning");
  document.querySelector("#voiceNetworkDescription").textContent = voiceNetworkText(network);
  const button = document.querySelector("#enableImsBtn");
  button.disabled = state.voiceSetupBusy || !state.voiceRuntimeEnabled || !state.callCapabilityData?.voiceSetupSupported || configured;
  document.querySelector("#restoreImsBtn").disabled = state.voiceSetupBusy || !state.voiceRuntimeEnabled || !state.callCapabilityData?.imsBackupAvailable;
}

function showVoiceSetupFeedback(key, params = {}, tone = "working") {
  state.voiceSetupFeedback = { key, params, tone };
  const message = document.querySelector("#voiceSetupMessage");
  message.textContent = t(key, params);
  message.dataset.tone = tone;
}

function setVoiceStep(rowId, labelId, labelKey, status) {
  const row = document.querySelector("#" + rowId);
  const label = document.querySelector("#" + labelId);
  if (row) row.dataset.state = status;
  if (label) label.textContent = t(labelKey);
}

function renderVoiceSetup(data) {
  state.voiceRuntimeStatus = data;
  const runtime = data?.runtime || {};
  const pnp = data?.voiceUsb || {};
  const downloaded = Boolean(runtime.local?.downloaded);
  const moduleVerified = Boolean(state.atPort && state.callCapabilityData?.ok && state.callCapabilityData?.voiceSetupSupported);
  const usbConfigured = Boolean(pnp.adbInterfacePresent || pnp.audioInputPresent || pnp.audioOutputPresent);
  const usbReady = Boolean(pnp.adbWinUsb && pnp.standardUsbAudio);
  const prepared = Boolean(runtime.prepared && runtime.adb?.root && runtime.adb?.kernelCompatible);
  renderVoiceNetwork(state.voiceNetwork || state.callCapabilityData?.voiceNetwork);

  setVoiceStep("voiceRuntimeStep", "voiceRuntimeState", downloaded ? "runtimeDownloaded" : "runtimeMissing", downloaded ? "ready" : "pending");
  setVoiceStep(
    "voiceUsbStep",
    "voiceUsbState",
    usbReady ? "usbReady" : usbConfigured ? "usbDriverNeeded" : "usbSetupNeeded",
    usbReady ? "ready" : usbConfigured ? "warning" : "pending",
  );
  setVoiceStep("voicePrepareStep", "voicePrepareState", prepared ? "runtimePrepared" : "runtimeNotPrepared", prepared ? "ready" : "pending");

  const driverNote = document.querySelector("#voiceDriverNote");
  if (driverNote) driverNote.hidden = !(pnp.adbInterfacePresent && !pnp.adbWinUsb);

  const downloadButton = document.querySelector("#downloadVoiceRuntimeBtn");
  const enableButton = document.querySelector("#enableVoiceUsbBtn");
  const prepareButton = document.querySelector("#prepareVoiceRuntimeBtn");
  const restoreButton = document.querySelector("#restoreVoiceUsbBtn");
  if (downloadButton) downloadButton.disabled = state.voiceSetupBusy || !state.voiceRuntimeEnabled || downloaded;
  if (enableButton) enableButton.disabled = state.voiceSetupBusy || !state.voiceRuntimeEnabled || !moduleVerified || !downloaded || (pnp.adbInterfacePresent && pnp.standardUsbAudio);
  if (prepareButton) prepareButton.disabled = state.voiceSetupBusy || !state.voiceRuntimeEnabled || !moduleVerified || !downloaded || !pnp.adbWinUsb || !pnp.standardUsbAudio || prepared;
  if (restoreButton) restoreButton.disabled = state.voiceSetupBusy || !state.voiceRuntimeEnabled || !moduleVerified;

  const supported = state.callCapabilityData ? Boolean(state.callCapabilityData.voiceSetupSupported) : true;
  const message = document.querySelector("#voiceSetupMessage");
  if (message) {
    message.textContent = !state.atPort ? t("callConnectFirst") : state.voiceSetupFeedback ? t(state.voiceSetupFeedback.key, state.voiceSetupFeedback.params) : !state.callCapabilityData?.ok
      ? t("callReadFailed") : !supported
      ? t("voiceSetupUnsupported")
      : prepared && usbReady
        ? t(localAudioBridgeHost ? "voiceSetupReady" : "voiceSetupLocalOnly")
        : t("voiceSetupWaiting");
  }
  syncCallButtons();
}

async function refreshVoiceSetup() {
  const epoch = state.cardEpoch;
  const portName = state.atPort;
  if (state.callCapabilityRefresh && state.callCapabilityRefreshEpoch === epoch) return state.callCapabilityRefresh;
  if (state.voiceSetupBusy && !state.callCapabilityRefresh) return null;
  state.voiceSetupBusy = true;
  state.callCapabilityRefreshEpoch = epoch;
  if (state.voiceRuntimeStatus) renderVoiceSetup(state.voiceRuntimeStatus);
  const pending = (async () => {
    try {
      const port = encodeURIComponent(portInput.value.trim());
      const capabilities = await fetchJson("/api/call-capabilities?port=" + port, 90000);
      if (state.cardEpoch !== epoch || state.atPort !== portName) return null;
      if (capabilities.ok === false) throw new Error(t("callReadFailed"));
      renderCallCapabilities(capabilities);
      return capabilities;
    } catch (error) {
      if (state.cardEpoch === epoch) append(t("voiceSetupTitle"), error.message || String(error));
      return null;
    } finally {
      if (state.callCapabilityRefresh === pending) {
        state.callCapabilityRefresh = null;
        state.voiceSetupBusy = false;
        if (state.voiceRuntimeStatus) renderVoiceSetup(state.voiceRuntimeStatus);
      }
    }
  })();
  state.callCapabilityRefresh = pending;
  return pending;
}

async function runVoiceSetupAction(pathname, confirmation, promptKey, timeoutMs = 360000) {
  if (state.voiceSetupBusy) return;
  if (!state.voiceRuntimeEnabled) {
    append(t("voiceSetupTitle"), t("voiceActionFailed"));
    return;
  }
  if (pathname !== "/api/voice-runtime-download" && (!state.atPort || !state.callCapabilityData?.ok || !state.callCapabilityData?.voiceSetupSupported)) {
    showVoiceSetupFeedback(!state.atPort ? "callConnectFirst" : !state.callCapabilityData?.ok ? "callReadFailed" : "voiceSetupUnsupported", {}, "error");
    return;
  }
  if (!window.confirm(t(promptKey))) return;
  state.voiceSetupBusy = true;
  if (state.voiceRuntimeStatus) renderVoiceSetup(state.voiceRuntimeStatus);
  const downloading = pathname === "/api/voice-runtime-download";
  showVoiceSetupFeedback(downloading ? "voiceDownloadStarting" : "voiceWorking");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let polling = false;
  let progressDone = false;
  const progressTimer = downloading ? setInterval(async () => {
    if (polling) return;
    polling = true;
    try {
      const progress = await fetchJson("/api/voice-download-status", 5000);
      if (!progressDone && progress.phase === "downloading" && progress.file) showVoiceSetupFeedback("voiceDownloadProgress", { file: progress.file, percent: Math.min(100, Math.round(progress.receivedBytes / progress.totalBytes * 100)) });
    } catch {} finally { polling = false; }
  }, 1000) : null;
  try {
    const port = encodeURIComponent(portInput.value.trim());
    const response = await fetch(pathname + "?port=" + port, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ confirm: confirmation }),
      signal: controller.signal,
    });
    const data = await response.json();
    progressDone = true;
    append(t("voiceSetupTitle"), textFromResult(data) || JSON.stringify(data, null, 2));
    clearInterval(progressTimer);
    if (!response.ok || data.ok === false) {
      const error = new Error(data.error || t("voiceActionFailed"));
      error.code = data.code;
      throw error;
    }
    showVoiceSetupFeedback(data.rebootRequested ? "voiceReconnecting" : "voiceActionDone", {}, "success");
    if (data.voiceNetwork) renderVoiceNetwork(data.voiceNetwork);
    if (data.rebootRequested) {
      setTimeout(() => refreshVoiceSetup(), 15000);
    } else {
      state.voiceSetupBusy = false;
      await refreshVoiceSetup();
    }
  } catch (error) {
    clearInterval(progressTimer);
    const key = error.name === "AbortError" ? "timedOut" : error.code === "VOICE_DOWNLOAD_INTEGRITY" ? "voiceDownloadIntegrity"
      : error.code === "VOICE_DOWNLOAD_STORAGE" ? "voiceDownloadStorage" : /^VOICE_DOWNLOAD_(NETWORK|HTTP)$/.test(error.code || "") ? "voiceDownloadNetwork" : "voiceActionFailed";
    showVoiceSetupFeedback(key, {}, "error");
    showFeedback(t(key), "error");
    append(t("voiceSetupTitle"), error.name === "AbortError" ? t("timedOut") : (error.message || String(error)));
  } finally {
    progressDone = true;
    clearTimeout(timer);
    clearInterval(progressTimer);
    state.voiceSetupBusy = false;
    if (state.voiceRuntimeStatus) renderVoiceSetup(state.voiceRuntimeStatus);
  }
}

const moduleAudioPattern = /(quectel|qdc507|baiwang|ac interface|as interface)/i;
const localAudioBridgeHost = !nativeCompanion && ["127.0.0.1", "localhost", "::1"].includes(location.hostname);

function isModuleAudioDevice(device) {
  return moduleAudioPattern.test(String(device?.label || ""));
}

function fillAudioDeviceSelect(select, devices, storageKey, labelKey) {
  const preferred = select.value || localStorage.getItem(storageKey) || "default";
  select.replaceChildren();
  devices.forEach((device, index) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || t(labelKey, { index: index + 1 });
    select.appendChild(option);
  });
  const selected = devices.find((device) => device.deviceId === preferred)
    || devices.find((device) => device.deviceId === "default")
    || devices[0];
  select.value = selected?.deviceId || "";
  select.disabled = !localAudioBridgeHost || !selected || Boolean(state.audioBridge) || state.audioBridgeStarting;
  if (selected) localStorage.setItem(storageKey, selected.deviceId);
}

function renderAudioDeviceOptions(devices) {
  const systemInputs = devices.filter((device) => device.kind === "audioinput" && !isModuleAudioDevice(device));
  const systemOutputs = devices.filter((device) => device.kind === "audiooutput" && !isModuleAudioDevice(device));
  fillAudioDeviceSelect(document.querySelector("#callMicrophoneSelect"), systemInputs, "callMicrophoneId", "microphoneOption");
  fillAudioDeviceSelect(document.querySelector("#callSpeakerSelect"), systemOutputs, "callSpeakerId", "speakerOption");
  return { systemInputs, systemOutputs };
}

async function refreshAudioDeviceOptions(requestPermission = false) {
  if (!localAudioBridgeHost || !navigator.mediaDevices?.enumerateDevices) return [];
  let permissionStream = null;
  try {
    let devices = await navigator.mediaDevices.enumerateDevices();
    renderAudioDeviceOptions(devices);
    const labeledSystemInput = devices.some(device => device.kind === "audioinput" && device.label && !isModuleAudioDevice(device));
    if (requestPermission && !labeledSystemInput) {
      permissionStream = await openChosenMicrophone(devices);
      devices = await navigator.mediaDevices.enumerateDevices();
      renderAudioDeviceOptions(devices);
    }
    return devices;
  } finally {
    stopStream(permissionStream);
  }
}

async function refreshAudioDevicesFromButton() {
  try {
    await refreshAudioDeviceOptions(true);
    setCallFeedback(t("audioDevicesReady"), "success");
  } catch (error) {
    setCallFeedback(t("audioPermissionFailed"), "error");
    append(t("audioBridge"), error.message || String(error));
  }
  syncCallButtons();
}

function stopStream(stream) {
  for (const track of stream?.getTracks?.() || []) track.stop();
}

function stopAudioElement(element) {
  if (!element) return;
  element.pause();
  element.srcObject = null;
}

function stopModuleVoiceRoute(keepalive = false) {
  return fetch("/api/voice-route-stop", {
    method: "POST",
    headers: apiHeaders({ "content-type": "application/json" }),
    body: "{}",
    keepalive,
  }).catch(() => null);
}

function stopAudioBridge(messageKey = "audioNotConnected", notifyServer = true) {
  state.audioStartGeneration = (state.audioStartGeneration || 0) + 1;
  const bridge = state.audioBridge;
  stopStream(bridge?.moduleDownlink);
  stopStream(bridge?.microphoneStream);
  stopAudioElement(bridge?.downlinkAudio);
  stopAudioElement(bridge?.uplinkAudio);
  state.audioBridge = null;
  if (notifyServer && bridge?.moduleRouteStarted) stopModuleVoiceRoute();
  const label = document.querySelector("#audioBridgeState");
  if (label) label.textContent = t(messageKey);
  syncCallButtons();
}

function physicalSystemAudioDevice(devices, kind, preferred) {
  const physical = devices.filter(device => device.kind === kind && !isModuleAudioDevice(device) && !["default", "communications"].includes(device.deviceId));
  const selected = devices.find(device => device.kind === kind && device.deviceId === preferred && !isModuleAudioDevice(device));
  return physical.find(device => device.deviceId === preferred)
    || (selected?.groupId ? physical.find(device => device.groupId === selected.groupId) : null)
    || physical[0];
}

async function openChosenMicrophone(devices) {
  const { systemInputs } = renderAudioDeviceOptions(devices);
  const microphone = physicalSystemAudioDevice(systemInputs, "audioinput", document.querySelector("#callMicrophoneSelect").value);
  if (!microphone) throw new Error(t("audioEndpointMissing"));
  // A plugged-in modem can become Windows' default microphone before its route is ready.
  return navigator.mediaDevices.getUserMedia({ audio: {
    deviceId: { exact: microphone.deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
  } });
}

async function waitForModuleAudioDevices(checkCurrent) {
  const deadline = Date.now() + 8000;
  do {
    checkCurrent();
    const devices = await navigator.mediaDevices.enumerateDevices();
    const physical = devices.filter(device => !["default", "communications"].includes(device.deviceId));
    const moduleInput = physical.find(device => device.kind === "audioinput" && isModuleAudioDevice(device));
    const moduleOutput = physical.find(device => device.kind === "audiooutput" && isModuleAudioDevice(device));
    if (moduleInput && moduleOutput) return { devices, moduleInput, moduleOutput };
    await new Promise(resolve => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  throw new Error(t("audioEndpointMissing"));
}

async function startAudioBridge() {
  if (state.audioBridgeStarting || state.audioBridge) return Boolean(state.audioBridge);
  const call = state.callStatusData?.voiceCalls?.[0] || null;
  if (!call || call.statusPending || !["active", "held"].includes(call.state)) {
    append(t("audioBridge"), t("audioNeedsCall"));
    return false;
  }
  if (!localAudioBridgeHost || !navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
    append(t("audioBridge"), t("audioBridgeUnavailable"));
    return false;
  }
  if (!state.callCapabilityData?.standardUsbAudio || !state.voiceRuntimeStatus?.runtime?.local?.downloaded) {
    append(t("audioBridge"), t("audioEndpointMissing"));
    setCallFeedback(t("audioEndpointMissing"), "error");
    return false;
  }

  state.audioBridgeStarting = true;
  const generation = state.audioStartGeneration = (state.audioStartGeneration || 0) + 1;
  const epoch = state.cardEpoch;
  const current = () => generation === state.audioStartGeneration && epoch === state.cardEpoch &&
    state.callStatusData?.voiceCalls?.some(item => item.id === call.id && item.direction === call.direction && ["active", "held"].includes(item.state));
  const checkCurrent = () => { if (!current()) throw new Error(t("hangupAccepted")); };
  syncCallButtons();
  let moduleRouteStarted = false;
  let moduleDownlink = null;
  let microphoneStream = null;
  let downlinkAudio = null;
  let uplinkAudio = null;

  try {
    checkCurrent();

    const port = encodeURIComponent(portInput.value.trim());
    const routeResponse = await fetch("/api/voice-route-start?port=" + port, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ confirm: "AUDIO" }),
      signal: AbortSignal.timeout(90000),
    });
    const routeData = await routeResponse.json();
    if (!routeResponse.ok || routeData.ok === false) throw new Error(routeData.error || t("audioRouteFailed"));
    moduleRouteStarted = true;
    checkCurrent();

    const { devices, moduleInput, moduleOutput } = await waitForModuleAudioDevices(checkCurrent);
    microphoneStream = await openChosenMicrophone(devices);
    checkCurrent();
    const { systemOutputs } = renderAudioDeviceOptions(devices);
    const speakerId = document.querySelector("#callSpeakerSelect").value;
    const systemOutput = physicalSystemAudioDevice(systemOutputs, "audiooutput", speakerId);
    if (!systemOutput || microphoneStream.getTracks().some(track => track.readyState === "ended")) throw new Error(t("audioEndpointMissing"));
    checkCurrent();

    moduleDownlink = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: moduleInput.deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    checkCurrent();

    downlinkAudio = new Audio();
    downlinkAudio.autoplay = true;
    downlinkAudio.srcObject = moduleDownlink;
    if (typeof downlinkAudio.setSinkId === "function" && systemOutput?.deviceId && systemOutput.deviceId !== "default") {
      await downlinkAudio.setSinkId(systemOutput.deviceId);
    }

    uplinkAudio = new Audio();
    uplinkAudio.autoplay = true;
    uplinkAudio.srcObject = microphoneStream;
    if (typeof uplinkAudio.setSinkId !== "function") throw new Error(t("audioBridgeUnavailable"));
    await uplinkAudio.setSinkId(moduleOutput.deviceId);
    await Promise.all([downlinkAudio.play(), uplinkAudio.play()]);
    checkCurrent();

    state.audioBridge = { moduleDownlink, microphoneStream, downlinkAudio, uplinkAudio, moduleRouteStarted };
    document.querySelector("#audioBridgeState").textContent = t("audioBridgeActive");
    return true;
  } catch (error) {
    stopStream(moduleDownlink);
    stopStream(microphoneStream);
    stopAudioElement(downlinkAudio);
    stopAudioElement(uplinkAudio);
    if (moduleRouteStarted) await stopModuleVoiceRoute();
    document.querySelector("#audioBridgeState").textContent = t("audioBridgeUnavailable");
    const messageKey = ["NotAllowedError", "SecurityError"].includes(error.name) ? "audioPermissionFailed"
      : ["NotFoundError", "OverconstrainedError"].includes(error.name) ? "audioEndpointMissing" : "audioRouteFailed";
    append(t("audioBridge"), t(messageKey) + " " + (error.message || ""));
    if (current()) setCallFeedback(t(messageKey) + " " + (error.message || ""), "error");
    return false;
  } finally {
    state.audioBridgeStarting = false;
    syncCallButtons();
  }
}

async function prepareLocalCallAudio() {
  if (!localAudioBridgeHost || !state.voiceRuntimeEnabled || state.automaticCallAudioEnabled === false) return;
  const epoch = state.cardEpoch;
  if (!state.callCapabilityData?.ok) await refreshVoiceSetup();
  if (state.cardEpoch !== epoch) throw new Error(t("cardChangedRetry"));
  if (!state.callCapabilityData?.ok) throw new Error(t("callReadFailed"));
  if (!state.callCapabilityData.standardUsbAudio || !state.voiceRuntimeStatus?.runtime?.local?.downloaded) return;
  setCallFeedback(t("callAudioPreparing"), "working");
  await refreshAudioDeviceOptions(true);
  if (state.cardEpoch !== epoch) throw new Error(t("cardChangedRetry"));
  if (!state.voiceRuntimeStatus.runtime.prepared) {
    const response = await fetch("/api/voice-runtime-prepare", {
      method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ confirm: "PREPAREVOICE" }), signal: AbortSignal.timeout(90000),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true || result.prepared !== true) throw new Error(result.error || t("audioRouteFailed"));
    if (state.cardEpoch !== epoch) throw new Error(t("cardChangedRetry"));
    state.voiceRuntimeStatus.runtime.prepared = true;
  }
  if (state.cardEpoch !== epoch) throw new Error(t("cardChangedRetry"));
}

function setAutomaticCallAudio(enabled) {
  state.automaticCallAudioEnabled = Boolean(enabled);
  state.automaticCallAudio = null;
  try { localStorage.setItem("callAutomaticAudio", enabled ? "1" : "0"); }
  catch (error) { append(t("audioBridge"), error.message); }
  syncCallButtons();
}

function armAutomaticCallAudio(action) {
  state.callEndReadGeneration = (state.callEndReadGeneration || 0) + 1;
  state.automaticCallAudio = localAudioBridgeHost && state.automaticCallAudioEnabled !== false ? {
    epoch: state.cardEpoch, direction: action === "answer" ? "incoming" : "outgoing",
    id: action === "answer" ? state.callStatusData?.voiceCalls?.[0]?.id : null, attempted: false, createdAt: Date.now(),
  } : null;
}

async function connectAutomaticCallAudio(call) {
  const intent = state.automaticCallAudio;
  if (intent && Date.now() - intent.createdAt > 90000 && intent.id === null) { state.automaticCallAudio = null; return; }
  if (state.automaticCallAudioEnabled === false || !intent || intent.attempted || state.audioBridgeStarting || state.audioBridge ||
      intent.epoch !== state.cardEpoch || call?.state !== "active" || call.direction !== intent.direction ||
      (intent.id !== null && intent.id !== call.id) || (state.busy && !state.callActionInFlight)) return;
  intent.id = call.id;
  intent.attempted = true;
  setCallFeedback(t("callAudioConnecting"), "working");
  await startAudioBridge();
}

async function inspectEndedCall() {
  const epoch = state.cardEpoch;
  const generation = state.callEndReadGeneration = (state.callEndReadGeneration || 0) + 1;
  const current = () => epoch === state.cardEpoch && generation === state.callEndReadGeneration && !state.callStatusData?.callStateUncertain && !state.callStatusData?.voiceCalls?.length;
  try {
    const data = await fetchJson("/api/call-end-reason?port=" + encodeURIComponent(portInput.value.trim()), 60000);
    if (!current()) return;
    if (data.ok === false) throw new Error("End reason unavailable");
    renderVoiceNetwork(data.voiceNetwork);
    append(t("callStatus"), textFromResult(data));
    if (data.voiceNetwork?.lastFailure) setCallFeedback(t("callEndedReason", { reason: data.voiceNetwork.lastFailure }), "neutral");
  } catch {
    if (current()) setCallFeedback(t("callEndReadFailed"), "neutral");
  }
}

function syncCallButtons() {
  const call = state.callStatusData?.voiceCalls?.[0] || null;
  const unavailable = !state.callActionsEnabled || state.callActionInFlight || !state.atPort || state.cardReady === false;
  const locked = unavailable || state.busy;
  const pending = state.callStatusData?.callStateUncertain;
  const incoming = state.callStatusData?.activity === 3 || (!pending && call && ["incoming", "waiting"].includes(call.state));
  const connected = !pending && call && ["active", "held"].includes(call.state);
  const answer = document.querySelector("#answerCallBtn");
  const hangup = document.querySelector("#hangupCallBtn");
  const dial = document.querySelector("#dialCallBtn");
  const dtmf = document.querySelector("#sendDtmfBtn");
  const callerId = document.querySelector("#enableCallerIdBtn");
  const startAudio = document.querySelector("#startAudioBridgeBtn");
  const stopAudio = document.querySelector("#stopAudioBridgeBtn");
  const refreshAudioDevices = document.querySelector("#refreshAudioDevicesBtn");
  const microphoneSelect = document.querySelector("#callMicrophoneSelect");
  const speakerSelect = document.querySelector("#callSpeakerSelect");
  const automaticAudio = document.querySelector("#automaticCallAudioInput");
  if (automaticAudio) {
    automaticAudio.checked = state.automaticCallAudioEnabled !== false;
    automaticAudio.disabled = !localAudioBridgeHost || state.audioBridgeStarting || state.callActionInFlight;
  }
  const refreshSetup = document.querySelector("#refreshVoiceSetupBtn");
  const audioReady = Boolean(
    localAudioBridgeHost &&
    state.callCapabilityData?.standardUsbAudio === true &&
    state.voiceRuntimeStatus?.runtime?.local?.downloaded === true,
  );
  if (answer) answer.disabled = unavailable || !incoming;
  if (hangup) hangup.disabled = unavailable || (!call && !pending);
  if (dial) dial.disabled = locked || state.postDialRunning || state.callStatusReadError || state.callStatusData?.ok !== true || Boolean(call) || !parseDialInput(document.querySelector("#callNumberInput").value);
  if (dtmf) dtmf.disabled = locked || state.postDialRunning || !connected;
  if (callerId) callerId.disabled = locked || state.callStatusData?.callerIdEnabled === true;
  if (startAudio) startAudio.disabled = state.audioBridgeStarting || Boolean(state.audioBridge) || !connected || !audioReady;
  if (stopAudio) stopAudio.disabled = !state.audioBridge && !state.callStatusData?.voiceRouteActive;
  if (refreshAudioDevices) refreshAudioDevices.disabled = !localAudioBridgeHost || state.audioBridgeStarting || Boolean(state.audioBridge) || !connected;
  if (microphoneSelect) microphoneSelect.disabled = !localAudioBridgeHost || state.audioBridgeStarting || Boolean(state.audioBridge) || !microphoneSelect.options.length;
  if (speakerSelect) speakerSelect.disabled = !localAudioBridgeHost || state.audioBridgeStarting || Boolean(state.audioBridge) || !speakerSelect.options.length;
  if (refreshSetup) refreshSetup.disabled = state.voiceSetupBusy;
  renderCallGuidance();
}

function cancelPendingPostDial() {
  state.postDialGeneration += 1;
  state.postDialAbortController?.abort();
  state.postDialAbortController = null;
  state.pendingPostDial = null;
  state.postDialRunning = false;
  syncCallButtons();
}

function schedulePostDial(sequence) {
  cancelPendingPostDial();
  state.pendingPostDial = { sequence, generation: state.postDialGeneration, createdAt: Date.now() };
  setCallFeedback(t("postDialWaiting"), "working");
  syncCallButtons();
}

async function runPendingPostDial(call) {
  const plan = state.pendingPostDial;
  if (!plan || state.postDialRunning || call?.direction !== "outgoing" || !["active", "held"].includes(call.state)) return;
  state.postDialRunning = true;
  setCallFeedback(t("postDialSending"), "working");
  syncCallButtons();
  let sent = 0;
  try {
    for (const token of plan.sequence) {
      if (plan.generation !== state.postDialGeneration) return;
      if (token === ",") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      const active = state.callStatusData?.voiceCalls?.[0];
      if (!active || active.statusPending || !["active", "held"].includes(active.state)) throw new Error("Call is not confirmed connected.");
      const controller = new AbortController();
      state.postDialAbortController = controller;
      const timer = setTimeout(() => controller.abort(), 15000);
      let response;
      try {
        response = await fetch(`/api/call-action?port=${encodeURIComponent(portInput.value.trim())}`, {
          method: "POST",
          headers: apiHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ action: "dtmf", digits: token, confirm: "DTMF" }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
        if (state.postDialAbortController === controller) state.postDialAbortController = null;
      }
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || "DTMF was not accepted.");
      sent += 1;
    }
    if (plan.generation === state.postDialGeneration) {
      state.pendingPostDial = null;
      setCallFeedback(t("postDialComplete"), "success");
      append(t("postDialLabel"), `${sent} key(s)`);
    }
  } catch (error) {
    if (plan.generation === state.postDialGeneration) {
      state.pendingPostDial = null;
      setCallFeedback(t("postDialFailed"), "error");
      append(t("postDialLabel"), error.message);
    }
  } finally {
    if (plan.generation === state.postDialGeneration) state.postDialRunning = false;
    syncCallButtons();
  }
}

function renderCallStatus(data) {
  if (data?.ok === false) {state.callStatusReadError = true; syncCallButtons(); return;}
  data = { ...data, callerIdEnabled: data?.callerIdEnabled ?? state.callStatusData?.callerIdEnabled ?? state.callCapabilityData?.callerIdEnabled ?? null };
  const receivedCall = data?.voiceCalls?.find(call => !call.statusPending && call.state !== "disconnected") || null;
  // Missing CPAS is unknown, not idle. Keep the last call clearly marked as pending.
  const pending = !receivedCall && data?.activity !== 0 && Boolean(
    [3, 4].includes(data?.activity) || state.lastVoiceCall || state.audioBridge || state.audioBridgeStarting || data?.voiceRouteActive || state.automaticCallAudio,
  );
  const call = receivedCall || (pending && state.lastVoiceCall ? { ...state.lastVoiceCall, statusPending: true } : null);
  data = { ...data, voiceCalls: receivedCall ? data.voiceCalls : call ? [call] : [], callStateUncertain: pending };
  state.callStatusReadError = pending;
  state.callStatusData = data;
  const endedCall = !call && !pending && Boolean(state.lastVoiceCall);
  if (receivedCall) {
    rememberCall(call);
    state.lastVoiceCall = { ...call };
  } else if (endedCall) {
    rememberCall({ ...state.lastVoiceCall, state: "disconnected", stateCode: 6 });
    state.lastVoiceCall = null;
    state.automaticCallAudio = null;
    inspectEndedCall();
  }
  // Only tear down the audio bridge when confident the call actually ended.
  if (!call && !pending && (state.audioBridge || state.audioBridgeStarting)) stopAudioBridge();
  if (!call && state.pendingPostDial && (endedCall || Date.now() - state.pendingPostDial.createdAt > 90000)) cancelPendingPostDial();
  if (pending) setCallFeedback(t("callStatePending"), "working");
  else if (state.postDialRunning) setCallFeedback(t("postDialSending"), "working");
  else if (state.pendingPostDial) setCallFeedback(t("postDialWaiting"), "working");
  else if (call) setCallFeedback(callStateText(call), ["active", "incoming", "waiting"].includes(call.state) ? "success" : "working");
  else if (endedCall) setCallFeedback(t("hangupAccepted"), "neutral");
  if (receivedCall) runPendingPostDial(receivedCall);

  const stage = document.querySelector("#callStatus");
  stage.dataset.state = pending ? "pending" : call?.state || "idle";
  document.querySelector("#callStateLabel").textContent = pending ? t("callChecking") : call ? callStateText(call) : t("callIdle");
  document.querySelector("#callDirectionLabel").textContent = call ? (call.direction === "incoming" ? t("incomingCall") : t("outgoingCall")) : pending ? t("notChecked") : t("noActiveCall");
  document.querySelector("#callNumber").textContent = call?.number || (call ? t("numberUnavailable") : "--");
  document.querySelector("#callMeta").textContent = pending ? t("callStatePending") : call ? `${t("callId", { id: call.id })} · ${callStateText(call)}` : t("waitingForCall");
  document.querySelector("#callerIdState").textContent = data?.callerIdEnabled === true ? t("callerIdOn") : data?.callerIdEnabled === false ? t("callerIdOff") : t("notChecked");
  if (call?.state === "incoming" || call?.state === "waiting") {
    statusPill.textContent = t("callIncoming");
    statusPill.classList.add("incoming");
  } else {
    statusPill.classList.remove("incoming");
    renderConnectionState();
  }
  syncCallButtons();
  if (receivedCall) connectAutomaticCallAudio(receivedCall);
}

function renderCallCapabilities(data) {
  state.callCapabilityData = data;
  renderVoiceNetwork(data?.voiceNetwork);
  const runtime = data?.runtime || {};
  const pnp = data?.voiceUsb || {};
  const runtimeState = document.querySelector("#rawPcmState");
  const windowsAudioState = document.querySelector("#windowsAudioState");
  if (runtimeState) {
    runtimeState.textContent = runtime.prepared
      ? t("runtimePrepared")
      : runtime.local?.downloaded
        ? t("runtimeDownloaded")
        : data?.qpcmvKnownBlocked
          ? t("qpcmvBlocked")
          : t("runtimeMissing");
  }
  if (windowsAudioState) windowsAudioState.textContent = data?.standardUsbAudio ? t("audioDeviceFound") : t("noStandardAudio");
  document.querySelector("#callerIdState").textContent = data?.callerIdSupported ? (state.callStatusData?.callerIdEnabled ? t("callerIdOn") : t("supported")) : t("unsupported");
  document.querySelector("#atCallState").textContent = data?.ok ? t("available") : t("unsupported");
  document.querySelector("#voiceBridgeState").textContent = data?.standardUsbAudio && runtime.local?.downloaded
    ? t("audioBridgeReady")
    : data?.voiceSetupSupported
      ? t("runtimeNotPrepared")
      : t("unsupported");
  if (!state.audioBridge) document.querySelector("#audioBridgeState").textContent = t("audioNotConnected");
  renderVoiceSetup({ ok: true, runtime, voiceUsb: pnp, voiceSetupSupported: data?.voiceSetupSupported });
}

async function refreshCallStatusQuietly(force = false) {
  const liveOrPending = Boolean(state.callActionInFlight || state.automaticCallAudio || state.callStatusData?.callStateUncertain || state.callStatusData?.voiceCalls?.length);
  // A hidden desktop window must still connect and release audio for its own call.
  if (state.callRefreshInFlight || (document.hidden && !force && !liveOrPending) || (!force && !liveOrPending && (!state.callMonitoring || state.busy))) return;
  const cadence = state.automaticCallAudio || state.callStatusData?.callStateUncertain || state.callStatusData?.voiceCalls?.length ? 1000 : 3500;
  if (!force && Date.now() - (state.lastCallReadStarted || 0) < cadence) return;
  state.lastCallReadStarted = Date.now();
  state.callRefreshInFlight = true;
  const epoch = state.cardEpoch;
  try {
    const { data } = await requestAction("call-status");
    if (state.cardEpoch !== epoch) return;
    renderCallStatus(data);
  } catch (error) {
    if (state.cardEpoch === epoch) {
      state.callStatusReadError = true;
      syncCallButtons();
      if (force) append(t("callStatus"), error.message);
    }
  } finally {
    state.callRefreshInFlight = false;
    syncCallButtons();
  }
}

function toggleCallMonitoring(forceOn = false) {
  state.callMonitoring = forceOn || !state.callMonitoring;
  const button = document.querySelector("#callMonitorBtn");
  if (button) {
    button.textContent = state.callMonitoring ? t("stopCallMonitor") : t("monitorCalls");
    button.classList.toggle("active-monitor", state.callMonitoring);
  }
  if (state.callMonitoring) refreshCallStatusQuietly(true);
}

function setCallFeedback(message, tone = "neutral") {
  const feedback = document.querySelector("#callFeedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.dataset.tone = tone;
}

async function runCallAction(action) {
  const urgent = action === "answer" || action === "hangup";
  if ((!urgent && state.busy) || state.callActionInFlight || state.confirming) return;
  if (!state.callActionsEnabled) {
    setCallFeedback(t("callControlsLocked"), "error");
    append(t("calls"), t("callControlsLocked"));
    return;
  }

  const body = { action };
  let label = t("calls");
  let successKey = "dialAccepted";
  if (action === "dial") {
    const dial = parseDialInput(document.querySelector("#callNumberInput").value);
    if (!dial) {
      setCallFeedback(t("invalidCallNumber"), "error");
      return;
    }
    body.number = dial.compact;
    body.confirm = "DIAL";
    label = t("dialCall");
  } else if (action === "answer") {
    body.confirm = "ANSWER";
    label = t("answerCall");
    successKey = "answerAccepted";
  } else if (action === "hangup") {
    cancelPendingPostDial();
    body.confirm = "HANGUP";
    label = t("hangupCall");
    successKey = "hangupAccepted";
  } else if (action === "dtmf") {
    body.digits = document.querySelector("#dtmfInput").value.trim();
    if (!/^[0-9*#]{1,32}$/.test(body.digits)) {
      setCallFeedback(t("invalidDtmf"), "error");
      return;
    }
    body.confirm = "DTMF";
    label = t("sendDtmf");
    successKey = "dtmfAccepted";
  } else if (action === "caller-id") {
    body.confirm = "CALLERID";
    label = t("enableCallerId");
    successKey = "callerIdOn";
  }

  state.callActionInFlight = true;
  setCallFeedback(t(state.busy ? "callQueued" : "callSending"), "working");
  if (!urgent) setBusy(true, "running");
  else syncCallButtons();
  try {
    if (["dial", "answer"].includes(action)) await prepareLocalCallAudio();
    const port = encodeURIComponent(portInput.value.trim());
    const res = await fetch(`/api/call-action?port=${port}`, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
    const data = await res.json();
    const raw = textFromResult(data) || JSON.stringify(data, null, 2);
    append(label, raw);
    if (res.ok && data.ok === true) {
      if (action === "caller-id") {
        if (state.callCapabilityData) state.callCapabilityData.callerIdEnabled = true;
        if (state.callStatusData) state.callStatusData.callerIdEnabled = true;
      }
      if (["dial", "answer"].includes(action)) armAutomaticCallAudio(action);
      if (action === "hangup") state.automaticCallAudio = null;
      if (action === "dial" && data.postDial) schedulePostDial(data.postDial);
      else setCallFeedback(t(successKey), "success");
      if (action === "dtmf") document.querySelector("#dtmfInput").value = "";
      await new Promise((resolve) => setTimeout(resolve, 500));
      await refreshCallStatusQuietly(true);
    } else {
      if (data.voiceNetwork) renderVoiceNetwork(data.voiceNetwork);
      const detail = data.voiceNetwork?.diagnosis && data.voiceNetwork.diagnosis !== "VOICE_NETWORK_UNVERIFIED" ? voiceNetworkText(data.voiceNetwork)
        : data.voiceNetwork?.lastFailure ? t("voiceFailureReason", { reason: data.voiceNetwork.lastFailure }) : "";
      setCallFeedback(detail || (res.status === 502 || /(^|\r?\n)(ERROR|NO CARRIER)(\r?\n|$)/i.test(raw) ? t("callRejected") : (data.error || t("callRequestFailed"))), "error");
    }
  } catch (error) {
    setCallFeedback(t("callRequestFailed") + " " + (error.message || ""), "error");
    append(label, error.stack || error.message);
  } finally {
    state.callActionInFlight = false;
    if (!urgent) setBusy(false);
    else syncCallButtons();
  }
}

function updateProfileHint() {
  document.querySelector("#profileWriteState").textContent = t("profileWritesLocked");
  document.querySelector("#profileWriteState").hidden = state.profileActionsEnabled;
  document.querySelector("#profileActionsHint").textContent = state.profileActionsEnabled ? t("profileWritesEnabled") : t("profileWritesLocked");
  document.querySelector("#profileDownloadHint").textContent = state.profileDownloadEnabled ? t("profileDownloadEnabled") : t("profileDownloadLocked");
  document.querySelector("#profileNotificationsHint").textContent = state.profileNotificationsEnabled ? t("profileNotificationsEnabled") : t("profileNotificationsLocked");
  document.querySelector("#smsSendHint").textContent = state.smsSendEnabled ? t("smsSendEnabled") : t("smsSendLocked");
  document.querySelector("#stockSetupHint").textContent = state.stockBootstrapEnabled ? t("stockSetupEnabled") : t("stockSetupLocked");
  document.querySelector("#ecmDriverHint").textContent = state.driverInstallEnabled ? t("driverRepairHint") : t("driverRepairLocked");
}

async function fetchJson(path, timeoutMs = 90000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, { headers: apiHeaders(), signal: controller.signal });
    if (!res.ok) throw Object.assign(new Error(res.status === 401 ? t("tokenRequired") : t("readHttpFailed", {status: res.status})), {status: res.status});
    const data = await res.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(t("readUnavailable"));
    return data;
  }
  finally { clearTimeout(timer); }
}

async function requestAction(action, {refreshDetails = false} = {}) {
  const epoch = state.cardEpoch, portName = portInput.value.trim(), selectedAid = state.activeAid, selectedEid = state.activeEid;
  const port = encodeURIComponent(portInput.value.trim());
  const aid = encodeURIComponent(state.activeAid || "");
  const paths = { health: "/api/health", ports: "/api/ports", "device-check": "/api/device-check", "find-at": "/api/find-at", "module-status": `/api/module-status?port=${port}`, "module-temperature": `/api/module-temperature?port=${port}`, baseline: `/api/baseline?port=${port}`, "sms-list": `/api/sms-list?port=${port}`, "call-status": `/api/call-status?port=${port}&brief=1`, "call-capabilities": `/api/call-capabilities?port=${port}`, "euicc-inventory": `/api/euicc-inventory?port=${port}`, "lpac-chip": `/api/lpac-chip?port=${port}&aid=${aid}`, "lpac-discovery": `/api/lpac-discovery?port=${port}&aid=${aid}`, "lpac-profiles": `/api/lpac-profiles?port=${port}&aid=${aid}`, "lpac-notifications": `/api/lpac-notifications?port=${port}&aid=${aid}`, "windows-network": "/api/windows-network", "network-traffic": "/api/network-traffic", "stock-module-probe": "/api/stock-module-probe" };
  const cardScoped = !["health", "ports", "device-check", "windows-network", "network-traffic", "stock-module-probe"].includes(action);
  const stale = () => cardScoped && (epoch !== state.cardEpoch || (action !== "find-at" && portName !== portInput.value.trim()) || (action.startsWith("lpac-") && (selectedAid !== state.activeAid || selectedEid !== state.activeEid)));
  let data;
  try { data = await fetchJson(paths[action] + (action === "network-traffic" && refreshDetails ? "?details=1" : ""), action === "euicc-inventory" ? 600000 : 90000); }
  catch (error) { if (stale()) error.code = "STALE_RESPONSE"; throw error; }
  if (stale()) {
    throw Object.assign(new Error("Discarded a response for a previous card or EID."), {code: "STALE_RESPONSE"});
  }
  if (action === "find-at" && Object.hasOwn(data, "port")) {
    state.atPort = data.port || "";
    portInput.value = state.atPort;
  }
  const noEuicc = action === "euicc-inventory" && data.ok === false && data.discoveryScope === "known-aids" && Array.isArray(data.eids) && !data.eids.length && !data.error && !state.euiccInventory.length;
  if (data.ok !== true && !noEuicc) throw new Error(data.error || data.stderr || t("readUnavailable"));
  if (action === "euicc-inventory" && !Array.isArray(data.eids)) throw new Error(t("readUnavailable"));
  if (["lpac-profiles", "lpac-discovery", "lpac-notifications"].includes(action) && !Array.isArray(parseLpaData(data.stdout || ""))) throw new Error(t("readUnavailable"));
  if (action === "lpac-chip") {
    const chip = parseLpaData(data.stdout || "");
    if (!chip || Array.isArray(chip) || !chip.eidValue) throw new Error(t("readUnavailable"));
  }
  return { data, text: textFromResult(data) || JSON.stringify(data, null, 2) };
}

function applyHealth(data) {
  state.accessMode = data.accessMode || "lan";
  state.pairingAvailable = data.pairingAvailable;
  state.authRequired = Boolean(data.authRequired); state.dangerousAtEnabled = Boolean(data.dangerousAtEnabled); state.profileActionsEnabled = Boolean(data.profileActionsEnabled); state.profileDownloadEnabled = Boolean(data.profileDownloadEnabled); state.profileNicknameEnabled = Boolean(data.profileNicknameEnabled); state.profileNotificationsEnabled = Boolean(data.profileNotificationsEnabled); state.profileDeleteEnabled = Boolean(data.profileDeleteEnabled); state.smsSendEnabled = Boolean(data.smsSendEnabled); state.smsDeleteEnabled = Boolean(data.smsDeleteEnabled); state.callActionsEnabled = Boolean(data.callActionsEnabled); state.ussdEnabled = Boolean(data.ussdEnabled); state.usbModeEnabled = Boolean(data.usbModeEnabled); state.stockBootstrapEnabled = Boolean(data.stockBootstrapEnabled); state.driverInstallEnabled = Boolean(data.driverInstallEnabled); state.voiceRuntimeEnabled = Boolean(data.voiceRuntimeEnabled); state.primaryUrl = data.primaryUrl || "";
  document.querySelector("#tokenRow").style.display = state.authRequired ? "grid" : "none"; updateProfileHint(); applyLanguage();
}

async function callApi(action, {manageBusy = true} = {}) {
  if (manageBusy && (state.busy || state.confirming)) return false;
  if ((state.callStatusData?.callStateUncertain || state.callStatusData?.voiceCalls?.length) && !["health", "network-traffic", "call-status", "call-capabilities"].includes(action)) {
    showFeedback(t("finishCallFirst"), "neutral"); return false;
  }
  const view = action === "euicc-inventory" || action.startsWith("lpac-") ? "euicc" : action === "sms-list" ? "sms" : action === "network-traffic" ? "network" : document.querySelector(".view.active")?.id;
  if (action === "sms-list") {state.smsRefreshing = true; renderSmsRefreshState();}
  if (manageBusy) setBusy(true, action === "health" ? "checking" : "running");
  try {
    if (action === "sms-list" || (action === "euicc-inventory" && !state.atPort)) {
      const found = await requestAction("find-at");
      append(actionTitle("find-at"), found.text);
      updateSummary(found.text);
    }
    const { data, text } = await requestAction(action, {refreshDetails: action === "network-traffic"});
    append(actionTitle(action), text);
    updateSummary(text);
    if (action === "module-status" || action === "module-temperature") updateTemperature(data);
    if (action === "health") applyHealth(data);
    if (action === "euicc-inventory") renderEuiccInventory(data);
    if (action === "lpac-chip") renderChip(text);
    if (action === "lpac-discovery") renderDiscovery(text);
    if (action === "lpac-profiles") renderProfiles(text);
    if (action === "lpac-notifications") renderNotifications(text);
    if (action === "sms-list") {
      if (data.ok === false) throw new Error(data.error || "SMS read failed");
      state.smsLastRead = Date.now(); state.smsReadError = false; renderSms(text, data);
    }
    if (action === "call-status") renderCallStatus(data);
    if (action === "call-capabilities") renderCallCapabilities(data);
    if (action === "network-traffic" && (!data.ok || !renderTraffic(data.stdout || ""))) throw new Error(data.error || "Traffic read failed");
    state.failedViews.delete(view); state.autoLoadedViews.add(view);
    if (manageBusy) showFeedback("", "neutral", view);
    return true;
  }
  catch (error) {
    if (error.code === "STALE_RESPONSE") return false;
    state.failedViews.add(view); state.autoLoadedViews.delete(view);
    if (action === "sms-list") state.smsReadError = true;
    else if (action === "network-traffic") noteTrafficReadFailure();
    else showFeedback(view === "euicc" ? t("readUnavailable") : t("actionFailed", {action:actionTitle(action)}), "error", view);
    append(actionTitle(action), error.name === "AbortError" ? t("timedOut") : error.stack || error.message);
    return false;
  }
  finally {if (action === "sms-list") {state.smsRefreshing = false; renderSmsRefreshState();} if (manageBusy) setBusy(false);}
}

async function rescueScan() {
  if (state.callStatusData?.callStateUncertain || state.callStatusData?.voiceCalls?.length) {showFeedback(t("finishCallFirst"), "neutral"); return;}
  const actions = ["health", "ports", "device-check", "find-at", "windows-network", "stock-module-probe"];
  setBusy(true, "starting");
  append(t("rescueScan"), t("rescueDescription"));
  try {
    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index];
      setBusy(true, "scanProgress", { current: index + 1, total: actions.length });
      try {
        const { data, text } = await requestAction(action);
        append(actionTitle(action), text);
        updateSummary(text);
        if (action === "health") applyHealth(data);
      } catch (error) {
        append(actionTitle(action), error.name === "AbortError" ? t("scanTimedOut") : error.stack || error.message);
      }
    }
  } finally {
    setBusy(false);
  }
}
async function autoScan() {
  if (state.callStatusData?.callStateUncertain || state.callStatusData?.voiceCalls?.length) {showFeedback(t("finishCallFirst"), "neutral"); return;}
  const actions = ["health", "device-check", "find-at", "module-status", "network-traffic", "euicc-inventory", "sms-list"];
  setBusy(true, "starting");
  try {
    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index]; setBusy(true, "scanProgress", { current: index + 1, total: actions.length });
      try {
        const { data, text } = await requestAction(action);
        append(actionTitle(action), text);
        updateSummary(text);
        if (action === "module-status") updateTemperature(data);
        if (action === "health") applyHealth(data);
        if (action === "euicc-inventory") renderEuiccInventory(data);
        if (action === "lpac-chip") renderChip(text);
        if (action === "lpac-discovery") renderDiscovery(text);
        if (action === "lpac-profiles") renderProfiles(text);
        if (action === "lpac-notifications") renderNotifications(text);
        if (action === "sms-list") {state.smsLastRead = Date.now(); state.smsReadError = false; renderSms(text, data); renderSmsRefreshState();}
        if (action === "call-status") renderCallStatus(data);
        if (action === "call-capabilities") renderCallCapabilities(data);
        if (action === "network-traffic") renderTraffic(data.stdout || "");
      }
      catch (error) {
        if (error.code === "STALE_RESPONSE") break;
        if (action === "sms-list") {state.smsReadError = true; renderSmsRefreshState();}
        if (action === "euicc-inventory") showFeedback(t("readUnavailable"), "error", "euicc");
        if (action === "network-traffic") noteTrafficReadFailure();
        append(actionTitle(action), error.name === "AbortError" ? t("scanTimedOut") : error.stack || error.message);
      }
    }
  } finally { setBusy(false); }
}

async function quickStart() {
  if (state.busy || state.connecting) return;
  state.connecting = true;
  setBusy(true, "checking");
  showFeedback(t("cardConnecting"));
  try {
    const health = await requestAction("health");
    applyHealth(health.data);
    state.portsSignature = (await requestAction("ports")).text.trim();
    const found = await requestAction("find-at");
    updateSummary(found.text);
    if (!state.atPort) {
      clearCardView();
      showFeedback(t("cardNotConnected"));
      return;
    }
    for (const action of ["module-status", "network-traffic", "euicc-inventory"]) {
      const { data, text } = await requestAction(action);
      append(actionTitle(action), text);
      updateSummary(text);
      if (action === "module-status") updateTemperature(data);
      if (action === "network-traffic") renderTraffic(data.stdout || "");
      if (action === "euicc-inventory") {
        renderEuiccInventory(data);
        if (data.ok) state.autoLoadedViews.add("euicc");
        showFeedback(data.ok ? t("inventoryReadStatus", {
          loaded: data.eids.filter((item) => Array.isArray(item.profiles)).length, count: data.eids.length,
        }) : t("cardReadyNoEuicc"), data.ok ? "success" : "neutral");
      }
    }
    const card = await fetchJson("/api/card-status?port=" + encodeURIComponent(state.atPort), 20000);
    if (card.ok) { state.cardSignature = card.signature; state.cardReady = card.ready; }
  } catch (error) {
    showFeedback(t("actionFailed", { action: t("autoScan") }), "error");
    append(t("autoScan"), error.message);
  } finally {
    state.connecting = false;
    setBusy(false);
    if (state.atPort && document.querySelector(".view.active")?.id === "calls") refreshVoiceSetup();
  }
}

async function monitorCard() {
  if (!state.started || state.busy || state.cardMonitorBusy || document.hidden || state.callStatusData?.callStateUncertain || state.callStatusData?.voiceCalls?.length) return;
  state.cardMonitorBusy = true;
  try {
    const ports = (await requestAction("ports")).text.trim();
    if (ports !== state.portsSignature) {
      state.portsSignature = ports;
      clearCardView();
      showFeedback(t("cardChanged"));
      await quickStart();
      return;
    }
    if (!state.atPort) return;
    const card = await fetchJson("/api/card-status?port=" + encodeURIComponent(state.atPort), 20000);
    if (!card.ok) return;
    if (!card.ready) {
      if (state.cardReady !== false) { clearCardView(); showFeedback(t("cardRemoved")); }
      state.cardReady = false;
    } else if (state.cardReady === false || (card.signature && state.cardSignature && card.signature !== state.cardSignature)) {
      clearCardView();
      showFeedback(t("cardChanged"));
      await quickStart();
    } else {
      state.cardReady = true;
      if (card.signature) state.cardSignature = card.signature;
    }
  } catch { /* Transient driver errors are retried on the next read-only poll. */ }
  finally { state.cardMonitorBusy = false; }
}

async function sendAt() {
  if (state.busy || state.confirming) return;
  const port = encodeURIComponent(portInput.value.trim()); const command = document.querySelector("#atInput").value.trim(); if (!command) return;
  document.querySelector("#logPanel").open = true;
  state.atFeedback = {key: "atSending", command}; renderAtFeedback();
  setBusy(true, "at");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const res = await fetch(`/api/at?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ command }), signal: controller.signal });
    const data = await res.json(); const text = textFromResult(data) || JSON.stringify(data, null, 2);
    append(command, text);
    const failed = !res.ok || data.ok === false || /(?:^|\n)\s*(?:ERROR|\+(?:CME|CMS) ERROR(?::[^\r\n]*)?)\s*(?:\r?\n|$)/i.test(text);
    const completed = /(?:^|\r?\n)\s*OK\s*(?:\r?\n|$)/i.test(data.stdout || "");
    state.atFeedback = {key: failed ? "atFailed" : !completed ? "atIncomplete" : "atSucceeded", command, tone: failed || !completed ? "error" : "success"};
    if (!failed && completed) updateSummary(text);
  }
  catch (error) {
    const timedOut = error.name === "AbortError";
    append(command, timedOut ? t("atTimedOut") : error.message);
    state.atFeedback = {key: timedOut ? "atTimedOut" : "atFailed", command, tone: "error"};
  }
  finally { clearTimeout(timer); renderAtFeedback(); setBusy(false); }
}

function profileWriteTarget() {
  if (state.busy || state.callActionInFlight || state.confirming) return null;
  if (state.callStatusData?.callStateUncertain || state.callStatusData?.voiceCalls?.length) {showFeedback(t("finishCallFirst"), "error"); return null;}
  if (!state.activeAid || !/^89[0-9]{30}$/.test(state.activeEid)) {showFeedback(t("selectEidFirst"), "error"); return null;}
  return {aid: state.activeAid, expectedEid: state.activeEid, epoch: state.cardEpoch};
}

function profileWriteError(error) {
  const key = error.name === "AbortError" || error.code === "WRITE_OUTCOME_UNKNOWN" ? "writeUnknown" : ({EID_CHANGED: "eidChangedWrite", EID_CHANGED_AFTER_WRITE: "writeTargetChanged", EID_REQUIRED: "eidVerifyFailed", EID_UNAVAILABLE: "eidVerifyFailed", CALL_ACTIVE: "finishCallFirst", CALL_STATUS_UNAVAILABLE: "callVerifyFailed"})[error.code] || "writeFailed";
  showFeedback(t(key), "error", "euicc");
  append(t("esim"), error.message || t(key));
}

async function postProfileWrite(endpoint, body, target) {
  if (!currentProfileTarget(target)) throw Object.assign(new Error(t("eidChangedWrite")), {code: "EID_CHANGED"});
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600000);
  try {
    const response = await fetch(endpoint + "?port=" + encodeURIComponent(portInput.value.trim()), {method: "POST", headers: apiHeaders({"content-type":"application/json"}), body: JSON.stringify({...body, aid: target.aid, expectedEid: target.expectedEid}), signal: controller.signal});
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw Object.assign(new Error(data.error || data.stderr || t("writeFailed")), {code: data.code});
    if (!currentProfileTarget(target)) throw Object.assign(new Error(t("writeTargetChanged")), {code: "EID_CHANGED_AFTER_WRITE"});
    return data;
  } catch (error) {
    if (["TypeError", "SyntaxError"].includes(error.name)) error.code = "WRITE_OUTCOME_UNKNOWN";
    throw error;
  } finally {clearTimeout(timer);}
}

function currentProfileTarget(target) {
  return target.epoch === state.cardEpoch && target.expectedEid === state.activeEid && target.aid === state.activeAid;
}

async function refreshProfileAfterWrite(target, actions) {
  for (const action of actions) {
    if (!currentProfileTarget(target) || !await callApi(action, {manageBusy: false})) {
      showFeedback(t(currentProfileTarget(target) ? "writeRefreshFailed" : "writeTargetChanged"), "neutral", "euicc");
      return false;
    }
  }
  return true;
}

async function runProfileAction(action, id) {
  const label = action === "enable" ? t("switchProfile") : t("disable"), item = activeEuicc();
  if (state.busy || !state.profileActionsEnabled || !item || !state.activeAid) return;
  const target = profileWriteTarget(); if (!target) return;
  const aid = state.activeAid, epoch = state.cardEpoch;
  const profile = item.profiles?.find(p => (p.iccid || p.isdpAid) === id);
  if (!profile) return;
  if (!await confirmOperation({title:label, description:t("confirmProfile", {action:label}), details:[[t("confirmTarget"), euiccDisplayLabel(item, state.euiccInventory.indexOf(item)) + " · " + shortEid(item.eid)], [t("profileNameLabel"), profile.profileNickname || profile.profileName || profile.serviceProviderName || id]], confirmLabel:label})) return;
  if (epoch !== state.cardEpoch || aid !== state.activeAid) {showFeedback(t("cardChangedRetry"), "error"); return;}
  setBusy(true, action);
  try {
    const found = await requestAction("find-at"); updateSummary(found.text);
    if (!state.atPort || epoch !== state.cardEpoch) throw new Error("Card unavailable");
    const data = await postProfileWrite('/api/lpac-profile-action', {action, id, confirm:action.toUpperCase()}, target);
    append(label, textFromResult(data) || JSON.stringify(data));
    if (!await refreshProfileAfterWrite(target, ["lpac-profiles"])) return;
    const verification = data.verification;
    const feedback = action !== "enable" || !verification || verification.status === "not-applicable"
      ? { message: t("profileActionDone", {action:label}), tone: "success" }
      : verification.status === "verified"
        ? { message: t("profileSwitchVerified"), tone: "success" }
        : verification.status === "network-pending"
          ? { message: t("profileSwitchNetworkPending"), tone: "neutral" }
          : { message: t("profileSwitchPending"), tone: "neutral" };
    showFeedback(feedback.message, feedback.tone, "euicc");
  } catch (error) {profileWriteError(error);}
  finally {setBusy(false);}
}

async function deleteProfile(id) {
  if (!state.activeAid) { append(t("deleteProfile"), t("selectEidFirst")); return; }
  if (!state.profileDeleteEnabled) { append(t("deleteProfile"), t("locked")); return; }
  const target = profileWriteTarget(); if (!target) return;
  if (!window.confirm(t("deleteIrreversible"))) return;
  if (window.prompt(t("confirmDeleteProfile")) !== "DELETE") return;
  setBusy(true, "deleteProfile");
  try {
    const data = await postProfileWrite('/api/lpac-profile-action', {action: "delete", id, confirm: "DELETE"}, target);
    append(t("deleteProfile"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (await refreshProfileAfterWrite(target, ["lpac-profiles", "lpac-notifications"])) showFeedback(t("writeDone"), "success", "euicc");
  } catch (error) { profileWriteError(error); }
  finally { setBusy(false); }
}
async function downloadProfile() {
  const activationCode = document.querySelector("#activationCodeInput").value.trim();
  if (!state.activeAid) { append(t("profileDownload"), t("selectEidFirst")); return; }
  if (!state.profileDownloadEnabled) { append(t("profileDownload"), t("profileDownloadLocked")); return; }
  if (!activationCode.startsWith("LPA:1$") || activationCode.split("$").length < 3) { append(t("profileDownload"), t("invalidActivationCode")); return; }
  const target = profileWriteTarget(); if (!target) return;
  const item = activeEuicc();
  const targetLabel = item ? euiccDisplayLabel(item, state.euiccInventory.indexOf(item)) : shortEid(state.activeEid);
  if (!window.confirm(`${t("confirmDownload")}\n${t("targetEid", { label: targetLabel })}`)) return;
  setBusy(true, "profileDownload");
  try {
    const data = await postProfileWrite('/api/lpac-profile-download', {activationCode, confirm: "DOWNLOAD"}, target);
    append(t("profileDownload"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (document.querySelector("#activationCodeInput").value.trim() === activationCode) document.querySelector("#activationCodeInput").value = "";
    if (await refreshProfileAfterWrite(target, ["lpac-profiles"])) showFeedback(t("writeDone"), "success", "euicc");
  } catch (error) { profileWriteError(error); }
  finally { setBusy(false); }
}

async function addEuiccAid() {
  const input = document.querySelector("#customAidInput");
  const aid = input.value.trim().toUpperCase();
  if (!/^[0-9A-F]{2,32}$/.test(aid) || aid.length % 2 !== 0) { append(t("privateAid"), t("invalidAid")); return; }
  if (!window.confirm(t("confirmAddAid"))) return;
  setBusy(true, "running");
  try {
    const port = encodeURIComponent(portInput.value.trim());
    const res = await fetch(`/api/euicc-aid?port=${port}`, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ aid, confirm: "ADD" }),
    });
    const data = await res.json();
    if (!res.ok || data.ok !== true) throw new Error(data.error || "The private AID could not be verified.");
    input.value = "";
    append(t("privateAid"), t("aidAdded"));
    await callApi("euicc-inventory", {manageBusy: false});
  } catch (error) { append(t("privateAid"), error.stack || error.message); }
  finally { setBusy(false); }
}

async function runStockSetup(endpoint, confirmation, title) {
  if (!state.stockBootstrapEnabled) { append(title, t("stockSetupLocked")); return; }
  if (window.prompt(confirmation) !== (endpoint.endsWith("convert") ? "CONVERT" : "USBNET")) return;
  setBusy(true, "running");
  try {
    const port = encodeURIComponent(portInput.value.trim());
    const res = await fetch(`${endpoint}?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ confirm: endpoint.endsWith("convert") ? "CONVERT" : "USBNET" }) });
    const data = await res.json();
    append(title, textFromResult(data) || JSON.stringify(data, null, 2));
  } catch (error) { append(title, error.stack || error.message); }
  finally { setBusy(false); }
}

async function renameProfile(id) {
  const input = document.querySelector(`[data-profile-nickname-input="${CSS.escape(id)}"]`);
  const nickname = input?.value.trim() || "";
  if (!state.activeAid) { append(t("profileNickname"), t("selectEidFirst")); return; }
  if (!state.profileNicknameEnabled) { append(t("profileNickname"), t("nicknameLocked")); return; }
  if (!nickname || nickname.length > 64) { append(t("profileNickname"), t("invalidNickname")); return; }
  const target = profileWriteTarget(); if (!target) return;
  if (!window.confirm(t("confirmNickname"))) return;
  setBusy(true, "profileNickname");
  try {
    const data = await postProfileWrite('/api/lpac-profile-nickname', {id, nickname, confirm: "RENAME"}, target);
    append(t("profileNickname"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (await refreshProfileAfterWrite(target, ["lpac-profiles"])) showFeedback(t("writeDone"), "success", "euicc");
  } catch (error) { profileWriteError(error); }
  finally { setBusy(false); }
}

async function processNotifications() {
  if (!state.activeAid) { append(t("profileNotifications"), t("selectEidFirst")); return; }
  if (!state.profileNotificationsEnabled) { append(t("profileNotifications"), t("profileNotificationsLocked")); return; }
  const target = profileWriteTarget(); if (!target) return;
  if (!window.confirm(t("confirmNotifications"))) return;
  setBusy(true, "profileNotifications");
  try {
    const data = await postProfileWrite('/api/lpac-notifications-process', {confirm: "PROCESS"}, target);
    append(t("profileNotifications"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (await refreshProfileAfterWrite(target, ["lpac-notifications"])) showFeedback(t("writeDone"), "success", "euicc");
  } catch (error) { profileWriteError(error); }
  finally { setBusy(false); }
}

async function sendUssdRequest() {
  const code = document.querySelector("#ussdInput").value.trim();
  if (!state.ussdEnabled) { append(t("ussd"), t("ussdLocked")); return; }
  if (!/^[0-9*#]{1,32}$/.test(code)) { append(t("ussd"), t("invalidUssd")); return; }
  if (!window.confirm(t("confirmUssd"))) return;
  setBusy(true, "ussd");
  try {
    const found = await requestAction("find-at");
    updateSummary(found.text);
    const port = encodeURIComponent(portInput.value.trim());
    const res = await fetch(`/api/ussd?port=${port}`, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ code, confirm: "USSD" }),
    });
    const data = await res.json();
    const text = textFromResult(data) || JSON.stringify(data, null, 2);
    const match = text.match(/\+CUSD:\s*\d+\s*,\s*"([^"]+)"/i);
    const decoded = match ? decodeSmsBody(match[1]) : "";
    append(t("ussd"), decoded && decoded !== match[1] ? `${text}\n\n${decoded}` : text);
  } catch (error) { append(t("ussd"), error.stack || error.message); }
  finally { setBusy(false); }
}

async function switchUsbMode(mode) {
  if (!state.usbModeEnabled) { append(t("usbMode"), t("usbModeLocked")); return; }
  const confirmWord = `USBNET${mode}`;
  if (window.prompt(t("confirmUsbMode", { mode, confirm: confirmWord })) !== confirmWord) return;
  setBusy(true, "usbMode");
  try {
    const found = await requestAction("find-at");
    append(actionTitle("find-at"), found.text);
    updateSummary(found.text);
    const port = encodeURIComponent(portInput.value.trim());
    const res = await fetch(`/api/usbnet-mode?port=${port}`, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ mode, confirm: confirmWord }),
    });
    const data = await res.json();
    append(t("usbMode"), textFromResult(data) || JSON.stringify(data, null, 2));
  } catch (error) { append(t("usbMode"), error.stack || error.message); }
  finally { setBusy(false); }
}

async function installEcmDriver() {
  const button = document.querySelector("#installEcmDriverBtn");
  if (!state.driverInstallEnabled) { append(t("ecmDriver"), t("driverRepairLocked")); return; }
  if (button.dataset.driverReady === "1") return;
  if (window.prompt(t("confirmDriverRepair")) !== "ECMDRIVER") return;

  setBusy(true, "ecmDriver");
  try {
    const res = await fetch("/api/ecm-driver-install", {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ confirm: "ECMDRIVER" }),
    });
    const data = await res.json();
    const detailText = data.detail ? JSON.stringify(data.detail, null, 2) : textFromResult(data) || JSON.stringify(data, null, 2);
    append(t("ecmDriver"), detailText);
    if (!res.ok || !data.detail?.ok) throw new Error(data.detail?.error || data.error || t("driverRepairFailed"));
    append(t("ecmDriver"), t("driverRepairSuccess"));
  } catch (error) {
    append(t("ecmDriver"), `${t("driverRepairFailed")}\n${error.message}`);
  } finally {
    setBusy(false);
  }
  await callApi("network-traffic");
}
async function refreshTrafficQuietly() {
  if (!state.started || state.busy || state.confirming || state.trafficRefreshInFlight || document.hidden || Date.now() < state.trafficRetryAfter || !document.querySelector('.nav-btn[data-target="network"]')?.classList.contains("active")) return;
  state.trafficRefreshInFlight = true;
  renderTrafficSyncState();
  try {
    const { data } = await requestAction("network-traffic");
    if (!data.ok || !renderTraffic(data.stdout || "")) throw new Error(data.error || "Traffic read failed");
  } catch { noteTrafficReadFailure(); }
  finally { state.trafficRefreshInFlight = false; }
  renderTrafficSyncState();
}
async function refreshModuleStatusQuietly() {
  if (state.busy || state.overviewRefreshInFlight || state.callActionInFlight || !state.atPort || document.hidden || !document.querySelector('.nav-btn[data-target="overview"]')?.classList.contains("active") || state.callStatusData?.callStateUncertain || state.callStatusData?.voiceCalls?.length) return;
  const epoch = state.cardEpoch, port = state.atPort;
  state.overviewRefreshInFlight = true;
  try {
    const data = await fetchJson(`/api/module-status?port=${encodeURIComponent(port)}&brief=1`, 45000);
    if (epoch !== state.cardEpoch || port !== state.atPort) return;
    if (!data.ok || !/\+CEREG:/.test(data.stdout || "")) throw new Error("Network status unavailable");
    state.moduleReadError = false;
    updateSummary(data.stdout || "");
    updateTemperature(data);
  } catch {
    if (epoch === state.cardEpoch && port === state.atPort) { state.moduleReadError = true; renderSummary(); }
  } finally { state.overviewRefreshInFlight = false; }
}
async function openPairingDialog() {
  if (pairingDialog.dataset.state === "loading") return;
  pairingDialog.dataset.state = "loading";
  const badge = pairingDialog.querySelector(".pairing-status span[data-i18n]");
  badge.dataset.i18n = "pairingLoading";
  badge.textContent = t("pairingLoading");
  pairingDeepLink = "";
  pairingQr.hidden = true;
  pairingQr.removeAttribute("src");
  pairingQrPlaceholder.hidden = false;
  pairingQrPlaceholder.textContent = t("pairingLoading");
  pairingUrl.textContent = "--";
  pairingStatus.textContent = t("pairingLoading");
  copyPairingBtn.disabled = true;
  retryPairingBtn.disabled = true;
  if (!pairingDialog.open) pairingDialog.showModal();
  pairIosBtn.disabled = true;
  const controller = new AbortController();
  pairingRequest = controller;
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("/api/pairing", { headers: apiHeaders(), signal: controller.signal });
    const data = await response.json();
    if (pairingRequest !== controller || !pairingDialog.open) return;
    if (!response.ok || !data.ok) throw new Error(data.code === "LOCAL_ONLY" ? t("pairingLocalOnly") : data.code === "NO_LAN_ADDRESS" ? t("pairingNoLan") : data.error || "Pairing request failed.");
    pairingDeepLink = data.deepLink;
    pairingQr.src = data.qrDataUrl;
    pairingQr.hidden = false;
    pairingQrPlaceholder.hidden = true;
    pairingUrl.textContent = data.url;
    pairingStatus.textContent = t("pairingReady");
    copyPairingBtn.disabled = false;
    pairingDialog.dataset.state = "ready";
    badge.dataset.i18n = "sameNetwork";
    badge.textContent = t("sameNetwork");
  } catch (error) {
    if (pairingRequest !== controller || !pairingDialog.open) return;
    pairingDialog.dataset.state = "error";
    badge.dataset.i18n = "pairingUnavailable";
    badge.textContent = t("pairingUnavailable");
    pairingQrPlaceholder.textContent = t("pairingUnavailable");
    pairingStatus.textContent = t("pairingFailed", { error: error.name === "AbortError" ? t("timedOut") : error.message });
    append(t("pairIos"), error.message);
  } finally {
    clearTimeout(timer);
    if (pairingRequest === controller) {
      pairingRequest = null;
      retryPairingBtn.disabled = false;
      pairIosBtn.disabled = state.busy;
    }
  }
}

async function copyPairingLink() {
  if (!pairingDeepLink) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(pairingDeepLink);
    } else {
      const field = document.createElement("textarea");
      field.value = pairingDeepLink;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    pairingStatus.textContent = t("pairingCopied");
  } catch (error) {
    pairingStatus.textContent = t("pairingFailed", { error: error.message });
  }
}

function toggleSmsPolling() {
  state.smsPolling = !state.smsPolling; renderSmsRefreshState();
  if (state.smsPolling) refreshSmsQuietly();
}
setInterval(() => {if (state.smsPolling && document.querySelector("#sms").classList.contains("active")) refreshSmsQuietly();}, 20000);
setInterval(refreshTrafficQuietly, 2000);
setInterval(refreshCallStatusQuietly, 1000);
setInterval(refreshModuleStatusQuietly, 30000);

const launchToken = launchParameters.get("token") || "";
tokenInput.value = launchToken || (nativeCompanion ? "" : localStorage.getItem("consoleToken") || "");
if (nativeCompanion) localStorage.removeItem("consoleToken");
if (launchToken && !nativeCompanion) localStorage.setItem("consoleToken", launchToken);
tokenInput.addEventListener("change", () => {
  if (!nativeCompanion) localStorage.setItem("consoleToken", tokenInput.value.trim());
});
languageBtn.addEventListener("click", () => { state.language = state.language === "zh" ? "en" : "zh"; localStorage.setItem("uiLanguage", state.language); applyLanguage(); });
if (nativeCompanion) {
  const details = document.querySelector("#nativeDeviceDetails");
  details.hidden = false;
  // Reuse the live metric nodes so polling and language updates keep one source of truth.
  for (const id of ["vidPid", "atPort", "netState", "temperatureValue"]) {
    document.querySelector("#nativeDeviceMetrics").append(document.getElementById(id).closest(".metric"));
  }
  document.querySelector("#nativeSmsBackBtn").hidden = false;
  document.querySelector("#nativeSmsBackBtn").addEventListener("click", returnToSmsThreads);
  document.querySelector("#sms .sms-workspace").before(document.querySelector("#smsStorageWarning"));
  const networkDetails = document.querySelector("#nativeNetworkDetails");
  networkDetails.hidden = false;
  const adapter = document.querySelector("#nativeNetworkAdapter");
  adapter.hidden = false;
  adapter.append(document.querySelector("#trafficAdapter").closest(".network-metric"));
  for (const id of ["trafficIpv4", "trafficGateway", "trafficDriver", "trafficDhcp"]) {
    document.querySelector("#nativeNetworkMetrics").append(document.getElementById(id).closest(".network-metric"));
  }
  networkDetails.append(document.querySelector("#network .driver-panel"));
  const callWorkspace = document.querySelector(".call-workspace");
  const callSections = [".call-stage", ".dialer-panel", ".call-history-panel", ".voice-setup-panel", ".call-capability-panel"].map(selector => document.querySelector(selector));
  callWorkspace.replaceChildren(...callSections);
  document.querySelector("#nativeCallAudioNote").hidden = false;
  const more = document.querySelector("#nativeMoreBtn");
  const dialog = document.querySelector("#nativeToolsDialog");
  more.hidden = false;
  more.addEventListener("click", () => { dialog.showModal(); more.setAttribute("aria-expanded", "true"); });
  dialog.addEventListener("close", () => more.setAttribute("aria-expanded", "false"));
  dialog.addEventListener("click", event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  document.querySelector("#nativeLanguageBtn").addEventListener("click", () => languageBtn.click());
  const railLanguage = document.querySelector("#nativeRailLanguageBtn");
  railLanguage.hidden = false;
  railLanguage.addEventListener("click", () => languageBtn.click());
}
for (const button of document.querySelectorAll("button[data-action]")) button.addEventListener("click", () => callApi(button.dataset.action));
function selectView(target, updateHash = false) {
  const button = document.querySelector(`.nav-btn[data-target="${target}"]`);
  const view = document.querySelector(`#${target}`);
  if (!button || !view) return;
  const previous = document.querySelector(".view.active")?.id;
  if (previous !== target) {
    const logPanel = document.querySelector("#logPanel");
    if (previous) state.logOpenViews.set(previous, logPanel.open);
    logPanel.open = target === "atlab" || state.logOpenViews.get(target) === true;
  }
  if (!nativeCompanion && previous && previous !== target) state.viewScrollPositions.set(previous, window.scrollY);
  document.querySelectorAll(".nav-btn").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  view.classList.add("active");
  showFeedback("");
  document.querySelectorAll(".nav-btn").forEach(item => item.setAttribute("aria-current", item === button ? "page" : "false"));
  if (nativeCompanion) {
    if (target !== "sms") setNativeSmsPane(false);
    const more = document.querySelector("#nativeMoreBtn");
    const secondaryView = ["network", "atlab", "system"].includes(target);
    more.classList.toggle("active", secondaryView);
    more.setAttribute("aria-current", secondaryView ? "page" : "false");
    const dialog = document.querySelector("#nativeToolsDialog");
    if (dialog.open) dialog.close();
  }
  if (updateHash) history.replaceState(null, "", `#${target}`);
  if (updateHash || previous !== target) {
    if (nativeCompanion) resetViewScroll();
    else restoreViewScroll(target);
  }
  if (target === "calls" && !state.callMonitoring) toggleCallMonitoring(true);
  if (target === "calls" && !state.callCapabilityData) refreshVoiceSetup();
  state.failedViews.delete(target);
  ensureCurrentViewLoaded();
}

function resetViewScroll() {
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

function restoreViewScroll(target) {
  requestAnimationFrame(() => {
    if (document.querySelector(".view.active")?.id === target) window.scrollTo(0, state.viewScrollPositions.get(target) || 0);
  });
}

for (const button of document.querySelectorAll(".nav-btn")) button.addEventListener("click", () => selectView(button.dataset.target, true));
for (const button of document.querySelectorAll("[data-open-view]")) button.addEventListener("click", () => selectView(button.dataset.openView, true));
window.addEventListener("hashchange", () => selectView(location.hash.slice(1)));
window.addEventListener("beforeunload", () => { stopAudioBridge("audioNotConnected", false); stopModuleVoiceRoute(true); });
selectView(location.hash.slice(1) || "overview");
if (location.hash) window.addEventListener("load", () => nativeCompanion ? resetViewScroll() : restoreViewScroll(location.hash.slice(1)), { once: true });
for (const button of document.querySelectorAll(".preset")) button.addEventListener("click", () => { document.querySelector("#atInput").value = button.dataset.command; sendAt(); });
document.querySelector("#autoScanBtn").addEventListener("click", autoScan);
pairIosBtn.addEventListener("click", openPairingDialog);
copyPairingBtn.addEventListener("click", copyPairingLink);
pairingDialog.addEventListener("close", () => {
  pairingRequest?.abort();
  pairingRequest = null;
  pairingDialog.dataset.state = "idle";
  copyPairingBtn.disabled = true;
  retryPairingBtn.disabled = false;
  pairIosBtn.disabled = state.busy;
  pairingQr.hidden = true;
  pairingDeepLink = "";
  pairingQr.removeAttribute("src");
  pairingUrl.textContent = "--";
});
retryPairingBtn.addEventListener("click", openPairingDialog);
document.querySelector("#rescueScanBtn").addEventListener("click", rescueScan);
document.querySelector("#sendAtBtn").addEventListener("click", sendAt);
document.querySelector("#downloadProfileBtn").addEventListener("click", downloadProfile);
document.querySelector("#addEuiccAidBtn").addEventListener("click", addEuiccAid);
document.querySelector("#processNotificationsBtn").addEventListener("click", processNotifications);
document.querySelector("#renameSelectedEidBtn").addEventListener("click", () => {if (state.activeEid && !state.busy) renameEuicc(state.activeEid);});
document.querySelector("#callNextBtn").addEventListener("click", () => {
  const next = document.querySelector("#callNextBtn").dataset.next;
  if (next === "scan") document.querySelector("#autoScanBtn").click();
  else if (next === "retry") refreshCallStatusQuietly(true);
  else document.querySelector("#callNumberInput").focus();
});
document.querySelector("#sendSmsBtn").addEventListener("click", sendSmsMessage);
document.querySelector("#newSmsBtn").addEventListener("click", () => selectSmsConversation(null));
document.querySelector("#smsSearchInput").addEventListener("input", event => { state.smsQuery = event.target.value; renderSms(state.smsText); scrollToSmsSearchMatch(); });
document.querySelector("#clearSmsSearchBtn").addEventListener("click", () => {
  state.smsQuery = "";
  const input = document.querySelector("#smsSearchInput"); input.value = "";
  renderSms(state.smsText); input.focus({preventScroll: true});
});
document.querySelector("#smsSearchInput").addEventListener("keydown", event => {
  if (event.key === "Escape" && state.smsQuery) {event.preventDefault(); document.querySelector("#clearSmsSearchBtn").click();}
});
document.querySelector("#smsNumberInput").addEventListener("input", () => {
  if (!state.smsNewDraft && state.smsActiveSender) state.smsDrafts.set(state.smsActiveSender, {number:state.smsActiveSender, message:document.querySelector("#smsMessageInput").value});
  state.smsNewDraft = true; state.smsActiveSender = null; saveSmsDraft(); renderSms(state.smsText);
});
document.querySelector("#smsMessageInput").addEventListener("input", saveSmsDraft);
document.querySelector("#smsMessageInput").addEventListener("keydown", event => {if (event.ctrlKey && event.key === "Enter" && !event.isComposing) {event.preventDefault(); if (!document.querySelector("#sendSmsBtn").disabled) sendSmsMessage();}});
document.querySelector("#smsRetryBtn").addEventListener("click", refreshSmsQuietly);
document.querySelector("#dismissFeedbackBtn").addEventListener("click", () => showFeedback(""));
document.querySelector("#callNumberInput").addEventListener("input", syncCallButtons);
document.querySelector("#callNumberInput").addEventListener("keydown", event => {if (event.key === "Enter" && !event.isComposing && !document.querySelector("#dialCallBtn").disabled) runCallAction("dial");});
document.querySelector("#callMonitorBtn")?.addEventListener("click", () => toggleCallMonitoring());
document.querySelector("#dialCallBtn").addEventListener("click", () => runCallAction("dial"));
document.querySelector("#answerCallBtn").addEventListener("click", () => runCallAction("answer"));
document.querySelector("#hangupCallBtn").addEventListener("click", () => runCallAction("hangup"));
document.querySelector("#sendDtmfBtn").addEventListener("click", () => runCallAction("dtmf"));
document.querySelector("#enableCallerIdBtn")?.addEventListener("click", () => runCallAction("caller-id"));
document.querySelector("#startAudioBridgeBtn").addEventListener("click", startAudioBridge);
document.querySelector("#stopAudioBridgeBtn").addEventListener("click", () => stopAudioBridge());
document.querySelector("#refreshAudioDevicesBtn").addEventListener("click", refreshAudioDevicesFromButton);
document.querySelector("#automaticCallAudioInput").addEventListener("change", event => setAutomaticCallAudio(event.target.checked));
document.querySelector("#callMicrophoneSelect").addEventListener("change", (event) => localStorage.setItem("callMicrophoneId", event.target.value));
document.querySelector("#callSpeakerSelect").addEventListener("change", (event) => localStorage.setItem("callSpeakerId", event.target.value));
navigator.mediaDevices?.addEventListener?.("devicechange", () => refreshAudioDeviceOptions(false).catch(() => {}));
document.querySelector("#refreshVoiceSetupBtn").addEventListener("click", refreshVoiceSetup);
document.querySelector("#downloadVoiceRuntimeBtn").addEventListener("click", () => runVoiceSetupAction("/api/voice-runtime-download", "DOWNLOADVOICE", "confirmVoiceDownload"));
document.querySelector("#enableImsBtn").addEventListener("click", () => runVoiceSetupAction("/api/call-ims-enable", "ENABLEIMS", "confirmEnableIms"));
document.querySelector("#restoreImsBtn").addEventListener("click", () => runVoiceSetupAction("/api/call-ims-restore", "RESTOREIMS", "confirmRestoreIms"));
document.querySelector("#enableVoiceUsbBtn").addEventListener("click", () => runVoiceSetupAction("/api/voice-usb-enable", "VOICEUSB", "confirmVoiceUsb"));
document.querySelector("#prepareVoiceRuntimeBtn").addEventListener("click", () => runVoiceSetupAction("/api/voice-runtime-prepare", "PREPAREVOICE", "confirmVoicePrepare"));
document.querySelector("#restoreVoiceUsbBtn").addEventListener("click", () => runVoiceSetupAction("/api/voice-usb-restore", "RESTOREVOICE", "confirmVoiceRestore"));
for (const button of document.querySelectorAll("[data-dial-key]")) button.addEventListener("click", () => {
  const activeCall = state.callStatusData?.voiceCalls?.[0];
  const target = activeCall ? document.querySelector("#dtmfInput") : document.querySelector("#callNumberInput");
  target.value += button.dataset.dialKey; syncCallButtons();
});
document.querySelector("#dialBackspaceBtn").addEventListener("click", () => {
  const activeCall = state.callStatusData?.voiceCalls?.[0];
  const target = activeCall ? document.querySelector("#dtmfInput") : document.querySelector("#callNumberInput");
  target.value = target.value.slice(0, -1); syncCallButtons();
});
document.querySelector("#sendUssdBtn").addEventListener("click", sendUssdRequest);
document.querySelector("#installEcmDriverBtn").addEventListener("click", installEcmDriver);
for (const button of document.querySelectorAll("button[data-usb-mode]")) button.addEventListener("click", () => switchUsbMode(Number(button.dataset.usbMode)));
document.querySelector("#smsPollingBtn").addEventListener("click", toggleSmsPolling);
document.querySelector("#smsList").addEventListener("scroll", renderSmsNewMessages, {passive: true});
document.querySelector("#smsNewMessagesBtn").addEventListener("click", () => {
  const list = document.querySelector("#smsList"); list.scrollTop = list.scrollHeight;
  renderSmsNewMessages();
});
function updateProfileFilter() {
  state.profileFilters.set(state.activeEid, {query: document.querySelector("#profileSearchInput").value, status: document.querySelector("#profileStatusFilter").value});
  renderProfileItems(activeEuicc()?.profiles);
}
document.querySelector("#profileSearchInput").addEventListener("input", updateProfileFilter);
document.querySelector("#profileStatusFilter").addEventListener("change", updateProfileFilter);
document.querySelector("#clearProfileSearchBtn").addEventListener("click", () => {
  document.querySelector("#profileSearchInput").value = ""; updateProfileFilter();
  document.querySelector("#profileSearchInput").focus();
});
document.querySelector("#stockConvertBtn").addEventListener("click", () => runStockSetup("/api/stock-module-convert", t("confirmStockConvert"), t("stockConvert")));
document.querySelector("#stockUsbnetBtn").addEventListener("click", () => runStockSetup("/api/stock-module-usbnet", t("confirmStockUsbnet"), t("stockUsbnet")));
document.querySelector("#atInput").addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.isComposing && !event.repeat) { event.preventDefault(); sendAt(); } });
document.querySelector("#clearBtn").addEventListener("click", clearLog);
document.querySelector("#copyLogBtn").addEventListener("click", copyLog);
document.querySelector("#logLatestBtn").addEventListener("click", followLatestLog);
document.querySelector("#logFollowInput").addEventListener("change", event => {
  if (event.target.checked) followLatestLog();
  else {state.logFollow = false; renderLogControls();}
});
output.addEventListener("scroll", () => {
  if (!output.clientHeight) return;
  if (state.logFollow && output.scrollHeight - output.scrollTop - output.clientHeight > 24) {
    state.logFollow = false; renderLogControls();
  } else if (output.scrollHeight - output.scrollTop - output.clientHeight <= 24 && state.logPending) {
    state.logPending = 0; renderLogControls();
  }
});
document.querySelector("#logPanel").addEventListener("toggle", event => {
  if (event.target.open && state.logFollow) followLatestLog();
});

applyLanguage();
quickStart().finally(() => {
  state.started = true;
  selectView(location.hash.slice(1) || "overview");
});
setInterval(monitorCard, 10000);
