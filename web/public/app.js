const output = document.querySelector("#output");
const statusPill = document.querySelector("#statusPill");
const hostLine = document.querySelector("#hostLine");
const portInput = document.querySelector("#portInput");
const tokenInput = document.querySelector("#tokenInput");
const languageBtn = document.querySelector("#languageBtn");
const carrierValue = document.querySelector("#carrierValue");
const radioValue = document.querySelector("#radioValue");
const connectionBadge = document.querySelector("#connectionBadge");

const copy = {
  en: {
    title: "DJI RoamDock", hostLocal: "Local control page for the module connected to this computer.",
    idle: "Idle", running: "Running", checking: "Checking", starting: "Starting", at: "AT",
    autoScan: "Auto Scan", switchToChinese: "中文", switchToEnglish: "English",
    overview: "Overview", networkCenter: "Network", esim: "eSIM", sms: "SMS", atLab: "AT Lab", system: "System",
    currentDevice: "Current Device", waitingScan: "Waiting for scan", insertScan: "Insert the dongle, then run Auto Scan.",
    csq: "CSQ", usb: "USB", atPort: "AT Port", network: "Network", sim: "SIM", unknown: "Unknown",
    profilesNotLoaded: "Profiles not loaded", profilesSummary: "{count} profiles · {active} active", switchProfile: "Switch to this plan", currentProfile: "In use", inactiveProfile: "Not active", trafficBalance: "Plan balance", trafficUnavailable: "Provider API required", profileClassLabel: "Profile type", iccidLabel: "ICCID", quickActions: "Quick Actions", deviceCheck: "Device Check", findAt: "Find AT", moduleStatus: "Module Status", esimProfiles: "eSIM Profiles",
    refresh: "Refresh", runScanRefresh: "Run Auto Scan or Refresh.", profileControls: "Profile Controls",
    profileControlDescription: "Enable and disable are real eSIM operations. They are blocked until the local server is started with profile write actions enabled.",
    profileWritesLocked: "Read-only mode: profile writes are locked.", profileWritesEnabled: "Profile writes are enabled on this local server. Confirm each action before it runs.",
    profileDownload: "Download New Profile", download: "Download", activationCodePlaceholder: "LPA:1$sm-dp-plus.example$matching-id",
    profileDownloadDescription: "Paste the complete LPA activation code supplied with a plan you own. This adds a profile; it does not delete existing profiles.", profileDownloadLocked: "Profile download is locked on this local server.", profileDownloadEnabled: "Profile download is enabled. The activation code is not saved or logged.", confirmDownload: "Download this new eSIM profile to the card? Existing profiles will not be deleted.", invalidActivationCode: "Enter the complete LPA:1 activation code from your eSIM provider.",
    profileNickname: "Profile name", save: "Save", confirmNickname: "Save this profile name to the eSIM?", nicknameLocked: "Profile name changes are locked on this local server.", nicknameEnabled: "Profile names can be changed on this local server.", invalidNickname: "Enter a profile name of up to 64 characters.",
    profileNotifications: "Profile Notifications", noNotifications: "No notification data loaded.", noPendingNotifications: "No pending eSIM notifications.", processNotifications: "Process Pending Notifications", profileNotificationsLocked: "Notification processing is locked on this local server.", profileNotificationsEnabled: "Pending notifications can be sent and cleared on this local server.", confirmNotifications: "Send and clear all pending profile notifications?", notificationsParseError: "Notification data could not be parsed: {error}",
    rescueScan: "Rescue Diagnose", rescueDescription: "If another tool changed the module and Windows no longer recognizes it, run Rescue Diagnose first. It only reads USB, ports, drivers, AT and network state.",
    stockSetup: "Original Module Setup", stockSetupDescription: "For a new 2CA3:4006 DJI/Baiwang module: inspect first, then convert only after confirmation.", stockProbe: "Inspect Original USB", stockConvert: "Convert to Quectel", stockUsbnet: "Finish USB Ethernet", stockSetupLocked: "Original-module setup is available here. Each change needs a separate confirmation.", stockSetupEnabled: "Original-module setup is enabled. Each change needs a separate confirmation.", confirmStockConvert: "This changes a stock module from 2CA3:4006 to 2C7C:0125. Type CONVERT to continue.", confirmStockUsbnet: "This sets usbnet=1 and restarts the converted module. Type USBNET to continue.",
    smsInbox: "SMS Inbox", readSms: "Read SMS", noSms: "No SMS loaded.", smsUnread: "Unread", smsRead: "Read", smsSent: "Sent", smsUnsent: "Unsent", smsFrom: "From", smsMessageNumber: "Message {value}", sendSms: "Send SMS", recipient: "Recipient", message: "Message", smsSendLocked: "SMS sending is locked on this local server.", smsSendEnabled: "SMS sending is enabled. Carrier charges may apply.", confirmSms: "Send this SMS now?", invalidSms: "Enter a phone number or service number and a message.", startPolling: "Auto Refresh", stopPolling: "Stop Refresh", safeAtConsole: "Safe AT Console", baseline: "Baseline", send: "Send",
    signal: "Signal", readonlyAtHint: "Read-only AT commands are allowed. Configuration writes remain blocked by default.",
    howWorks: "How It Works", githubPage: "GitHub page:", localConsole: "Local console:", hardwareScope: "Hardware scope:",
    connection: "Connection", consoleToken: "Console Token", ports: "Ports", device: "Device", module: "Module", windowsNetwork: "Windows Network", liveLog: "Live Log", clear: "Clear",
    ipadUrl: "Web console URL: {url}", moduleIp: "Module IP {ip}", adapterDisconnected: "Adapter present, Windows disconnected", adapterPresent: "Adapter present",
    quectelDetected: "Quectel detected", revision: "Revision {value}", active: "Active", enable: "Enable", disable: "Disable",
    unnamed: "Unnamed", noProfileData: "No profile data. Check that lpac.exe is available.", noProfiles: "No eSIM profiles found.",
    profileParseError: "Profile data could not be parsed: {error}", smsEmpty: "SMS read succeeded. The modem storage is currently empty.", noSmsData: "SMS could not be read. Check the AT port and live log.",
    tokenRequired: "Console token required.", timedOut: "Timed out. The module or Windows serial driver did not answer.",
    scanTimedOut: "Timed out; continuing with the next check.", atTimedOut: "AT request timed out.",
    scanProgress: "Scan {current}/{total}", locked: "Profile writes are locked on the server.", confirmProfile: "{action} this eSIM profile? The module may briefly lose network service.",
    networkDescription: "Live Windows adapter status and session traffic.", networkTraffic: "Live Traffic", adapterStatus: "Adapter", downloadSpeed: "Download speed", uploadSpeed: "Upload speed", sessionDownload: "Session download", sessionUpload: "Session upload", gateway: "Gateway", noAdapter: "No compatible USB LTE adapter found.",
    driver: "Driver", ecmDriver: "Windows ECM Driver", driverChecking: "Checking", driverNoData: "Run a network refresh to inspect the driver.", driverReady: "Ready", driverOutdated: "Needs repair", driverMissing: "Not detected", driverUnsupportedDetail: "No verified 2C7C:0125 ECM interface is connected.", driverReadyDetail: "Signed Quectel ECM driver {version} · {ip}", driverOutdatedDetail: "Windows is using {name} {version}; install the verified ECM driver.", repairDriver: "Install or repair official driver", driverRepairHint: "For the verified 2C7C:0125 ECM interface only. Windows will request administrator approval.", driverRepairLocked: "Driver repair is available in the Windows desktop app.", confirmDriverRepair: "Download and install the verified Quectel ECM driver? Type ECMDRIVER to continue.", driverRepairSuccess: "The ECM driver is ready and Windows has refreshed the adapter.", driverRepairFailed: "The ECM driver repair did not complete.",
    usbMode: "USB Mode", usbModeDescription: "Mode 0 keeps management interfaces available; mode 1 exposes the verified USB Ethernet mode. The module restarts after a change.", managementMode: "Management mode", ethernetMode: "USB Ethernet mode", usbModeRisk: "Only use this on the verified 2C7C:0125 module. Switching causes a temporary disconnect.", confirmUsbMode: "Switch to usbnet={mode}? Type {confirm} to continue.", usbModeLocked: "USB mode switching is locked.",
    ussd: "USSD", ussdDescription: "Query a carrier balance or service menu when the SIM and network support USSD.", query: "Query", ussdEnabled: "USSD requests may be billed or unsupported while roaming.", ussdLocked: "USSD is locked.", invalidUssd: "Enter a code such as *100#.", confirmUssd: "Send this USSD request now?",
    deleteProfile: "Delete", deleteIrreversible: "Deleting an eSIM profile cannot be undone.", confirmDeleteProfile: "Delete this profile permanently? Type DELETE to continue.", otpCode: "Verification code", copyCode: "Copy code", copied: "Copied",
  },
  zh: {
    carrier: "运营商", radio: "无线制式", online: "已联网", registered: "已注册", noNetwork: "暂无网络数据",
    title: "DJI RoamDock", hostLocal: "管理连接在这台 Windows 电脑上的模块。",
    idle: "空闲", running: "运行中", checking: "检查中", starting: "开始扫描", at: "AT 指令",
    autoScan: "自动扫描", switchToChinese: "中文", switchToEnglish: "English",
    overview: "概览", networkCenter: "网络", esim: "eSIM", sms: "短信", atLab: "AT 工具", system: "系统",
    currentDevice: "当前设备", waitingScan: "等待扫描", insertScan: "插入模块后点击自动扫描。",
    csq: "信号", usb: "USB", atPort: "AT 端口", network: "网络", sim: "SIM", unknown: "未知",
    profilesNotLoaded: "尚未读取套餐", profilesSummary: "共 {count} 个套餐 · {active} 个启用", switchProfile: "切换到此套餐", currentProfile: "正在使用", inactiveProfile: "未启用", trafficBalance: "套餐余量", trafficUnavailable: "eUICC 不提供，需套餐商接口", profileClassLabel: "Profile 类型", iccidLabel: "ICCID", quickActions: "快捷操作", deviceCheck: "检查设备", findAt: "查找 AT 口", moduleStatus: "模块状态", esimProfiles: "eSIM 套餐",
    refresh: "刷新", runScanRefresh: "请先自动扫描或刷新。", profileControls: "套餐操作",
    profileControlDescription: "启用和停用会真实写入 eSIM 卡，每次操作前都会再次确认。",
    profileWritesLocked: "只读模式：套餐写入已锁定。", profileWritesEnabled: "本地服务已允许套餐写入，每次执行前仍需确认。",
    profileDownload: "下载新套餐", download: "下载", activationCodePlaceholder: "粘贴完整的 LPA:1$... 激活码",
    profileDownloadDescription: "粘贴你自己购买套餐提供的完整 LPA 激活码。此操作只新增 Profile，不会删除已有套餐。", profileDownloadLocked: "本地服务未开放套餐下载。", profileDownloadEnabled: "已开放套餐下载，激活码不会保存或写入日志。", confirmDownload: "确定把这个新 eSIM 套餐下载到卡里吗？已有套餐不会被删除。", invalidActivationCode: "请输入套餐商提供的完整 LPA:1$... 激活码。",
    profileNickname: "套餐名称", save: "保存", confirmNickname: "确定把这个名称写入 eSIM 吗？", nicknameLocked: "套餐名称修改已锁定。", nicknameEnabled: "本地服务已允许修改套餐名称。", invalidNickname: "请输入不超过 64 个字符的套餐名称。",
    profileNotifications: "套餐通知", noNotifications: "尚未读取通知。", noPendingNotifications: "没有待处理的 eSIM 通知。", processNotifications: "处理待发送通知", profileNotificationsLocked: "通知处理已锁定。", profileNotificationsEnabled: "本地服务可发送并清理待处理通知。", confirmNotifications: "确定发送并清理全部待处理通知吗？", notificationsParseError: "通知数据解析失败：{error}",
    rescueScan: "异常设备救援", rescueDescription: "如果模块被其他工具改动后无法识别，请先运行异常设备救援。它只读取 USB、端口、驱动、AT 和网络状态，不会写入模块。",
    stockSetup: "原始模块设置", stockSetupDescription: "适用于原始 2CA3:4006 DJI/Baiwang 模块：先检查，确认后再转换。", stockProbe: "检查原始 USB", stockConvert: "转换为 Quectel", stockUsbnet: "完成 USB 网卡设置", stockSetupLocked: "原始模块设置可在这里进行，每一次改动都需要单独确认。", stockSetupEnabled: "已开放原始模块设置，每一次改动都需要单独确认。", confirmStockConvert: "这会把原始模块从 2CA3:4006 改为 2C7C:0125。输入 CONVERT 继续。", confirmStockUsbnet: "这会设置 usbnet=1 并重启模块。输入 USBNET 继续。",
    smsInbox: "短信收件箱", readSms: "读取短信", noSms: "尚未读取短信。", smsUnread: "未读", smsRead: "已读", smsSent: "已发送", smsUnsent: "未发送", smsFrom: "来自", smsMessageNumber: "短信 {value}", sendSms: "发送短信", recipient: "收件号码", message: "短信内容", smsSendLocked: "短信发送已锁定。", smsSendEnabled: "已开放短信发送，运营商可能收费。", confirmSms: "确定现在发送这条短信吗？", invalidSms: "请输入手机号或运营商服务号码，并填写短信内容。", startPolling: "自动刷新", stopPolling: "停止刷新", safeAtConsole: "安全 AT 工具", baseline: "读取基线", send: "发送",
    signal: "信号", readonlyAtHint: "只允许执行只读 AT 指令，配置写入默认保持关闭。",
    howWorks: "工作方式", githubPage: "GitHub 页面：", localConsole: "本地控制台：", hardwareScope: "硬件范围：",
    connection: "连接", consoleToken: "控制台密码", ports: "端口", device: "设备", module: "模块", windowsNetwork: "Windows 网卡", liveLog: "实时日志", clear: "清空",
    ipadUrl: "网页管理地址：{url}", moduleIp: "模块 IP {ip}", adapterDisconnected: "已发现网卡，但 Windows 未连接", adapterPresent: "已发现网卡",
    quectelDetected: "已发现 Quectel", revision: "版本 {value}", active: "已启用", enable: "启用", disable: "停用",
    unnamed: "未命名", noProfileData: "没有读取到套餐数据，请检查 lpac.exe 是否可用。", noProfiles: "没有找到 eSIM 套餐。",
    profileParseError: "套餐数据解析失败：{error}", smsEmpty: "短信读取成功，模块当前没有已保存的短信。", noSmsData: "短信读取失败，请检查 AT 端口和实时日志。",
    tokenRequired: "需要输入控制台密码。", timedOut: "请求超时，模块或 Windows 串口驱动没有响应。",
    scanTimedOut: "本项超时，继续检查下一项。", atTimedOut: "AT 请求超时。",
    scanProgress: "扫描 {current}/{total}", locked: "服务器已锁定套餐写入。", confirmProfile: "确定要{action}这个 eSIM 套餐吗？模块网络可能短暂中断。",
    networkDescription: "查看 Windows 网卡状态、实时速度和本次运行流量。", networkTraffic: "实时流量", adapterStatus: "网卡", downloadSpeed: "当前下载", uploadSpeed: "当前上传", sessionDownload: "本次下载", sessionUpload: "本次上传", gateway: "网关", noAdapter: "没有发现兼容的 USB 4G 网卡。",
    driver: "驱动", ecmDriver: "Windows ECM 驱动", driverChecking: "检查中", driverNoData: "刷新网络状态后会自动检查驱动。", driverReady: "已就绪", driverOutdated: "需要修复", driverMissing: "未检测到", driverUnsupportedDetail: "当前没有连接已验证的 2C7C:0125 ECM 接口。", driverReadyDetail: "Quectel ECM 签名驱动 {version} · {ip}", driverOutdatedDetail: "Windows 当前使用 {name} {version}，需要安装已验证的 ECM 驱动。", repairDriver: "安装或修复官方驱动", driverRepairHint: "仅用于已验证的 2C7C:0125 ECM 接口，Windows 会请求管理员授权。", driverRepairLocked: "驱动修复只能在 Windows 桌面版中执行。", confirmDriverRepair: "下载并安装已验证的 Quectel ECM 驱动吗？输入 ECMDRIVER 继续。", driverRepairSuccess: "ECM 驱动已就绪，Windows 网卡已刷新。", driverRepairFailed: "ECM 驱动修复没有完成。",
    usbMode: "USB 模式", usbModeDescription: "模式 0 保留管理接口；模式 1 使用已验证的 USB 有线网卡。切换后模块会重启。", managementMode: "管理模式", ethernetMode: "USB 网卡模式", usbModeRisk: "只用于已经确认是 2C7C:0125 的模块，切换时网络会短暂中断。", confirmUsbMode: "确定切换到 usbnet={mode} 吗？输入 {confirm} 继续。", usbModeLocked: "USB 模式切换已锁定。",
    ussd: "USSD 查询", ussdDescription: "当 SIM 和运营商网络支持时，可查询余额或运营商服务菜单。", query: "查询", ussdEnabled: "漫游时 USSD 可能不支持，也可能产生费用。", ussdLocked: "USSD 查询已锁定。", invalidUssd: "请输入类似 *100# 的 USSD 代码。", confirmUssd: "确定现在发送这条 USSD 查询吗？",
    deleteProfile: "删除", deleteIrreversible: "删除 eSIM 套餐后无法恢复。", confirmDeleteProfile: "确定永久删除这个套餐吗？输入 DELETE 继续。", otpCode: "验证码", copyCode: "复制验证码", copied: "已复制",
  },
};

