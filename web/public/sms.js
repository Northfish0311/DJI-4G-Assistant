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


