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