const state = {
  language: localStorage.getItem("uiLanguage") || (navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"),
  authRequired: false, dangerousAtEnabled: false, profileActionsEnabled: false, profileDownloadEnabled: false, profileNicknameEnabled: false, profileNotificationsEnabled: false, profileDeleteEnabled: false, smsSendEnabled: false, ussdEnabled: false, usbModeEnabled: false, stockBootstrapEnabled: false, driverInstallEnabled: false, smsPolling: false, busy: false, busyKey: "running", busyParams: {},
  primaryUrl: "", profileText: "", notificationText: "", smsText: "", networkText: "", usb: "", atPort: "", networkKind: "", moduleIp: "", sim: "", signal: "", carrier: "", radio: "", registration: "", deviceModel: "", deviceRevision: "", trafficPrevious: null, trafficBaseline: null,
};

function t(key, params = {}) {
  const languageCopy = copy[state.language] || copy.en;
  return String(languageCopy[key] || copy.en[key] || key).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
}

function applyLanguage() {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.title = t("title");
  document.querySelector("nav[aria-label]").setAttribute("aria-label", state.language === "zh" ? "分区" : "Sections");
  for (const element of document.querySelectorAll("[data-i18n]")) element.textContent = t(element.dataset.i18n);
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) element.placeholder = t(element.dataset.i18nPlaceholder);
  languageBtn.textContent = state.language === "zh" ? t("switchToEnglish") : t("switchToChinese");
  statusPill.textContent = state.busy ? t(state.busyKey, state.busyParams) : t("idle");
  hostLine.textContent = state.primaryUrl ? t("ipadUrl", { url: state.primaryUrl }) : t("hostLocal");
  updateProfileHint();
  renderSummary();
  if (state.profileText) renderProfiles(state.profileText);
  if (state.notificationText) renderNotifications(state.notificationText);
  if (state.smsText) renderSms(state.smsText);
  if (state.networkText) renderTraffic(state.networkText);
}

