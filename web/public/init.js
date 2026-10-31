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
for (const button of document.querySelectorAll("button[data-action]")) button.addEventListener("click", () => callApi(button.dataset.action, {refreshDetails: true}));
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
