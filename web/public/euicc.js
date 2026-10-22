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