function setBusy(isBusy, labelKey = "running", params = {}) {
  state.busy = isBusy; state.busyKey = labelKey; state.busyParams = params;
  statusPill.textContent = isBusy ? t(labelKey, params) : t("idle");
  statusPill.classList.toggle("busy", isBusy);
  for (const button of document.querySelectorAll("button")) {
    if (button.id === "clearBtn") continue;
    button.disabled = button.dataset.profileAction ? isBusy || !state.profileActionsEnabled
      : button.dataset.profileDownload ? isBusy || !state.profileDownloadEnabled
        : button.dataset.profileNickname ? isBusy || !state.profileNicknameEnabled
          : button.dataset.profileNotifications ? isBusy || !state.profileNotificationsEnabled
            : button.dataset.profileDelete ? isBusy || !state.profileDeleteEnabled
              : button.dataset.smsSend ? isBusy || !state.smsSendEnabled
                : button.dataset.ussd ? isBusy || !state.ussdEnabled
                  : button.dataset.usbMode ? isBusy || !state.usbModeEnabled
                    : button.dataset.driverInstall ? isBusy || !state.driverInstallEnabled || button.dataset.driverEligible !== "1" || button.dataset.driverReady === "1" : isBusy;
    if (button.dataset.stockAction) button.disabled = isBusy || !state.stockBootstrapEnabled;
  }
}

