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

