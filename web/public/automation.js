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
  if (state.busy || state.connecting || state.confirming) return;
  await quickStart();
}

async function quickStart() {
  if (state.busy || state.connecting) return;
  state.connecting = true;
  setBusy(true, "checking");
  showFeedback(t("cardConnecting"));
  try {
    const health = await requestAction("health");
    applyHealth(health.data);
    const found = await requestAction("find-at");
    state.portsSignature = Array.isArray(found.data.ports)
      ? found.data.ports.join("\n")
      : String((await requestAction("ports")).data.stdout || "").trim();
    if (!state.atPort) {
      state.deviceModel = ""; state.deviceRevision = ""; state.usb = "";
      state.cardReady = null;
      clearCardView();
      showFeedback(t(found.data.usbDetected ? "usbWithoutAt" : "cardNotConnected"));
      return;
    }
    updateSummary(found.text);
    // Network details and eSIM discovery are loaded on demand by their views.
    const { data, text } = await requestAction("module-status", {startup: true});
    append(actionTitle("module-status"), text);
    const card = data.card ?? await fetchJson("/api/card-status?port=" + encodeURIComponent(state.atPort), 20000);
    if (card.ok) {
      if ((state.cardSignature && card.signature && state.cardSignature !== card.signature) || (state.cardReady && !card.ready)) clearCardView();
      updateSummary(text);
      updateTemperature(data);
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
    const ports = String((await requestAction("ports")).data.stdout || "").trim();
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