function append(title, text) {
  const stamp = new Date().toLocaleTimeString();
  output.textContent += `\n[${stamp}] ${title}\n${text || "(no output)"}\n`;
  output.scrollTop = output.scrollHeight;
}

function actionTitle(action) {
  return ({ "device-check": t("deviceCheck"), "find-at": t("findAt"), "module-status": t("moduleStatus"), "lpac-profiles": t("esimProfiles"), "lpac-notifications": t("profileNotifications"), "sms-list": t("readSms"), "windows-network": t("windowsNetwork"), "network-traffic": t("networkTraffic"), "stock-module-probe": t("stockProbe"), baseline: t("baseline"), health: t("connection"), ports: t("ports") }[action] || action);
}

function apiHeaders(extra = {}) {
  const token = tokenInput.value.trim();
  return { ...extra, ...(token ? { "x-console-token": token } : {}) };
}

function textFromResult(data) { return [data.stdout, data.stderr, data.error].filter(Boolean).join("\n"); }

function renderSummary() {
  document.querySelector("#vidPid").textContent = state.usb || t("unknown");
  document.querySelector("#atPort").textContent = state.atPort || t("unknown");
  document.querySelector("#signalValue").textContent = state.signal || "--";
  document.querySelector("#simState").textContent = state.sim || t("unknown");
  carrierValue.textContent = state.carrier || t("unknown");
  radioValue.textContent = state.radio || t("unknown");
  document.querySelector("#deviceTitle").textContent = state.deviceModel || t("waitingScan");
  document.querySelector("#deviceSubtitle").textContent = state.deviceRevision ? t("revision", { value: state.deviceRevision }) : t("insertScan");
  document.querySelector("#netState").textContent = state.registration || (state.moduleIp ? `${t("online")} · ${state.moduleIp}` : state.networkKind === "disconnected" ? t("adapterDisconnected") : state.networkKind === "present" ? t("adapterPresent") : t("unknown"));
  const status = state.moduleIp ? `${t("online")} · ${state.moduleIp}` : state.registration ? `${t("registered")} · ${state.registration}` : t("noNetwork");
  connectionBadge.textContent = status;
  connectionBadge.classList.toggle("online", Boolean(state.moduleIp));
  connectionBadge.classList.toggle("registered", !state.moduleIp && Boolean(state.registration));
}

function updateSummary(text) {
  const at = text.match(/AT_PORT=(COM\d+)/i) || text.match(/Quectel USB AT Port \((COM\d+)\)/i);
  if (at) { state.atPort = at[1].toUpperCase(); portInput.value = state.atPort; state.usb = t("quectelDetected"); }
  if (/Baiwang[\s\S]*QDC507/i.test(text) && /QCFG.*usbnet.*1/i.test(text)) state.usb = "2C7C:0125";
  if (/Quectel Wireless Ethernet Adapter/i.test(text)) state.networkKind = /Disconnected/i.test(text) ? "disconnected" : "present";
  const cpin = text.match(/\+CPIN:\s*([^\r\n]+)/), cereg = text.match(/\+CEREG:\s*([^\r\n]+)/), cops = text.match(/\+COPS:\s*([^\r\n]+)/), qnwinfo = text.match(/\+QNWINFO:\s*([^\r\n]+)/);
  if (cpin) state.sim = cpin[1].trim();
  if (cereg) state.registration = cereg[1].trim();
  if (cops) {
    const carrier = cops[1].match(/"([^"]+)"/) || cops[1].match(/([^,\s]+)/);
    if (carrier) state.carrier = carrier[1].trim();
  }
  if (qnwinfo) {
    const fields = [...qnwinfo[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    state.radio = fields.filter((field, index) => index === 0 || /BAND|NR5G|LTE/i.test(field)).join(" / ") || fields[0] || qnwinfo[1].trim();
  }
  const csq = text.match(/\+CSQ:\s*(\d+)/); if (csq) state.signal = csq[1];
  const model = text.match(/Baiwang[\s\S]*?QDC507[\s\S]*?Revision:\s*([^\r\n]+)/i);
  if (model) { state.deviceModel = "Baiwang / QDC507"; state.deviceRevision = model[1].trim(); }
  const ip = text.match(/\+CGPADDR:\s*1,"?([^"\r\n]+)"?/); if (ip) state.moduleIp = ip[1];
  renderSummary();
}

function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }

