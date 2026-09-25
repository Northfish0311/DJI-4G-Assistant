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
    if (button.querySelector("svg, [data-lucide]")) continue;
    const icon = document.createElement("i");
    icon.dataset.lucide = navigation[button.dataset.openView];
    icon.setAttribute("aria-hidden", "true");
    button.prepend(icon);
  }
  lucide.createIcons();
}
