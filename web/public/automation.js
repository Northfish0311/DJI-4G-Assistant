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
    // Network details and eSIM discovery are loaded on demand by their views.
    const { data, text } = await requestAction("module-status");
    append(actionTitle("module-status"), text);
    updateSummary(text);
    updateTemperature(data);
    const card = await fetchJson("/api/card-status?port=" + encodeURIComponent(state.atPort), 20000);
    if (card.ok) {
      state.cardSignature = card.signature; state.cardReady = card.ready;
      showFeedback(card.ready ? t("deviceConnected", {port: state.atPort}) : t("cardRemoved"), card.ready ? "success" : "neutral");
    } else {
      throw new Error(card.error || t("readUnavailable"));
    }
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