function renderProfiles(text) {
  state.profileText = text;
  const list = document.querySelector("#profilesList");
  const count = document.querySelector("#profileCount");
  const jsonLine = text.split(/\r?\n/).find((line) => line.trim().startsWith("{"));
  if (!jsonLine) { list.className = "profile-list empty"; list.textContent = t("noProfileData"); count.textContent = t("profilesNotLoaded"); return; }
  try {
    const profiles = JSON.parse(jsonLine)?.payload?.data || [];
    const activeCount = profiles.filter((profile) => profile.profileState === "enabled").length;
    count.textContent = t("profilesSummary", { count: profiles.length, active: activeCount });
    if (!profiles.length) { list.className = "profile-list empty"; list.textContent = t("noProfiles"); return; }
    list.className = "profile-list";
    list.innerHTML = profiles.map((profile) => {
      const enabled = profile.profileState === "enabled";
      const id = escapeHtml(profile.iccid || profile.isdpAid || "");
      const action = enabled ? "disable" : "enable";
      const nickname = escapeHtml(profile.profileNickname || profile.profileName || "");
      const title = escapeHtml(profile.profileNickname || profile.profileName || profile.serviceProviderName || t("unnamed"));
      const provider = escapeHtml(profile.serviceProviderName || profile.profileName || "");
      const profileClass = escapeHtml(profile.profileClass || "operational");
      const actionLabel = enabled ? t("disable") : t("switchProfile");
      return `<article class="profile-card ${enabled ? "active" : ""}">
        <div class="profile-card-head">
          <div class="profile-title"><span>${provider}</span><strong>${title}</strong></div>
          <span class="profile-state ${enabled ? "active" : "inactive"}">${enabled ? t("currentProfile") : t("inactiveProfile")}</span>
        </div>
        <div class="profile-detail-grid">
          <div><span>${escapeHtml(t("iccidLabel"))}</span><code>${id}</code></div>
          <div><span>${escapeHtml(t("profileClassLabel"))}</span><strong>${profileClass}</strong></div>
          <div class="profile-traffic"><span>${escapeHtml(t("trafficBalance"))}</span><strong>${escapeHtml(t("trafficUnavailable"))}</strong></div>
        </div>
        <div class="profile-actions">
          <button class="profile-action ${enabled ? "secondary" : ""}" data-profile-action="${action}" data-profile-id="${id}" ${state.profileActionsEnabled ? "" : "disabled"}>${escapeHtml(actionLabel)}</button>
          ${enabled ? "" : `<button class="profile-action danger" data-profile-delete data-profile-id="${id}" ${state.profileDeleteEnabled ? "" : "disabled"}>${escapeHtml(t("deleteProfile"))}</button>`}
          <div class="inline-edit"><input class="nickname-input" data-profile-nickname-input="${id}" value="${nickname}" maxlength="64" aria-label="${t("profileNickname")}"><button class="secondary" data-profile-nickname data-profile-id="${id}" ${state.profileNicknameEnabled ? "" : "disabled"}>${t("save")}</button></div>
        </div>
      </article>`;
    }).join("");
    for (const button of list.querySelectorAll("button[data-profile-action]")) button.addEventListener("click", () => runProfileAction(button.dataset.profileAction, button.dataset.profileId));
    for (const button of list.querySelectorAll("button[data-profile-nickname]")) button.addEventListener("click", () => renameProfile(button.dataset.profileId));
    for (const button of list.querySelectorAll("button[data-profile-delete]")) button.addEventListener("click", () => deleteProfile(button.dataset.profileId));
  } catch (error) { list.className = "profile-list empty"; list.textContent = t("profileParseError", { error: error.message }); count.textContent = t("profilesNotLoaded"); }
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

function parseAtCsv(line) {
  return [...line.matchAll(/(?:^|,)(?:"([^"]*)"|([^,]*))/g)].map((match) => (match[1] ?? match[2] ?? "").trim());
}

function decodeSmsBody(value) {
  const body = value.trim();
  if (!/^(?:[0-9a-f]{4})+$/i.test(body)) return body;
  const decoded = body.match(/.{4}/g).map((chunk) => String.fromCharCode(Number.parseInt(chunk, 16))).join("");
  return /[\p{L}\p{N}\p{P}\p{Z}\r\n]/u.test(decoded) ? decoded : body;
}

function extractVerificationCode(body) {
  const patterns = [
    /(?:验证码|校验码|动态码|验证代码|verification\s*code|security\s*code|one[-\s]?time\s*(?:password|code)|otp|passcode|login\s*code|code)\D{0,12}([0-9]{4,8})/i,
    /([0-9]{4,8})\D{0,12}(?:验证码|校验码|动态码|verification\s*code|security\s*code|one[-\s]?time\s*(?:password|code)|otp|passcode|login\s*code)/i,
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function formatBytes(value, perSecond = false) {
  const bytes = Math.max(0, Number(value) || 0);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = bytes;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  const digits = amount >= 100 || index === 0 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(digits)} ${units[index]}${perSecond ? "/s" : ""}`;
}

function renderTraffic(text) {
  state.networkText = text;
  let adapters = [];
  try {
    const parsed = JSON.parse(String(text || "").trim() || "[]");
    adapters = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  } catch {
    adapters = [];
  }
  const adapter = adapters.find((item) => String(item.status).toLowerCase() === "up") || adapters[0];
  const ids = {
    adapter: document.querySelector("#trafficAdapter"),
    rxRate: document.querySelector("#trafficRxRate"),
    txRate: document.querySelector("#trafficTxRate"),
    rxSession: document.querySelector("#trafficRxSession"),
    txSession: document.querySelector("#trafficTxSession"),
    ipv4: document.querySelector("#trafficIpv4"),
    gateway: document.querySelector("#trafficGateway"),
    driver: document.querySelector("#trafficDriver"),
    dhcp: document.querySelector("#trafficDhcp"),
    driverBadge: document.querySelector("#ecmDriverBadge"),
    driverDetail: document.querySelector("#ecmDriverDetail"),
    repairButton: document.querySelector("#installEcmDriverBtn"),
  };
  if (!adapter) {
    ids.adapter.textContent = t("noAdapter");
    for (const key of ["rxRate", "txRate", "rxSession", "txSession", "ipv4", "gateway", "dhcp"]) ids[key].textContent = "--";
    ids.driver.textContent = t("driverMissing");
    ids.driverBadge.textContent = t("driverMissing");
    ids.driverBadge.className = "driver-badge warning";
    ids.driverDetail.textContent = t("noAdapter");
    ids.repairButton.dataset.driverReady = "0";
    ids.repairButton.dataset.driverEligible = "0";
    ids.repairButton.textContent = t("repairDriver");
    ids.repairButton.disabled = true;
    state.trafficPrevious = null;
    state.trafficBaseline = null;
    return;
  }
  const statisticsReliable = adapter.statisticsReliable !== false;
  const now = Date.now();
  const key = `${adapter.name}|${adapter.description}`;
  const rx = Number(adapter.receivedBytes) || 0;
  const tx = Number(adapter.sentBytes) || 0;
  if (statisticsReliable && (!state.trafficBaseline || state.trafficBaseline.key !== key || rx < state.trafficBaseline.rx || tx < state.trafficBaseline.tx)) {
    state.trafficBaseline = { key, rx, tx };
    state.trafficPrevious = null;
  }
  let rxRate = 0;
  let txRate = 0;
  if (statisticsReliable && state.trafficPrevious?.key === key) {
    const seconds = Math.max(0.2, (now - state.trafficPrevious.time) / 1000);
    rxRate = Math.max(0, rx - state.trafficPrevious.rx) / seconds;
    txRate = Math.max(0, tx - state.trafficPrevious.tx) / seconds;
  }
  state.trafficPrevious = statisticsReliable ? { key, rx, tx, time: now } : null;
  if (!statisticsReliable) state.trafficBaseline = null;
  ids.adapter.textContent = `${adapter.description || adapter.name || t("unknown")} | ${adapter.status || "--"}`;
  ids.rxRate.textContent = statisticsReliable ? formatBytes(rxRate, true) : "--";
  ids.txRate.textContent = statisticsReliable ? formatBytes(txRate, true) : "--";
  ids.rxSession.textContent = statisticsReliable ? formatBytes(rx - state.trafficBaseline.rx) : "--";
  ids.txSession.textContent = statisticsReliable ? formatBytes(tx - state.trafficBaseline.tx) : "--";
  ids.ipv4.textContent = adapter.ipv4 || "--";
  ids.gateway.textContent = adapter.gateway || "--";
  ids.driver.textContent = adapter.driverVersion || t("driverMissing");
  ids.dhcp.textContent = adapter.dhcp || "--";

  const driverTargetPresent = Boolean(adapter.driverTargetPresent);
  const driverReady = Boolean(adapter.driverReady);
  ids.driverBadge.textContent = driverReady ? t("driverReady") : driverTargetPresent ? t("driverOutdated") : t("driverMissing");
  ids.driverBadge.className = `driver-badge ${driverReady ? "ready" : "warning"}`;
  ids.driverDetail.textContent = driverReady
    ? t("driverReadyDetail", { version: adapter.driverVersion || "--", ip: adapter.ipv4 || "--" })
    : driverTargetPresent
      ? t("driverOutdatedDetail", { name: adapter.driverName || adapter.description || t("unknown"), version: adapter.driverVersion || "--" })
      : t("driverUnsupportedDetail");
  ids.repairButton.dataset.driverEligible = driverTargetPresent ? "1" : "0";
  ids.repairButton.dataset.driverReady = driverReady ? "1" : "0";
  ids.repairButton.textContent = driverReady ? t("driverReady") : t("repairDriver");
  ids.repairButton.disabled = state.busy || !state.driverInstallEnabled || !driverTargetPresent || driverReady;
}
function smsStatus(status) {
  const normalized = status.toUpperCase();
  if (normalized.includes("UNREAD")) return { label: t("smsUnread"), className: "unread" };
  if (normalized.includes("UNSENT")) return { label: t("smsUnsent"), className: "unsent" };
  if (normalized.includes("SENT")) return { label: t("smsSent"), className: "sent" };
  return { label: t("smsRead"), className: "read" };
}

function renderSms(text) {
  state.smsText = text;
  const list = document.querySelector("#smsList");
  const count = document.querySelector("#smsCount");
  const matches = [...text.matchAll(/\+CMGL:\s*([^\r\n]+)\r?\n([\s\S]*?)(?=\r?\n\+CMGL:|\r?\nOK|$)/g)];
  count.textContent = String(matches.length);
  if (!matches.length) { list.className = "sms-list empty"; list.textContent = text.includes("+CPMS:") ? t("smsEmpty") : t("noSmsData"); return; }
  list.className = "sms-list";
  list.innerHTML = matches.map((match) => {
    const [index, rawStatus, sender, , receivedAt] = parseAtCsv(match[1]);
    const status = smsStatus(rawStatus || "READ");
    const body = decodeSmsBody(match[2]);
    const code = extractVerificationCode(body);
    return `<article class="sms-card">
      <div class="sms-card-head">
        <div class="sms-contact"><span>${escapeHtml(t("smsFrom"))}</span><strong>${escapeHtml(sender || t("unknown"))}</strong></div>
        <span class="sms-status ${status.className}">${escapeHtml(status.label)}</span>
      </div>
      ${receivedAt ? `<time>${escapeHtml(receivedAt)}</time>` : ""}
      <p class="sms-body">${escapeHtml(body)}</p>
      ${code ? `<div class="sms-code"><span>${escapeHtml(t("otpCode"))}</span><strong>${escapeHtml(code)}</strong><button class="secondary compact" data-copy-code="${escapeHtml(code)}">${escapeHtml(t("copyCode"))}</button></div>` : ""}
      <div class="sms-card-foot"><span>${escapeHtml(t("smsMessageNumber", { value: index || "-" }))}</span></div>
    </article>`;
  }).join("");
  for (const button of list.querySelectorAll("button[data-copy-code]")) button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(button.dataset.copyCode);
    button.textContent = t("copied");
  });
}

function updateProfileHint() {
  document.querySelector("#profileActionsHint").textContent = state.profileActionsEnabled ? t("profileWritesEnabled") : t("profileWritesLocked");
  document.querySelector("#profileDownloadHint").textContent = state.profileDownloadEnabled ? t("profileDownloadEnabled") : t("profileDownloadLocked");
  document.querySelector("#profileNotificationsHint").textContent = state.profileNotificationsEnabled ? t("profileNotificationsEnabled") : t("profileNotificationsLocked");
  document.querySelector("#smsSendHint").textContent = state.smsSendEnabled ? t("smsSendEnabled") : t("smsSendLocked");
  document.querySelector("#stockSetupHint").textContent = state.stockBootstrapEnabled ? t("stockSetupEnabled") : t("stockSetupLocked");
  document.querySelector("#ecmDriverHint").textContent = state.driverInstallEnabled ? t("driverRepairHint") : t("driverRepairLocked");
}

async function fetchJson(path, timeoutMs = 90000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { const res = await fetch(path, { headers: apiHeaders(), signal: controller.signal }); const data = await res.json(); if (res.status === 401) throw new Error(t("tokenRequired")); return data; }
  finally { clearTimeout(timer); }
}

async function requestAction(action) {
  const port = encodeURIComponent(portInput.value.trim() || "COM5");
  const paths = { health: "/api/health", ports: "/api/ports", "device-check": "/api/device-check", "find-at": "/api/find-at", "module-status": `/api/module-status?port=${port}`, baseline: `/api/baseline?port=${port}`, "sms-list": `/api/sms-list?port=${port}`, "lpac-profiles": `/api/lpac-profiles?port=${port}`, "lpac-notifications": `/api/lpac-notifications?port=${port}`, "windows-network": "/api/windows-network", "network-traffic": "/api/network-traffic", "stock-module-probe": "/api/stock-module-probe" };
  const data = await fetchJson(paths[action]); return { data, text: textFromResult(data) || JSON.stringify(data, null, 2) };
}

function applyHealth(data) {
  state.authRequired = Boolean(data.authRequired); state.dangerousAtEnabled = Boolean(data.dangerousAtEnabled); state.profileActionsEnabled = Boolean(data.profileActionsEnabled); state.profileDownloadEnabled = Boolean(data.profileDownloadEnabled); state.profileNicknameEnabled = Boolean(data.profileNicknameEnabled); state.profileNotificationsEnabled = Boolean(data.profileNotificationsEnabled); state.profileDeleteEnabled = Boolean(data.profileDeleteEnabled); state.smsSendEnabled = Boolean(data.smsSendEnabled); state.ussdEnabled = Boolean(data.ussdEnabled); state.usbModeEnabled = Boolean(data.usbModeEnabled); state.stockBootstrapEnabled = Boolean(data.stockBootstrapEnabled); state.driverInstallEnabled = Boolean(data.driverInstallEnabled); state.primaryUrl = data.primaryUrl || "";
  document.querySelector("#tokenRow").style.display = state.authRequired ? "grid" : "none"; updateProfileHint(); applyLanguage();
}

async function callApi(action) {
  setBusy(true, action === "health" ? "checking" : "running");
  try {
    if (action === "sms-list") {
      const found = await requestAction("find-at");
      append(actionTitle("find-at"), found.text);
      updateSummary(found.text);
    }
    const { data, text } = await requestAction(action); append(actionTitle(action), text); updateSummary(text); if (action === "health") applyHealth(data); if (action === "lpac-profiles") renderProfiles(text); if (action === "lpac-notifications") renderNotifications(text); if (action === "sms-list") renderSms(text); if (action === "network-traffic") renderTraffic(data.stdout || ""); }
  catch (error) { append(actionTitle(action), error.name === "AbortError" ? t("timedOut") : error.stack || error.message); }
  finally { setBusy(false); }
}

async function rescueScan() {
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
  const actions = ["health", "device-check", "find-at", "module-status", "network-traffic", "lpac-profiles", "sms-list"];
  setBusy(true, "starting");
  try {
    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index]; setBusy(true, "scanProgress", { current: index + 1, total: actions.length });
      try { const { data, text } = await requestAction(action); append(actionTitle(action), text); updateSummary(text); if (action === "health") applyHealth(data); if (action === "lpac-profiles") renderProfiles(text); if (action === "lpac-notifications") renderNotifications(text); if (action === "sms-list") renderSms(text); if (action === "network-traffic") renderTraffic(data.stdout || ""); }
      catch (error) { append(actionTitle(action), error.name === "AbortError" ? t("scanTimedOut") : error.stack || error.message); }
    }
  } finally { setBusy(false); }
}

async function sendAt() {
  const port = encodeURIComponent(portInput.value.trim() || "COM5"); const command = document.querySelector("#atInput").value.trim(); if (!command) return;
  setBusy(true, "at");
  try { const res = await fetch(`/api/at?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ command }) }); const data = await res.json(); const text = textFromResult(data) || JSON.stringify(data, null, 2); append(`AT ${command}`, text); updateSummary(text); }
  catch (error) { append(`AT ${command}`, error.name === "AbortError" ? t("atTimedOut") : error.stack || error.message); }
  finally { setBusy(false); }
}

