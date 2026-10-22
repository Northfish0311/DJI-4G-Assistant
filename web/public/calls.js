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

