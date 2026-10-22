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