async function runProfileAction(action, id) {
  const label = action === "enable" ? t("switchProfile") : t("disable");
  if (!state.profileActionsEnabled) { append(label, t("locked")); return; }
  if (!window.confirm(t("confirmProfile", { action: label.toLowerCase() }))) return;
  setBusy(true, action);
  try { const found = await requestAction("find-at"); append(actionTitle("find-at"), found.text); updateSummary(found.text); const port = encodeURIComponent(portInput.value.trim() || "COM5"); const res = await fetch(`/api/lpac-profile-action?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ action, id, confirm: action.toUpperCase() }) }); const data = await res.json(); append(label, textFromResult(data) || JSON.stringify(data, null, 2)); if (res.ok) await callApi("lpac-profiles"); }
  catch (error) { append(label, error.stack || error.message); }
  finally { setBusy(false); }
}

async function deleteProfile(id) {
  if (!state.profileDeleteEnabled) { append(t("deleteProfile"), t("locked")); return; }
  if (!window.confirm(t("deleteIrreversible"))) return;
  if (window.prompt(t("confirmDeleteProfile")) !== "DELETE") return;
  setBusy(true, "deleteProfile");
  try {
    const port = encodeURIComponent(portInput.value.trim() || "COM5");
    const res = await fetch(`/api/lpac-profile-action?port=${port}`, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ action: "delete", id, confirm: "DELETE" }),
    });
    const data = await res.json();
    append(t("deleteProfile"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (res.ok) {
      await callApi("lpac-profiles");
      await callApi("lpac-notifications");
    }
  } catch (error) { append(t("deleteProfile"), error.stack || error.message); }
  finally { setBusy(false); }
}
async function downloadProfile() {
  const activationCode = document.querySelector("#activationCodeInput").value.trim();
  if (!state.profileDownloadEnabled) { append(t("profileDownload"), t("profileDownloadLocked")); return; }
  if (!activationCode.startsWith("LPA:1$") || activationCode.split("$").length < 3) { append(t("profileDownload"), t("invalidActivationCode")); return; }
  if (!window.confirm(t("confirmDownload"))) return;
  setBusy(true, "profileDownload");
  try {
    const port = encodeURIComponent(portInput.value.trim() || "COM5");
    const res = await fetch(`/api/lpac-profile-download?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ activationCode, confirm: "DOWNLOAD" }) });
    const data = await res.json();
    append(t("profileDownload"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (res.ok) { document.querySelector("#activationCodeInput").value = ""; await callApi("lpac-profiles"); }
  } catch (error) { append(t("profileDownload"), error.stack || error.message); }
  finally { setBusy(false); }
}

