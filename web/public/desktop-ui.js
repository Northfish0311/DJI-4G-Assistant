function refreshDesktopIcons() {
  if (!window.lucide) return;
  const navigation = { overview: "layout-dashboard", sms: "messages-square", calls: "phone", euicc: "card-sim", network: "wifi", atlab: "terminal", system: "settings" };
  for (const button of document.querySelectorAll(".nav-btn")) {
    if (button.querySelector("svg, [data-lucide]")) continue;
    const icon = document.createElement("i");
    icon.dataset.lucide = navigation[button.dataset.target];
    icon.setAttribute("aria-hidden", "true");
    button.prepend(icon);
  }
  const controls = { autoScanBtn: "refresh-cw", languageBtn: "languages", pairIosBtn: "qr-code", sendSmsBtn: "send", dialCallBtn: "phone", answerCallBtn: "phone-incoming", hangupCallBtn: "phone-off", startAudioBridgeBtn: "volume-2", stopAudioBridgeBtn: "volume-x", refreshAudioDevicesBtn: "audio-lines" };
  for (const [id, name] of Object.entries(controls)) {
    const button = document.getElementById(id);
    if (!button || button.querySelector("svg, [data-lucide]")) continue;
    const icon = document.createElement("i");
    icon.dataset.lucide = name;
    icon.setAttribute("aria-hidden", "true");
    button.prepend(icon);
  }
  for (const button of document.querySelectorAll("[data-open-view]")) {
    if (button.querySelector(".view-icon")) continue;
    const icon = document.createElement("i");
    icon.className = "view-icon";
    icon.dataset.lucide = navigation[button.dataset.openView];
    icon.setAttribute("aria-hidden", "true");
    button.prepend(icon);
  }
  const native = document.documentElement.classList.contains("native-companion");
  {
    for (const [id, name] of Object.entries({newSmsBtn: "square-pen", dialBackspaceBtn: "delete", clearBtn: "trash-2"})) {
      const button = document.getElementById(id);
      if (!button) continue;
      const label = button.textContent.trim() || button.getAttribute("aria-label");
      button.setAttribute("aria-label", label);
      button.title = button.getAttribute("aria-label");
      button.classList.add(native ? "native-icon-button" : "desktop-icon-button");
      const icon = document.createElement("i");
      icon.dataset.lucide = name;
      icon.setAttribute("aria-hidden", "true");
      button.replaceChildren(icon);
    }
    for (const button of document.querySelectorAll('.view-heading [data-action="module-status"], .view-heading [data-action="euicc-inventory"], .view-heading [data-action="health"], .view-heading [data-action="sms-list"], .view-heading [data-action="network-traffic"]')) {
      if (button.textContent.trim()) {
        button.title = button.textContent.trim();
        button.setAttribute("aria-label", button.title);
      }
      button.classList.add(native ? "native-icon-button" : "desktop-icon-button");
      const icon = document.createElement("i");
      icon.dataset.lucide = "refresh-cw";
      icon.setAttribute("aria-hidden", "true");
      button.replaceChildren(icon);
    }
  }
  lucide.createIcons();
}
