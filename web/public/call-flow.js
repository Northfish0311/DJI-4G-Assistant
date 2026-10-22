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