async function runStockSetup(endpoint, confirmation, title) {
  if (!state.stockBootstrapEnabled) { append(title, t("stockSetupLocked")); return; }
  if (window.prompt(confirmation) !== (endpoint.endsWith("convert") ? "CONVERT" : "USBNET")) return;
  setBusy(true, "running");
  try {
    const port = encodeURIComponent(portInput.value.trim() || "COM5");
    const res = await fetch(`${endpoint}?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ confirm: endpoint.endsWith("convert") ? "CONVERT" : "USBNET" }) });
    const data = await res.json();
    append(title, textFromResult(data) || JSON.stringify(data, null, 2));
  } catch (error) { append(title, error.stack || error.message); }
  finally { setBusy(false); }
}

async function renameProfile(id) {
  const input = document.querySelector(`[data-profile-nickname-input="${CSS.escape(id)}"]`);
  const nickname = input?.value.trim() || "";
  if (!state.profileNicknameEnabled) { append(t("profileNickname"), t("nicknameLocked")); return; }
  if (!nickname || nickname.length > 64) { append(t("profileNickname"), t("invalidNickname")); return; }
  if (!window.confirm(t("confirmNickname"))) return;
  setBusy(true, "profileNickname");
  try {
    const port = encodeURIComponent(portInput.value.trim() || "COM5");
    const res = await fetch(`/api/lpac-profile-nickname?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ id, nickname, confirm: "RENAME" }) });
    const data = await res.json();
    append(t("profileNickname"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (res.ok) await callApi("lpac-profiles");
  } catch (error) { append(t("profileNickname"), error.stack || error.message); }
  finally { setBusy(false); }
}

async function processNotifications() {
  if (!state.profileNotificationsEnabled) { append(t("profileNotifications"), t("profileNotificationsLocked")); return; }
  if (!window.confirm(t("confirmNotifications"))) return;
  setBusy(true, "profileNotifications");
  try {
    const port = encodeURIComponent(portInput.value.trim() || "COM5");
    const res = await fetch(`/api/lpac-notifications-process?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ confirm: "PROCESS" }) });
    const data = await res.json();
    append(t("profileNotifications"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (res.ok) await callApi("lpac-notifications");
  } catch (error) { append(t("profileNotifications"), error.stack || error.message); }
  finally { setBusy(false); }
}

async function sendSmsMessage() {
  const number = document.querySelector("#smsNumberInput").value.trim();
  const message = document.querySelector("#smsMessageInput").value.trim();
  if (!state.smsSendEnabled) { append(t("sendSms"), t("smsSendLocked")); return; }
  if (!/^\+?[0-9]{3,20}$/.test(number) || !message || message.length > 480) { append(t("sendSms"), t("invalidSms")); return; }
  if (!window.confirm(t("confirmSms"))) return;
  setBusy(true, "sendSms");
  try {
    const found = await requestAction("find-at");
    append(actionTitle("find-at"), found.text);
    updateSummary(found.text);
    const port = encodeURIComponent(portInput.value.trim() || "COM5");
    const res = await fetch(`/api/sms-send?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ number, message, confirm: "SEND" }) });
    const data = await res.json();
    append(t("sendSms"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (res.ok) { document.querySelector("#smsMessageInput").value = ""; }
  } catch (error) { append(t("sendSms"), error.stack || error.message); }
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
    const port = encodeURIComponent(portInput.value.trim() || "COM5");
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
    const port = encodeURIComponent(portInput.value.trim() || "COM5");
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
  if (state.busy || document.hidden || !document.querySelector('.nav-btn[data-target="network"]')?.classList.contains("active")) return;
  try {
    const { data } = await requestAction("network-traffic");
    renderTraffic(data.stdout || "");
  } catch {}
}
function toggleSmsPolling() {
  state.smsPolling = !state.smsPolling;
  const button = document.querySelector("#smsPollingBtn");
  button.textContent = state.smsPolling ? t("stopPolling") : t("startPolling");
  if (state.smsPolling) callApi("sms-list");
}

setInterval(() => { if (state.smsPolling && !state.busy) callApi("sms-list"); }, 20000);
setInterval(refreshTrafficQuietly, 2000);

const launchToken = new URLSearchParams(location.search).get("token") || "";
tokenInput.value = launchToken || localStorage.getItem("consoleToken") || "";
if (launchToken) localStorage.setItem("consoleToken", launchToken);
tokenInput.addEventListener("change", () => localStorage.setItem("consoleToken", tokenInput.value.trim()));
languageBtn.addEventListener("click", () => { state.language = state.language === "zh" ? "en" : "zh"; localStorage.setItem("uiLanguage", state.language); applyLanguage(); });
for (const button of document.querySelectorAll("button[data-action]")) button.addEventListener("click", () => callApi(button.dataset.action));
function selectView(target, updateHash = false) {
  const button = document.querySelector(`.nav-btn[data-target="${target}"]`);
  const view = document.querySelector(`#${target}`);
  if (!button || !view) return;
  document.querySelectorAll(".nav-btn").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  view.classList.add("active");
  if (updateHash) history.replaceState(null, "", `#${target}`);
}

function resetViewScroll() {
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

for (const button of document.querySelectorAll(".nav-btn")) button.addEventListener("click", () => selectView(button.dataset.target, true));
window.addEventListener("hashchange", () => { selectView(location.hash.slice(1)); resetViewScroll(); });
selectView(location.hash.slice(1) || "overview");
if (location.hash) window.addEventListener("load", resetViewScroll, { once: true });
for (const button of document.querySelectorAll(".preset")) button.addEventListener("click", () => { document.querySelector("#atInput").value = button.dataset.command; sendAt(); });
document.querySelector("#autoScanBtn").addEventListener("click", autoScan);
document.querySelector("#rescueScanBtn").addEventListener("click", rescueScan);
document.querySelector("#sendAtBtn").addEventListener("click", sendAt);
document.querySelector("#downloadProfileBtn").addEventListener("click", downloadProfile);
document.querySelector("#processNotificationsBtn").addEventListener("click", processNotifications);
document.querySelector("#sendSmsBtn").addEventListener("click", sendSmsMessage);
document.querySelector("#sendUssdBtn").addEventListener("click", sendUssdRequest);
document.querySelector("#installEcmDriverBtn").addEventListener("click", installEcmDriver);
for (const button of document.querySelectorAll("button[data-usb-mode]")) button.addEventListener("click", () => switchUsbMode(Number(button.dataset.usbMode)));
document.querySelector("#smsPollingBtn").addEventListener("click", toggleSmsPolling);
document.querySelector("#stockConvertBtn").addEventListener("click", () => runStockSetup("/api/stock-module-convert", t("confirmStockConvert"), t("stockConvert")));
document.querySelector("#stockUsbnetBtn").addEventListener("click", () => runStockSetup("/api/stock-module-usbnet", t("confirmStockUsbnet"), t("stockUsbnet")));
document.querySelector("#atInput").addEventListener("keydown", (event) => { if (event.key === "Enter") sendAt(); });
document.querySelector("#clearBtn").addEventListener("click", () => { output.textContent = ""; });

applyLanguage();
callApi("health");
