const launchParameters = new URLSearchParams(location.search);
if (launchParameters.get("native") === "ios") document.documentElement.classList.add("native-ios");

const output = document.querySelector("#output");
const statusPill = document.querySelector("#statusPill");
const hostLine = document.querySelector("#hostLine");
const portInput = document.querySelector("#portInput");
const tokenInput = document.querySelector("#tokenInput");
const languageBtn = document.querySelector("#languageBtn");
const pairIosBtn = document.querySelector("#pairIosBtn");
const pairingDialog = document.querySelector("#pairingDialog");
const pairingQr = document.querySelector("#pairingQr");
const pairingQrPlaceholder = document.querySelector("#pairingQrPlaceholder");
const pairingUrl = document.querySelector("#pairingUrl");
const pairingStatus = document.querySelector("#pairingStatus");
const copyPairingBtn = document.querySelector("#copyPairingBtn");
let pairingDeepLink = "";
const carrierValue = document.querySelector("#carrierValue");
const radioValue = document.querySelector("#radioValue");
const connectionBadge = document.querySelector("#connectionBadge");

const copy = {
  en: {
    advanced: "Advanced", console: "Console",
    carrier: "Carrier", radio: "Radio", online: "Online", registered: "Registered", noNetwork: "No network data", registrationHome: "Home network", registrationRoaming: "Roaming", registrationSearching: "Searching", registrationDenied: "Registration denied", registrationUnknown: "Not registered",
    title: "DJI 4G Assistant", hostLocal: "Local control page for the module connected to this computer.",
    idle: "Idle", running: "Running", checking: "Checking", starting: "Starting", at: "AT",
    autoScan: "Auto Scan", automatic: "Auto", switchToChinese: "中文", switchToEnglish: "English",
    pairIos: "Connect iPhone / iPad", iosCompanion: "iOS Companion", pairingTitle: "Connect iPhone or iPad", pairingScanTitle: "Scan once in the DJI 4G Assistant app", pairingDescription: "The app discovers this Windows computer automatically. The QR code securely adds the address and control token.", sameNetwork: "Trusted local network", windowsHost: "Windows host", pairingLoading: "Preparing a secure pairing code...", pairingReady: "Ready to scan.", pairingFailed: "Pairing is unavailable: {error}", pairingQrAlt: "DJI 4G Assistant pairing QR code", copyPairingLink: "Copy pairing link", pairingCopied: "Pairing link copied.", done: "Done", close: "Close", pairingSecurity: "Anyone with this code can control the connected module. Only scan it on a trusted network and never publish it online.",
    overview: "Overview", networkCenter: "Network", esim: "eSIM", sms: "SMS", atLab: "AT Lab", system: "System",
    calls: "Calls", dialAndAnswer: "Dial & Answer", callPageSubtitle: "Enter a number and tap Call", monitorCalls: "Monitor Calls", stopCallMonitor: "Stop Monitor", checkCallCapabilities: "Check Audio", callNumberPlaceholder: "Enter phone number", callReadyFeedback: "Enter a number to call.", advancedDetails: "Advanced details", callSending: "Sending to the module...", dialAccepted: "Dial command accepted. Waiting for the network.", answerAccepted: "Call answered.", hangupAccepted: "Call ended.", dtmfAccepted: "Key sent.", callRejected: "The module rejected the call. This SIM or network may not support voice.", callRequestFailed: "The call request failed.",
    callIdle: "Ready", noActiveCall: "No active voice call", waitingForCall: "Waiting for a call", answerCall: "Answer", hangupCall: "Hang Up", dtmfPlaceholder: "DTMF 0-9 * #", sendDtmf: "Send DTMF",
    audioBridge: "Audio bridge", rawPcm: "Raw PCM", windowsAudio: "Windows audio", audioNotConnected: "Not connected", startAudio: "Start Audio", stopAudio: "Stop Audio", audioBridgeActive: "Connected", audioBridgeUnavailable: "USB call audio is unavailable.", audioPermissionFailed: "Windows audio access failed.", audioNeedsCall: "Start or answer a call first.", audioEndpointMissing: "The module audio input/output was not found.", notChecked: "Not checked", dialer: "Dialer", dialCall: "Call",
    callCapabilities: "Call Capability", atCallControl: "AT call control", available: "Available", callerId: "Caller ID", voiceAudioBridge: "Voice audio bridge", experimental: "Experimental", audioBridgeReady: "Ready", pcmInterfaceOnly: "PCM interface only", enableCallerId: "Enable Caller ID",
    recentCalls: "Recent Calls", thisSession: "This session", noCallHistory: "No call activity yet.", callActive: "Connected", callHeld: "On hold", callDialing: "Dialing", callAlerting: "Ringing", callIncoming: "Incoming call", callWaiting: "Call waiting", callDisconnected: "Ended",
    incomingCall: "Incoming", outgoingCall: "Outgoing", callId: "Call {id}", numberUnavailable: "Number unavailable", callerIdOn: "Enabled", callerIdOff: "Disabled", supported: "Supported", unsupported: "Unavailable", audioDeviceFound: "Audio device found", noStandardAudio: "No USB audio device",
    rawPcmReady: "QPCMV available", callControlsLocked: "Call controls are locked on this local server.", invalidCallNumber: "Enter a phone number using digits and an optional leading +.", invalidDtmf: "Enter DTMF digits using 0-9, * or #.",
    confirmDial: "Call {number} now?",
    moduleVoiceRuntime: "QDC507 runtime", qpcmvBlocked: "AT route blocked by firmware", voiceSetupTitle: "Call Audio Setup", voiceSetupSubtitle: "One-time module setup, then audio starts after a call connects.", voiceStepRuntime: "Verified runtime", voiceStepRuntimeHint: "Download the pinned QDC507 runtime and verify every SHA-256.", voiceStepUsb: "Module audio interfaces", voiceStepUsbHint: "Preserve VID/PID and existing functions; enable only ADB and UAC with a local backup.", voiceStepPrepare: "Temporary voice route", voiceStepPrepareHint: "Optionally prepare now; Start Audio also does this automatically. A module restart clears it.", statusPending: "Not checked", downloadVoiceRuntime: "Download runtime", enableVoiceUsb: "Enable ADB + audio", prepareVoiceRuntime: "Prepare calls", restoreVoiceUsb: "Restore latest USB backup", refreshVoiceSetup: "Refresh status", runtimeMissing: "Not downloaded", runtimeDownloaded: "Verified", usbSetupNeeded: "Not enabled", usbDriverNeeded: "Driver needed", usbReady: "Ready", runtimePrepared: "Prepared", runtimeNotPrepared: "Not prepared", adbDriverNeeded: "ADB driver needed", openZadig: "Open official Zadig page", zadigNote: "Use Zadig only on the QDC507 ADB MI_06 child interface. Never replace the composite parent, ECM, AT, NMEA, modem or audio interfaces.", voiceSetupWaiting: "Run a status check to begin.", voiceSetupReady: "Call audio is ready on this Windows computer.", voiceSetupLocalOnly: "Call audio runs on this Windows computer. Phones and tablets on the LAN can control calls but cannot carry the Windows USB audio.", voiceSetupUnsupported: "This automatic audio setup only supports the verified QDC507GLEFM21 firmware.", confirmVoiceDownload: "Download the pinned MaVo QDC507 runtime and verify its SHA-256 files?", confirmVoiceUsb: "This permanently authorizes module ADB, preserves VID/PID and existing USB functions, enables only ADB/UAC, saves a local backup and restarts the module. Restoring USB flags cannot revoke QADBKEY authorization. Continue?", confirmVoicePrepare: "Load the verified temporary voice drivers into module memory? A module restart clears them.", confirmVoiceRestore: "Restore the latest local USB backup for this exact module IMEI and VID/PID? The module will restart; persistent QADBKEY authorization may remain.", voiceActionFailed: "Voice setup failed.", voiceActionDone: "Voice setup step completed.", audioRouteFailed: "The module voice route could not start.",
 confirmAnswer: "Answer this call?", confirmHangup: "End this call?", confirmDtmf: "Send these DTMF digits?", confirmCallerId: "Enable caller ID reporting on the module?", callsMonitoring: "Monitoring", callsPaused: "Paused", callStatus: "Call status", observedAt: "Observed {time}",
    currentDevice: "Current Device", waitingScan: "Waiting for scan", insertScan: "Insert the dongle, then run Auto Scan.",
    csq: "CSQ", usb: "USB", atPort: "AT Port", network: "Network", sim: "SIM", unknown: "Unknown",
    esimLibrary: "eSIM Library", eidsNotLoaded: "EIDs not loaded", eidsSummary: "{count} EID space(s) found", detectedSpaces: "Detected spaces", chooseEid: "Choose an EID to manage", automaticDiscovery: "Automatic discovery", probeSummary: "{count} EID(s) · {checked} AID(s) checked", refreshAllEids: "Refresh all EIDs", selectedEid: "Selected EID", noEidSelected: "No EID selected", notSelected: "Not selected", manageEid: "Manage", selected: "Selected", activeProfiles: "Active profiles", selectEidFirst: "Select an EID first.", defaultEidLabel: "eUICC space {index}", eidSpaceLabel: "Local label", renameEid: "Rename", eidLabelPrompt: "Enter a local label for this EID, or leave blank to clear it.", eidLabelSaved: "EID label saved.", privateAid: "Private ISD-R AID", privateAidDescription: "Only use an AID supplied by the card maker when a private eUICC space is not enumerable. It is validated read-only before being remembered.", privateAidPlaceholder: "32-character hexadecimal AID", addAndVerify: "Add & Verify", privateAidHint: "This does not switch profiles or change USB settings.", invalidAid: "Enter a valid hexadecimal ISD-R AID.", confirmAddAid: "Validate this private AID with a read-only EID query?", aidAdded: "Private AID verified and remembered.", targetEid: "Target: {label}",
    euiccInfo: "eUICC Info", eid: "EID", installedProfiles: "Stored profiles", availableMemory: "Free memory", pendingProfiles: "Pending downloads", profileSource: "Profile Sources", profileSourceNote: "Enabled and disabled profiles stored on this EID are listed. Provider app orders are not card profiles.", checkPendingProfiles: "Check Pending", discoveryNotChecked: "GSMA SM-DS has not been checked.", noPendingProfiles: "No pending profiles found on GSMA SM-DS.", pendingProfileSummary: "{count} pending source(s) found", chipInfoUnavailable: "eUICC info unavailable.",
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
    smsInbox: "SMS Inbox",
    smsStorageUsage: "Module storage {used}/{total}", smsStorageFull: "SMS storage is full ({used}/{total}). New messages may be dropped. Delete an old message you no longer need.", smsStorageNearFull: "SMS storage is nearly full ({used}/{total}).", deleteSms: "Delete", confirmDeleteSms: "Delete message {index} from module storage? This cannot be undone.", smsDeleted: "Message deleted. Inbox capacity has been refreshed.", smsDeleteLocked: "SMS deletion is locked on this local server.",
 readSms: "Read SMS", noSms: "No SMS loaded.", smsUnread: "Unread", smsRead: "Read", smsSent: "Sent", smsUnsent: "Unsent", smsFrom: "From", smsMessageNumber: "Message {value}", sendSms: "Send SMS", recipient: "Recipient", message: "Message", smsSendLocked: "SMS sending is locked on this local server.", smsSendEnabled: "SMS sending is enabled. Carrier charges may apply.", confirmSms: "Send this SMS now?", invalidSms: "Enter a phone number or service number and a message.", startPolling: "Auto Refresh", stopPolling: "Stop Refresh", safeAtConsole: "Safe AT Console", baseline: "Baseline", send: "Send",
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
    advanced: "\u9ad8\u7ea7\u8bbe\u7f6e", console: "\u63a7\u5236\u53f0",
    carrier: "运营商", radio: "无线制式", online: "已联网", registered: "已注册", noNetwork: "暂无网络数据", registrationHome: "本地注册", registrationRoaming: "漫游注册", registrationSearching: "正在搜索", registrationDenied: "注册被拒绝", registrationUnknown: "未注册",
    title: "DJI 4G Assistant", hostLocal: "管理连接在这台 Windows 电脑上的模块。",
    idle: "空闲", running: "运行中", checking: "检查中", starting: "开始扫描", at: "AT 指令",
    autoScan: "自动扫描", automatic: "自动", switchToChinese: "中文", switchToEnglish: "English",
    pairIos: "连接 iPhone / iPad", iosCompanion: "iOS 客户端", pairingTitle: "连接 iPhone 或 iPad", pairingScanTitle: "在 DJI 4G Assistant App 中扫码一次", pairingDescription: "App 会自动发现这台 Windows 电脑，二维码会安全添加管理地址和控制密码。", sameNetwork: "可信局域网", windowsHost: "Windows 主机", pairingLoading: "正在生成安全配对码...", pairingReady: "配对码已就绪，请用 App 扫描。", pairingFailed: "暂时无法配对：{error}", pairingQrAlt: "DJI 4G Assistant 配对二维码", copyPairingLink: "复制配对链接", pairingCopied: "配对链接已复制。", done: "完成", close: "关闭", pairingSecurity: "拿到此配对码的人可以控制已连接的模块。只在可信网络中扫码，绝对不要把二维码或链接公开到网上。",
    overview: "概览", networkCenter: "网络", esim: "eSIM", sms: "短信", atLab: "AT 工具", system: "系统",
    calls: "电话", dialAndAnswer: "接打电话", callPageSubtitle: "输入号码，点拨打即可", monitorCalls: "监听来电", stopCallMonitor: "停止监听", checkCallCapabilities: "检查音频", callNumberPlaceholder: "请输入电话号码", callReadyFeedback: "输入号码后点“拨打”。", advancedDetails: "高级信息", callSending: "正在发送给模块...", dialAccepted: "模块已接受拨号，正在等待网络响应。", answerAccepted: "已接听。", hangupAccepted: "通话已结束。", dtmfAccepted: "按键已发送。", callRejected: "模块拒绝拨号，当前 SIM 或网络可能不支持语音。", callRequestFailed: "拨号请求失败。",
    callIdle: "可以拨号", noActiveCall: "当前没有语音通话", waitingForCall: "等待来电或输入号码", answerCall: "接听", hangupCall: "挂断", dtmfPlaceholder: "DTMF 0-9 * #", sendDtmf: "发送按键",
    audioBridge: "音频桥接", rawPcm: "原始 PCM", windowsAudio: "Windows 声音", audioNotConnected: "未连接", startAudio: "启动声音", stopAudio: "停止声音", audioBridgeActive: "已连接", audioBridgeUnavailable: "当前没有可用的 USB 通话音频。", audioPermissionFailed: "Windows 音频访问失败。", audioNeedsCall: "请先拨通或接听电话。", audioEndpointMissing: "没有找到模块的音频输入和输出端点。", notChecked: "未检查", dialer: "拨号盘", dialCall: "拨打",
    callCapabilities: "通话能力", atCallControl: "AT 呼叫控制", available: "可用", callerId: "来电号码", voiceAudioBridge: "语音音频桥", experimental: "实验中", audioBridgeReady: "可以连接", pcmInterfaceOnly: "只有 PCM 接口", enableCallerId: "启用来电显示",
    recentCalls: "最近通话", thisSession: "仅本次运行", noCallHistory: "还没有通话记录。", callActive: "通话中", callHeld: "已保持", callDialing: "正在拨号", callAlerting: "对方振铃", callIncoming: "有来电", callWaiting: "来电等待", callDisconnected: "已结束",
    incomingCall: "来电", outgoingCall: "去电", callId: "通话 {id}", numberUnavailable: "号码未知", callerIdOn: "已启用", callerIdOff: "未启用", supported: "支持", unsupported: "不可用", audioDeviceFound: "发现音频设备", noStandardAudio: "没有 USB 声卡",
    rawPcmReady: "QPCMV 可用", callControlsLocked: "本地服务没有开放电话控制。", invalidCallNumber: "请输入数字组成的电话号码，可以在开头使用 +。", invalidDtmf: "按键只能包含 0-9、* 或 #。",
    confirmDial: "现在拨打 {number} 吗？",
    moduleVoiceRuntime: "QDC507 语音运行时", qpcmvBlocked: "固件已裁剪 AT 音频路由", voiceSetupTitle: "通话声音设置", voiceSetupSubtitle: "第一次完成模块准备，以后电话接通后点“启动声音”即可。", voiceStepRuntime: "校验语音文件", voiceStepRuntimeHint: "下载固定版本的 QDC507 运行时，并逐个核对 SHA-256。", voiceStepUsb: "打开模块音频接口", voiceStepUsbHint: "保留 VID/PID 和已有功能，只打开 ADB、UAC，并先保存本地备份。", voiceStepPrepare: "准备临时语音路由", voiceStepPrepareHint: "可提前准备；点“启动声音”时也会自动完成。模块重启后会自动清除。", statusPending: "尚未检查", downloadVoiceRuntime: "下载语音文件", enableVoiceUsb: "打开 ADB 和声音", prepareVoiceRuntime: "准备通话声音", restoreVoiceUsb: "恢复最近 USB 备份", refreshVoiceSetup: "刷新状态", runtimeMissing: "尚未下载", runtimeDownloaded: "校验通过", usbSetupNeeded: "尚未打开", usbDriverNeeded: "需要驱动", usbReady: "已经就绪", runtimePrepared: "准备完成", runtimeNotPrepared: "尚未准备", adbDriverNeeded: "需要安装 ADB 驱动", openZadig: "打开 Zadig 官网", zadigNote: "Zadig 只能选择 QDC507 ADB MI_06 子接口。绝对不要替换复合设备本体、ECM 网卡、AT、NMEA、Modem 或音频接口。", voiceSetupWaiting: "先点“刷新状态”开始检查。", voiceSetupReady: "这台 Windows 电脑已经可以桥接通话声音。", voiceSetupLocalOnly: "声音在连接模块的 Windows 电脑上处理；同一局域网的手机和平板可以控制电话，但不能直接承载 Windows 的 USB 声音。", voiceSetupUnsupported: "自动声音设置只支持已经验证的 QDC507GLEFM21 固件。", confirmVoiceDownload: "下载固定版本的 MaVo QDC507 语音文件，并核对每个文件的 SHA-256 吗？", confirmVoiceUsb: "这会永久授权模块 ADB；程序会保留 VID/PID 和已有 USB 功能，只打开 ADB/UAC，先保存本地备份，再重启模块。恢复 USB 位不能撤销 QADBKEY 持久授权。确定继续吗？", confirmVoicePrepare: "把已校验的语音驱动临时加载到模块内存吗？模块重启后会自动清除。", confirmVoiceRestore: "为当前相同 IMEI 和 VID/PID 的模块恢复最近一份 USB 备份吗？模块会重启，QADBKEY 持久授权可能仍然保留。", voiceActionFailed: "语音设置失败。", voiceActionDone: "这一步已经完成。", audioRouteFailed: "模块通话声音路由启动失败。",
 confirmAnswer: "接听这个电话吗？", confirmHangup: "结束这个电话吗？", confirmDtmf: "发送这些 DTMF 按键吗？", confirmCallerId: "启用模块的来电号码上报吗？", callsMonitoring: "正在监听", callsPaused: "已暂停", callStatus: "通话状态", observedAt: "记录于 {time}",
    currentDevice: "当前设备", waitingScan: "等待扫描", insertScan: "插入模块后点击自动扫描。",
    csq: "信号", usb: "USB", atPort: "AT 端口", network: "网络", sim: "SIM", unknown: "未知",
    esimLibrary: "eSIM 卡库", eidsNotLoaded: "尚未读取 EID", eidsSummary: "自动发现 {count} 个 EID 空间", detectedSpaces: "已发现的存储空间", chooseEid: "选择一个 EID 进行管理", automaticDiscovery: "自动识别", probeSummary: "发现 {count} 个 EID · 已检查 {checked} 个 AID", refreshAllEids: "刷新全部 EID", selectedEid: "当前管理的 EID", noEidSelected: "尚未选择 EID", notSelected: "未选择", manageEid: "管理", selected: "已选择", activeProfiles: "已启用套餐", selectEidFirst: "请先选择一个 EID。", defaultEidLabel: "eUICC 空间 {index}", eidSpaceLabel: "本地分类名称", renameEid: "改名", eidLabelPrompt: "输入这个 EID 的本地分类名称，留空可清除。", eidLabelSaved: "EID 分类名称已保存。", privateAid: "私有 ISD-R AID", privateAidDescription: "只有卡商明确提供私有 AID、且该空间无法自动枚举时才使用。程序会先做只读 EID 验证，再记住它。", privateAidPlaceholder: "32 位十六进制 AID", addAndVerify: "添加并验证", privateAidHint: "此操作不会切换套餐，也不会修改 USB 设置。", invalidAid: "请输入有效的十六进制 ISD-R AID。", confirmAddAid: "现在用只读 EID 查询验证这个私有 AID 吗？", aidAdded: "私有 AID 已验证并记住。", targetEid: "目标：{label}",
    euiccInfo: "eUICC 信息", eid: "EID 卡片编号", installedProfiles: "卡内套餐", availableMemory: "剩余空间", pendingProfiles: "待下载套餐", profileSource: "套餐来源", profileSourceNote: "这里只显示当前 EID 卡内已启用和已停用的套餐；套餐商 App 中的订单不会自动变成卡内套餐。", checkPendingProfiles: "检查待下载", discoveryNotChecked: "尚未检查 GSMA SM-DS。", noPendingProfiles: "GSMA SM-DS 没有发现待下载套餐。", pendingProfileSummary: "发现 {count} 个待下载来源", chipInfoUnavailable: "无法读取 eUICC 信息。",
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
    smsInbox: "短信收件箱",
    smsStorageUsage: "模块短信容量 {used}/{total}", smsStorageFull: "模块短信仓库已满（{used}/{total}），新短信可能无法写入。请确认后删除一条不再需要的旧短信。", smsStorageNearFull: "模块短信仓库快满了（{used}/{total}）。", deleteSms: "删除", confirmDeleteSms: "确定从模块中删除第 {index} 条短信吗？删除后无法恢复。", smsDeleted: "短信已删除，收件箱容量已经刷新。", smsDeleteLocked: "本地服务没有开放短信删除。",
 readSms: "读取短信", noSms: "尚未读取短信。", smsUnread: "未读", smsRead: "已读", smsSent: "已发送", smsUnsent: "未发送", smsFrom: "来自", smsMessageNumber: "短信 {value}", sendSms: "发送短信", recipient: "收件号码", message: "短信内容", smsSendLocked: "短信发送已锁定。", smsSendEnabled: "已开放短信发送，运营商可能收费。", confirmSms: "确定现在发送这条短信吗？", invalidSms: "请输入手机号或运营商服务号码，并填写短信内容。", startPolling: "自动刷新", stopPolling: "停止刷新", safeAtConsole: "安全 AT 工具", baseline: "读取基线", send: "发送",
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
  authRequired: false, dangerousAtEnabled: false, profileActionsEnabled: false, profileDownloadEnabled: false, profileNicknameEnabled: false, profileNotificationsEnabled: false, profileDeleteEnabled: false, smsSendEnabled: false, smsDeleteEnabled: false, callActionsEnabled: false, ussdEnabled: false, usbModeEnabled: false, stockBootstrapEnabled: false, driverInstallEnabled: false, voiceRuntimeEnabled: false, smsPolling: false, callMonitoring: false, callRefreshInFlight: false, callActionInFlight: false, busy: false, busyKey: "running", busyParams: {},
  primaryUrl: "", euiccInventory: [], euiccCandidatesChecked: 0, activeEid: "", activeAid: "", inventoryLoaded: false, chipText: "", discoveryText: "", profileText: "", notificationText: "", smsText: "", networkText: "", callStatusData: null, callCapabilityData: null, voiceRuntimeStatus: null, voiceSetupBusy: false, callHistory: [], lastCallKey: "", lastVoiceCall: null, audioBridge: null, audioBridgeStarting: false, usb: "", atPort: "", networkKind: "", moduleIp: "", sim: "", signal: "", carrier: "", radio: "", registrationCode: "", deviceModel: "", deviceRevision: "", trafficPrevious: null, trafficBaseline: null, autoLoadedViews: new Set(),
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
  pairingQr.alt = t("pairingQrAlt");
  document.querySelector("#closePairingBtn").setAttribute("aria-label", t("close"));
  document.querySelector("#closePairingBtn").title = t("close");
  statusPill.textContent = state.busy ? t(state.busyKey, state.busyParams) : t("idle");
  hostLine.textContent = state.primaryUrl ? t("ipadUrl", { url: state.primaryUrl }) : t("hostLocal");
  updateProfileHint();
  renderSummary();
  if (state.inventoryLoaded) renderEuiccInventory({ eids: state.euiccInventory, candidatesChecked: state.euiccCandidatesChecked });
  else if (state.chipText) renderChip(state.chipText);
  if (state.discoveryText) renderDiscovery(state.discoveryText);
  if (state.profileText && !state.inventoryLoaded) renderProfiles(state.profileText);
  if (state.notificationText) renderNotifications(state.notificationText);
  if (state.smsText) renderSms(state.smsText);
  if (state.networkText) renderTraffic(state.networkText);
  if (state.callStatusData) renderCallStatus(state.callStatusData);
  if (state.callCapabilityData) renderCallCapabilities(state.callCapabilityData);
  if (state.voiceRuntimeStatus) renderVoiceSetup(state.voiceRuntimeStatus);
  renderCallHistory();
}

function setBusy(isBusy, labelKey = "running", params = {}) {
  state.busy = isBusy; state.busyKey = labelKey; state.busyParams = params;
  statusPill.textContent = isBusy ? t(labelKey, params) : t("idle");
  statusPill.classList.toggle("busy", isBusy);
  for (const button of document.querySelectorAll("button")) {
    if (button.id === "clearBtn" || button.closest("#calls") || button.closest("#pairingDialog")) continue;
    button.disabled = button.dataset.profileAction ? isBusy || !state.profileActionsEnabled
      : button.dataset.profileDownload ? isBusy || !state.profileDownloadEnabled
        : button.dataset.profileNickname ? isBusy || !state.profileNicknameEnabled
          : button.dataset.profileNotifications ? isBusy || !state.profileNotificationsEnabled
            : button.dataset.profileDelete ? isBusy || !state.profileDeleteEnabled
              : button.dataset.smsSend ? isBusy || !state.smsSendEnabled
                : button.dataset.smsDelete ? isBusy || !state.smsDeleteEnabled
                  : button.dataset.callAction ? isBusy || !state.callActionsEnabled
                  : button.dataset.ussd ? isBusy || !state.ussdEnabled
                  : button.dataset.usbMode ? isBusy || !state.usbModeEnabled
                    : button.dataset.driverInstall ? isBusy || !state.driverInstallEnabled || button.dataset.driverEligible !== "1" || button.dataset.driverReady === "1"
                      : button.dataset.euiccSelect ? isBusy || button.dataset.euiccSelect === state.activeEid : isBusy;
    if (button.dataset.stockAction) button.disabled = isBusy || !state.stockBootstrapEnabled;
  }
  syncCallButtons();
}

function append(title, text) {
  const stamp = new Date().toLocaleTimeString();
  output.textContent += `\n[${stamp}] ${title}\n${text || "(no output)"}\n`;
  output.scrollTop = output.scrollHeight;
}

function actionTitle(action) {
  return ({ "device-check": t("deviceCheck"), "find-at": t("findAt"), "module-status": t("moduleStatus"), "euicc-inventory": t("esimLibrary"), "lpac-chip": t("euiccInfo"), "lpac-discovery": t("checkPendingProfiles"), "lpac-profiles": t("esimProfiles"), "lpac-notifications": t("profileNotifications"), "sms-list": t("readSms"), "call-status": t("callStatus"), "call-capabilities": t("callCapabilities"), "windows-network": t("windowsNetwork"), "network-traffic": t("networkTraffic"), "stock-module-probe": t("stockProbe"), baseline: t("baseline"), health: t("connection"), ports: t("ports") }[action] || action);
}

function apiHeaders(extra = {}) {
  const token = tokenInput.value.trim();
  return { ...extra, ...(token ? { "x-console-token": token } : {}) };
}

function textFromResult(data) { return [data.stdout, data.stderr, data.error].filter(Boolean).join("\n"); }

function registrationLabel(code) {
  const key = ({ "1": "registrationHome", "5": "registrationRoaming", "2": "registrationSearching", "3": "registrationDenied", "0": "registrationUnknown", "4": "registrationUnknown" })[String(code || "")];
  return key ? t(key) : "";
}

function renderSummary() {
  const registration = registrationLabel(state.registrationCode);
  document.querySelector("#vidPid").textContent = state.usb || t("unknown");
  document.querySelector("#atPort").textContent = state.atPort || t("unknown");
  document.querySelector("#signalValue").textContent = state.signal || "--";
  document.querySelector("#simState").textContent = state.sim || t("unknown");
  carrierValue.textContent = state.carrier || t("unknown");
  radioValue.textContent = state.radio || t("unknown");
  document.querySelector("#deviceTitle").textContent = state.deviceModel || t("waitingScan");
  document.querySelector("#deviceSubtitle").textContent = state.deviceRevision ? t("revision", { value: state.deviceRevision }) : t("insertScan");
  document.querySelector("#netState").textContent = registration || (state.moduleIp ? `${t("online")} · ${state.moduleIp}` : state.networkKind === "disconnected" ? t("adapterDisconnected") : state.networkKind === "present" ? t("adapterPresent") : t("unknown"));
  const status = state.moduleIp ? `${t("online")} · ${state.moduleIp}` : registration ? `${t("registered")} · ${registration}` : t("noNetwork");
  connectionBadge.textContent = status;
  connectionBadge.classList.toggle("online", Boolean(state.moduleIp));
  connectionBadge.classList.toggle("registered", !state.moduleIp && Boolean(registration));
}

function updateSummary(text) {
  const at = text.match(/AT_PORT=(COM\d+)/i) || text.match(/Quectel USB AT Port \((COM\d+)\)/i);
  if (at) { state.atPort = at[1].toUpperCase(); portInput.value = state.atPort; state.usb = t("quectelDetected"); }
  if (/Baiwang[\s\S]*QDC507/i.test(text) && /QCFG.*usbnet.*1/i.test(text)) state.usb = "2C7C:0125";
  if (/Quectel Wireless Ethernet Adapter/i.test(text)) state.networkKind = /Disconnected/i.test(text) ? "disconnected" : "present";
  const cpin = text.match(/\+CPIN:\s*([^\r\n]+)/), cereg = text.match(/\+CEREG:\s*([^\r\n]+)/), cops = text.match(/\+COPS:\s*([^\r\n]+)/), qnwinfo = text.match(/\+QNWINFO:\s*([^\r\n]+)/);
  if (cpin) state.sim = cpin[1].trim();
  if (cereg) {
    const registrationFields = cereg[1].split(",").map((field) => field.trim());
    state.registrationCode = registrationFields.length > 1 ? registrationFields[1] : registrationFields[0];
  }
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
  return item?.label || t("defaultEidLabel", { index: index + 1 });
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
  installed.textContent = String(item.profileCount ?? item.profiles?.length ?? 0);
  active.textContent = String(item.activeCount ?? item.profiles?.filter((profile) => profile.profileState === "enabled").length ?? 0);
  memory.textContent = item.freeMemory ? formatBytes(item.freeMemory) : "--";
  renderProfileItems(Array.isArray(item.profiles) ? item.profiles : []);
}

function selectEuicc(eid) {
  const item = state.euiccInventory.find((entry) => entry.eid === eid);
  if (!item || item.eid === state.activeEid) return;
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
    return `<article class="euicc-slot-card ${selected ? "active" : ""}">
      <div class="euicc-slot-head"><span class="euicc-slot-index">${index + 1}</span><span class="profile-state ${selected ? "active" : "inactive"}">${escapeHtml(selected ? t("selected") : t("notSelected"))}</span></div>
      <div class="euicc-slot-copy"><strong>${escapeHtml(label)}</strong><code title="${escapeHtml(item.eid)}">${escapeHtml(shortEid(item.eid))}</code></div>
      <div class="euicc-slot-stats"><span>${escapeHtml(t("installedProfiles"))}<strong>${Number(item.profileCount) || 0}</strong></span><span>${escapeHtml(t("activeProfiles"))}<strong>${Number(item.activeCount) || 0}</strong></span></div>
      <div class="euicc-slot-actions"><button data-euicc-select="${escapeHtml(item.eid)}" ${selected ? "disabled" : ""}>${escapeHtml(selected ? t("selected") : t("manageEid"))}</button><button class="secondary" data-euicc-label="${escapeHtml(item.eid)}">${escapeHtml(t("renameEid"))}</button></div>
    </article>`;
  }).join("");
  for (const button of inventory.querySelectorAll("[data-euicc-select]")) button.addEventListener("click", () => selectEuicc(button.dataset.euiccSelect));
  for (const button of inventory.querySelectorAll("[data-euicc-label]")) button.addEventListener("click", () => renameEuicc(button.dataset.euiccLabel));
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
    item.profileCount = profiles.length;
    item.activeCount = profiles.filter((profile) => profile.profileState === "enabled").length;
    renderEuiccInventory({ eids: state.euiccInventory, candidatesChecked: state.euiccCandidatesChecked });
    return;
  }
  renderProfileItems(profiles);
}

function renderProfileItems(profiles) {
  const list = document.querySelector("#profilesList");
  const count = document.querySelector("#profileCount");
  if (!Array.isArray(profiles)) {
    list.className = "profile-list empty";
    list.textContent = state.activeEid ? t("noProfileData") : t("selectEidFirst");
    count.textContent = t("profilesNotLoaded");
    return;
  }
  const activeCount = profiles.filter((profile) => profile.profileState === "enabled").length;
  count.textContent = t("profilesSummary", { count: profiles.length, active: activeCount });
  document.querySelector("#installedProfileCount").textContent = String(profiles.length);
  document.querySelector("#activeProfileCount").textContent = String(activeCount);
  if (!profiles.length) {
    list.className = "profile-list empty";
    list.textContent = t("noProfiles");
    return;
  }
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

function parseSmsStorageText(text) {
  const matches = [...String(text || "").matchAll(/\+CPMS:\s*(?:"[^"]+"\s*,\s*)?(\d+)\s*,\s*(\d+)/gi)];
  const values = matches.map((match) => ({ used: Number(match[1]), total: Number(match[2]) })).filter((item) => item.total > 0 && item.used >= 0 && item.used <= item.total);
  if (!values.length) return null;
  const storage = values[values.length - 1];
  return { ...storage, full: storage.used >= storage.total, percent: Math.round((storage.used / storage.total) * 100) };
}

function renderSmsStorage(storage) {
  const banner = document.querySelector("#smsStorageWarning");
  if (!banner) return;
  if (!storage?.total) {
    banner.hidden = true;
    banner.textContent = "";
    return;
  }
  banner.hidden = false;
  banner.className = "sms-storage-banner " + (storage.full ? "full" : storage.percent >= 80 ? "warning" : "healthy");
  banner.textContent = storage.full
    ? t("smsStorageFull", storage)
    : storage.percent >= 80
      ? t("smsStorageNearFull", storage)
      : t("smsStorageUsage", storage);
}

async function deleteSmsMessage(index) {
  if (!state.smsDeleteEnabled) {
    append(t("smsInbox"), t("smsDeleteLocked"));
    return;
  }
  if (!window.confirm(t("confirmDeleteSms", { index }))) return;
  const port = encodeURIComponent(portInput.value.trim());
  try {
    const res = await fetch("/api/sms-delete?port=" + port, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ index, confirm: "DELETE" }),
    });
    const data = await res.json();
    append(t("deleteSms"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (!res.ok) throw new Error(data.error || t("smsDeleteLocked"));
    append(t("smsInbox"), t("smsDeleted"));
    await callApi("sms-list");
  } catch (error) {
    append(t("deleteSms"), error.message || String(error));
  }
}

function renderSms(text, data = {}) {
  state.smsText = text;
  const list = document.querySelector("#smsList");
  const count = document.querySelector("#smsCount");
  renderSmsStorage(data.storage || parseSmsStorageText(text));
  const matches = [...text.matchAll(/\+CMGL:\s*([^\r\n]+)\r?\n([\s\S]*?)(?=\r?\n\+CMGL:|\r?\nOK|$)/g)];
  count.textContent = String(matches.length);
  if (!matches.length) { list.className = "sms-list empty"; list.textContent = text.includes("+CPMS:") ? t("smsEmpty") : t("noSmsData"); return; }
  list.className = "sms-list";
  list.innerHTML = matches.map((match) => {
    const [index, rawStatus, sender, , receivedAt] = parseAtCsv(match[1]);
    const status = smsStatus(rawStatus || "READ");
    const body = decodeSmsBody(match[2]);
    const code = extractVerificationCode(body);
    const avatar = String(sender || "").replace(/\D/g, "").slice(-2) || "SMS";
    return `<article class="sms-card">
      <div class="sms-card-head">
        <div class="sms-contact-wrap"><span class="sms-contact-avatar">${escapeHtml(avatar)}</span><div class="sms-contact"><span>${escapeHtml(t("smsFrom"))}</span><strong>${escapeHtml(sender || t("unknown"))}</strong></div></div>
        <span class="sms-status ${status.className}">${escapeHtml(status.label)}</span>
      </div>
      ${receivedAt ? `<time>${escapeHtml(receivedAt)}</time>` : ""}
      <p class="sms-body">${escapeHtml(body)}</p>
      ${code ? `<div class="sms-code"><span>${escapeHtml(t("otpCode"))}</span><strong>${escapeHtml(code)}</strong><button class="secondary compact" data-copy-code="${escapeHtml(code)}">${escapeHtml(t("copyCode"))}</button></div>` : ""}
      <div class="sms-card-foot"><span>${escapeHtml(t("smsMessageNumber", { value: index || "-" }))}</span><button class="secondary compact danger-text" data-sms-delete="${escapeHtml(index || "")}"${state.smsDeleteEnabled ? "" : " disabled"}>${escapeHtml(t("deleteSms"))}</button></div>
    </article>`;
  }).join("");
  for (const button of list.querySelectorAll("button[data-copy-code]")) button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(button.dataset.copyCode);
    button.textContent = t("copied");
  });
  for (const button of list.querySelectorAll("button[data-sms-delete]")) {
    button.addEventListener("click", () => deleteSmsMessage(Number(button.dataset.smsDelete)));
  }
}

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
  const usbConfigured = Boolean(pnp.adbInterfacePresent || pnp.audioInputPresent || pnp.audioOutputPresent);
  const usbReady = Boolean(pnp.adbWinUsb && pnp.standardUsbAudio);
  const prepared = Boolean(runtime.prepared && runtime.adb?.root && runtime.adb?.kernelCompatible);

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
  if (enableButton) enableButton.disabled = state.voiceSetupBusy || !state.voiceRuntimeEnabled || !downloaded || (pnp.adbInterfacePresent && pnp.standardUsbAudio);
  if (prepareButton) prepareButton.disabled = state.voiceSetupBusy || !state.voiceRuntimeEnabled || !downloaded || !pnp.adbWinUsb || !pnp.standardUsbAudio || prepared;
  if (restoreButton) restoreButton.disabled = state.voiceSetupBusy || !state.voiceRuntimeEnabled;

  const supported = state.callCapabilityData ? Boolean(state.callCapabilityData.voiceSetupSupported) : true;
  const message = document.querySelector("#voiceSetupMessage");
  if (message) {
    message.textContent = !supported
      ? t("voiceSetupUnsupported")
      : prepared && usbReady
        ? t(localAudioBridgeHost ? "voiceSetupReady" : "voiceSetupLocalOnly")
        : t("voiceSetupWaiting");
  }
  syncCallButtons();
}

async function refreshVoiceSetup() {
  if (state.voiceSetupBusy) return;
  state.voiceSetupBusy = true;
  if (state.voiceRuntimeStatus) renderVoiceSetup(state.voiceRuntimeStatus);
  try {
    const port = encodeURIComponent(portInput.value.trim());
    const capabilities = await fetchJson("/api/call-capabilities?port=" + port, 60000);
    renderCallCapabilities(capabilities);
    const status = await fetchJson("/api/voice-runtime-status", 45000);
    renderVoiceSetup({ ...status, voiceSetupSupported: capabilities.voiceSetupSupported });
  } catch (error) {
    append(t("voiceSetupTitle"), error.message || String(error));
  } finally {
    state.voiceSetupBusy = false;
    if (state.voiceRuntimeStatus) renderVoiceSetup(state.voiceRuntimeStatus);
  }
}

async function runVoiceSetupAction(pathname, confirmation, promptKey, timeoutMs = 360000) {
  if (!state.voiceRuntimeEnabled) {
    append(t("voiceSetupTitle"), t("voiceActionFailed"));
    return;
  }
  if (!window.confirm(t(promptKey))) return;
  state.voiceSetupBusy = true;
  if (state.voiceRuntimeStatus) renderVoiceSetup(state.voiceRuntimeStatus);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const port = encodeURIComponent(portInput.value.trim());
    const response = await fetch(pathname + "?port=" + port, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ confirm: confirmation }),
      signal: controller.signal,
    });
    const data = await response.json();
    append(t("voiceSetupTitle"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (!response.ok) throw new Error(data.error || t("voiceActionFailed"));
    const message = document.querySelector("#voiceSetupMessage");
    if (message) message.textContent = data.message || t("voiceActionDone");
    if (data.rebootRequested) {
      setTimeout(() => refreshVoiceSetup(), 15000);
    } else {
      state.voiceSetupBusy = false;
      await refreshVoiceSetup();
    }
  } catch (error) {
    append(t("voiceSetupTitle"), error.name === "AbortError" ? t("timedOut") : (error.message || String(error)));
  } finally {
    clearTimeout(timer);
    state.voiceSetupBusy = false;
    if (state.voiceRuntimeStatus) renderVoiceSetup(state.voiceRuntimeStatus);
  }
}

const moduleAudioPattern = /(quectel|qdc507|baiwang|ac interface|as interface)/i;
const localAudioBridgeHost = ["127.0.0.1", "localhost", "::1"].includes(location.hostname);

function isModuleAudioDevice(device) {
  return moduleAudioPattern.test(String(device?.label || ""));
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
  const bridge = state.audioBridge;
  stopStream(bridge?.moduleDownlink);
  stopStream(bridge?.microphoneStream);
  stopAudioElement(bridge?.downlinkAudio);
  stopAudioElement(bridge?.uplinkAudio);
  state.audioBridge = null;
  state.audioBridgeStarting = false;
  if (notifyServer && bridge?.moduleRouteStarted) stopModuleVoiceRoute();
  const label = document.querySelector("#audioBridgeState");
  if (label) label.textContent = t(messageKey);
  syncCallButtons();
}

async function startAudioBridge() {
  const call = state.callStatusData?.voiceCalls?.[0] || null;
  if (!call || !["active", "held"].includes(call.state)) {
    append(t("audioBridge"), t("audioNeedsCall"));
    return;
  }
  if (!localAudioBridgeHost || !navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
    append(t("audioBridge"), t("audioBridgeUnavailable"));
    return;
  }
  if (!state.callCapabilityData?.standardUsbAudio || !state.voiceRuntimeStatus?.runtime?.local?.downloaded) {
    append(t("audioBridge"), t("audioEndpointMissing"));
    return;
  }

  state.audioBridgeStarting = true;
  syncCallButtons();
  let moduleRouteStarted = false;
  let permissionStream = null;
  let moduleDownlink = null;
  let microphoneStream = null;
  let downlinkAudio = null;
  let uplinkAudio = null;

  try {
    const port = encodeURIComponent(portInput.value.trim());
    const routeResponse = await fetch("/api/voice-route-start?port=" + port, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ confirm: "AUDIO" }),
    });
    const routeData = await routeResponse.json();
    if (!routeResponse.ok) throw new Error(routeData.error || t("audioRouteFailed"));
    moduleRouteStarted = true;

    permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    stopStream(permissionStream);
    permissionStream = null;

    const moduleInput = devices.find((device) => device.kind === "audioinput" && isModuleAudioDevice(device));
    const moduleOutput = devices.find((device) => device.kind === "audiooutput" && isModuleAudioDevice(device));
    const systemInputs = devices.filter((device) => device.kind === "audioinput" && !isModuleAudioDevice(device));
    const systemOutputs = devices.filter((device) => device.kind === "audiooutput" && !isModuleAudioDevice(device));
    const systemInput = systemInputs.find((device) => device.deviceId === "default") || systemInputs[0];
    const systemOutput = systemOutputs.find((device) => device.deviceId === "default") || systemOutputs[0];

    if (!moduleInput || !moduleOutput || !systemInput) throw new Error(t("audioEndpointMissing"));

    moduleDownlink = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: moduleInput.deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: systemInput.deviceId },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

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

    state.audioBridge = { moduleDownlink, microphoneStream, downlinkAudio, uplinkAudio, moduleRouteStarted };
    document.querySelector("#audioBridgeState").textContent = t("audioBridgeActive");
  } catch (error) {
    stopStream(permissionStream);
    stopStream(moduleDownlink);
    stopStream(microphoneStream);
    stopAudioElement(downlinkAudio);
    stopAudioElement(uplinkAudio);
    if (moduleRouteStarted) await stopModuleVoiceRoute();
    document.querySelector("#audioBridgeState").textContent = t("audioBridgeUnavailable");
    append(t("audioBridge"), t("audioPermissionFailed") + " " + (error.message || ""));
  } finally {
    state.audioBridgeStarting = false;
    syncCallButtons();
  }
}

function syncCallButtons() {
  const call = state.callStatusData?.voiceCalls?.[0] || null;
  const locked = !state.callActionsEnabled || state.callActionInFlight;
  const incoming = call && ["incoming", "waiting"].includes(call.state);
  const connected = call && ["active", "held"].includes(call.state);
  const answer = document.querySelector("#answerCallBtn");
  const hangup = document.querySelector("#hangupCallBtn");
  const dial = document.querySelector("#dialCallBtn");
  const dtmf = document.querySelector("#sendDtmfBtn");
  const callerId = document.querySelector("#enableCallerIdBtn");
  const startAudio = document.querySelector("#startAudioBridgeBtn");
  const stopAudio = document.querySelector("#stopAudioBridgeBtn");
  const refreshSetup = document.querySelector("#refreshVoiceSetupBtn");
  const audioReady = Boolean(
    localAudioBridgeHost &&
    state.callCapabilityData?.standardUsbAudio === true &&
    state.voiceRuntimeStatus?.runtime?.local?.downloaded === true,
  );
  if (answer) answer.disabled = locked || !incoming;
  if (hangup) hangup.disabled = locked || !call;
  if (dial) dial.disabled = locked || Boolean(call);
  if (dtmf) dtmf.disabled = locked || !connected;
  if (callerId) callerId.disabled = locked || state.callStatusData?.callerIdEnabled === true;
  if (startAudio) startAudio.disabled = state.audioBridgeStarting || Boolean(state.audioBridge) || !connected || !audioReady;
  if (stopAudio) stopAudio.disabled = !state.audioBridge && !state.callStatusData?.voiceRouteActive;
  if (refreshSetup) refreshSetup.disabled = state.voiceSetupBusy;
}

function renderCallStatus(data) {
  state.callStatusData = data;
  const call = Array.isArray(data?.voiceCalls) ? data.voiceCalls[0] || null : null;
  const endedCall = !call && Boolean(state.lastVoiceCall);
  if (call) {
    rememberCall(call);
    state.lastVoiceCall = { ...call };
  } else if (state.lastVoiceCall) {
    rememberCall({ ...state.lastVoiceCall, state: "disconnected", stateCode: 6 });
    state.lastVoiceCall = null;
  }
  if (!call && state.audioBridge) stopAudioBridge();
  if (call) setCallFeedback(callStateText(call), ["active", "incoming", "waiting"].includes(call.state) ? "success" : "working");
  else if (endedCall) setCallFeedback(t("hangupAccepted"), "neutral");

  const stage = document.querySelector("#callStatus");
  stage.dataset.state = call?.state || "idle";
  document.querySelector("#callStateLabel").textContent = call ? callStateText(call) : t("callIdle");
  document.querySelector("#callDirectionLabel").textContent = call ? (call.direction === "incoming" ? t("incomingCall") : t("outgoingCall")) : t("noActiveCall");
  document.querySelector("#callNumber").textContent = call?.number || (call ? t("numberUnavailable") : "--");
  document.querySelector("#callMeta").textContent = call ? `${t("callId", { id: call.id })} · ${callStateText(call)}` : t("waitingForCall");
  document.querySelector("#callerIdState").textContent = data?.callerIdEnabled === true ? t("callerIdOn") : data?.callerIdEnabled === false ? t("callerIdOff") : t("notChecked");
  if (call?.state === "incoming" || call?.state === "waiting") {
    statusPill.textContent = t("callIncoming");
    statusPill.classList.add("incoming");
  } else {
    statusPill.classList.remove("incoming");
    if (!state.busy) statusPill.textContent = t("idle");
  }
  syncCallButtons();
}

function renderCallCapabilities(data) {
  state.callCapabilityData = data;
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
  if (state.callRefreshInFlight || document.hidden || (!force && (!state.callMonitoring || state.busy))) return;
  state.callRefreshInFlight = true;
  try {
    const { data } = await requestAction("call-status");
    renderCallStatus(data);
  } catch (error) {
    if (force) append(t("callStatus"), error.message);
  } finally {
    state.callRefreshInFlight = false;
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
  if (!state.callActionsEnabled) {
    setCallFeedback(t("callControlsLocked"), "error");
    append(t("calls"), t("callControlsLocked"));
    return;
  }

  const body = { action };
  let label = t("calls");
  let successKey = "dialAccepted";
  if (action === "dial") {
    body.number = document.querySelector("#callNumberInput").value.trim();
    if (!/^\+?[0-9]{3,20}$/.test(body.number)) {
      setCallFeedback(t("invalidCallNumber"), "error");
      return;
    }
    body.confirm = "DIAL";
    label = t("dialCall");
  } else if (action === "answer") {
    body.confirm = "ANSWER";
    label = t("answerCall");
    successKey = "answerAccepted";
  } else if (action === "hangup") {
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
  setCallFeedback(t("callSending"), "working");
  setBusy(true, "running");
  try {
    const port = encodeURIComponent(portInput.value.trim());
    const res = await fetch(`/api/call-action?port=${port}`, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const raw = textFromResult(data) || JSON.stringify(data, null, 2);
    append(label, raw);
    if (res.ok) {
      setCallFeedback(t(successKey), "success");
      if (action === "dtmf") document.querySelector("#dtmfInput").value = "";
      await new Promise((resolve) => setTimeout(resolve, 500));
      await refreshCallStatusQuietly(true);
    } else {
      setCallFeedback(res.status === 502 || /(^|\r?\n)(ERROR|NO CARRIER)(\r?\n|$)/i.test(raw) ? t("callRejected") : (data.error || t("callRequestFailed")), "error");
    }
  } catch (error) {
    setCallFeedback(t("callRequestFailed"), "error");
    append(label, error.stack || error.message);
  } finally {
    state.callActionInFlight = false;
    setBusy(false);
  }
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
  const port = encodeURIComponent(portInput.value.trim());
  const aid = encodeURIComponent(state.activeAid || "");
  const paths = { health: "/api/health", ports: "/api/ports", "device-check": "/api/device-check", "find-at": "/api/find-at", "module-status": `/api/module-status?port=${port}`, baseline: `/api/baseline?port=${port}`, "sms-list": `/api/sms-list?port=${port}`, "call-status": `/api/call-status?port=${port}`, "call-capabilities": `/api/call-capabilities?port=${port}`, "euicc-inventory": `/api/euicc-inventory?port=${port}`, "lpac-chip": `/api/lpac-chip?port=${port}&aid=${aid}`, "lpac-discovery": `/api/lpac-discovery?port=${port}&aid=${aid}`, "lpac-profiles": `/api/lpac-profiles?port=${port}&aid=${aid}`, "lpac-notifications": `/api/lpac-notifications?port=${port}&aid=${aid}`, "windows-network": "/api/windows-network", "network-traffic": "/api/network-traffic", "stock-module-probe": "/api/stock-module-probe" };
  const data = await fetchJson(paths[action]); return { data, text: textFromResult(data) || JSON.stringify(data, null, 2) };
}

function applyHealth(data) {
  state.authRequired = Boolean(data.authRequired); state.dangerousAtEnabled = Boolean(data.dangerousAtEnabled); state.profileActionsEnabled = Boolean(data.profileActionsEnabled); state.profileDownloadEnabled = Boolean(data.profileDownloadEnabled); state.profileNicknameEnabled = Boolean(data.profileNicknameEnabled); state.profileNotificationsEnabled = Boolean(data.profileNotificationsEnabled); state.profileDeleteEnabled = Boolean(data.profileDeleteEnabled); state.smsSendEnabled = Boolean(data.smsSendEnabled); state.smsDeleteEnabled = Boolean(data.smsDeleteEnabled); state.callActionsEnabled = Boolean(data.callActionsEnabled); state.ussdEnabled = Boolean(data.ussdEnabled); state.usbModeEnabled = Boolean(data.usbModeEnabled); state.stockBootstrapEnabled = Boolean(data.stockBootstrapEnabled); state.driverInstallEnabled = Boolean(data.driverInstallEnabled); state.voiceRuntimeEnabled = Boolean(data.voiceRuntimeEnabled); state.primaryUrl = data.primaryUrl || "";
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
    const { data, text } = await requestAction(action); append(actionTitle(action), text); updateSummary(text); if (action === "health") applyHealth(data); if (action === "euicc-inventory") renderEuiccInventory(data); if (action === "lpac-chip") renderChip(text); if (action === "lpac-discovery") renderDiscovery(text); if (action === "lpac-profiles") renderProfiles(text); if (action === "lpac-notifications") renderNotifications(text); if (action === "sms-list") renderSms(text, data); if (action === "call-status") renderCallStatus(data); if (action === "call-capabilities") renderCallCapabilities(data); if (action === "network-traffic") renderTraffic(data.stdout || ""); }
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
  const actions = ["health", "device-check", "find-at", "module-status", "network-traffic", "euicc-inventory", "sms-list"];
  setBusy(true, "starting");
  try {
    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index]; setBusy(true, "scanProgress", { current: index + 1, total: actions.length });
      try { const { data, text } = await requestAction(action); append(actionTitle(action), text); updateSummary(text); if (action === "health") applyHealth(data); if (action === "euicc-inventory") renderEuiccInventory(data); if (action === "lpac-chip") renderChip(text); if (action === "lpac-discovery") renderDiscovery(text); if (action === "lpac-profiles") renderProfiles(text); if (action === "lpac-notifications") renderNotifications(text); if (action === "sms-list") renderSms(text, data); if (action === "call-status") renderCallStatus(data); if (action === "call-capabilities") renderCallCapabilities(data); if (action === "network-traffic") renderTraffic(data.stdout || ""); }
      catch (error) { append(actionTitle(action), error.name === "AbortError" ? t("scanTimedOut") : error.stack || error.message); }
    }
  } finally { setBusy(false); }
}

async function quickStart() {
  for (const action of ["health", "find-at", "module-status", "network-traffic"]) {
    await callApi(action);
  }
}

async function sendAt() {
  const port = encodeURIComponent(portInput.value.trim()); const command = document.querySelector("#atInput").value.trim(); if (!command) return;
  setBusy(true, "at");
  try { const res = await fetch(`/api/at?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ command }) }); const data = await res.json(); const text = textFromResult(data) || JSON.stringify(data, null, 2); append(`AT ${command}`, text); updateSummary(text); }
  catch (error) { append(`AT ${command}`, error.name === "AbortError" ? t("atTimedOut") : error.stack || error.message); }
  finally { setBusy(false); }
}

async function runProfileAction(action, id) {
  const label = action === "enable" ? t("switchProfile") : t("disable");
  if (!state.activeAid) { append(label, t("selectEidFirst")); return; }
  if (!state.profileActionsEnabled) { append(label, t("locked")); return; }
  if (!window.confirm(t("confirmProfile", { action: label.toLowerCase() }))) return;
  setBusy(true, action);
  try { const found = await requestAction("find-at"); append(actionTitle("find-at"), found.text); updateSummary(found.text); const port = encodeURIComponent(portInput.value.trim()); const res = await fetch(`/api/lpac-profile-action?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ action, id, aid: state.activeAid, confirm: action.toUpperCase() }) }); const data = await res.json(); append(label, textFromResult(data) || JSON.stringify(data, null, 2)); if (res.ok) await callApi("lpac-profiles"); }
  catch (error) { append(label, error.stack || error.message); }
  finally { setBusy(false); }
}

async function deleteProfile(id) {
  if (!state.activeAid) { append(t("deleteProfile"), t("selectEidFirst")); return; }
  if (!state.profileDeleteEnabled) { append(t("deleteProfile"), t("locked")); return; }
  if (!window.confirm(t("deleteIrreversible"))) return;
  if (window.prompt(t("confirmDeleteProfile")) !== "DELETE") return;
  setBusy(true, "deleteProfile");
  try {
    const port = encodeURIComponent(portInput.value.trim());
    const res = await fetch(`/api/lpac-profile-action?port=${port}`, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ action: "delete", id, aid: state.activeAid, confirm: "DELETE" }),
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
  if (!state.activeAid) { append(t("profileDownload"), t("selectEidFirst")); return; }
  if (!state.profileDownloadEnabled) { append(t("profileDownload"), t("profileDownloadLocked")); return; }
  if (!activationCode.startsWith("LPA:1$") || activationCode.split("$").length < 3) { append(t("profileDownload"), t("invalidActivationCode")); return; }
  const target = activeEuicc();
  const targetLabel = target ? euiccDisplayLabel(target, state.euiccInventory.indexOf(target)) : shortEid(state.activeEid);
  if (!window.confirm(`${t("confirmDownload")}\n${t("targetEid", { label: targetLabel })}`)) return;
  setBusy(true, "profileDownload");
  try {
    const port = encodeURIComponent(portInput.value.trim());
    const res = await fetch(`/api/lpac-profile-download?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ activationCode, aid: state.activeAid, confirm: "DOWNLOAD" }) });
    const data = await res.json();
    append(t("profileDownload"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (res.ok) { document.querySelector("#activationCodeInput").value = ""; await callApi("lpac-profiles"); }
  } catch (error) { append(t("profileDownload"), error.stack || error.message); }
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
    if (!res.ok) throw new Error(data.error || "The private AID could not be verified.");
    input.value = "";
    append(t("privateAid"), t("aidAdded"));
    await callApi("euicc-inventory");
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
  if (!window.confirm(t("confirmNickname"))) return;
  setBusy(true, "profileNickname");
  try {
    const port = encodeURIComponent(portInput.value.trim());
    const res = await fetch(`/api/lpac-profile-nickname?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ id, nickname, aid: state.activeAid, confirm: "RENAME" }) });
    const data = await res.json();
    append(t("profileNickname"), textFromResult(data) || JSON.stringify(data, null, 2));
    if (res.ok) await callApi("lpac-profiles");
  } catch (error) { append(t("profileNickname"), error.stack || error.message); }
  finally { setBusy(false); }
}

async function processNotifications() {
  if (!state.activeAid) { append(t("profileNotifications"), t("selectEidFirst")); return; }
  if (!state.profileNotificationsEnabled) { append(t("profileNotifications"), t("profileNotificationsLocked")); return; }
  if (!window.confirm(t("confirmNotifications"))) return;
  setBusy(true, "profileNotifications");
  try {
    const port = encodeURIComponent(portInput.value.trim());
    const res = await fetch(`/api/lpac-notifications-process?port=${port}`, { method: "POST", headers: apiHeaders({ "content-type": "application/json" }), body: JSON.stringify({ aid: state.activeAid, confirm: "PROCESS" }) });
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
    const port = encodeURIComponent(portInput.value.trim());
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
  if (state.busy || document.hidden || !document.querySelector('.nav-btn[data-target="network"]')?.classList.contains("active")) return;
  try {
    const { data } = await requestAction("network-traffic");
    renderTraffic(data.stdout || "");
  } catch {}
}
async function openPairingDialog() {
  pairingDeepLink = "";
  pairingQr.hidden = true;
  pairingQr.removeAttribute("src");
  pairingQrPlaceholder.hidden = false;
  pairingUrl.textContent = "--";
  pairingStatus.textContent = t("pairingLoading");
  copyPairingBtn.disabled = true;
  if (!pairingDialog.open) pairingDialog.showModal();
  pairIosBtn.disabled = true;
  try {
    const response = await fetch("/api/pairing", { headers: apiHeaders() });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Pairing request failed.");
    pairingDeepLink = data.deepLink;
    pairingQr.src = data.qrDataUrl;
    pairingQr.hidden = false;
    pairingQrPlaceholder.hidden = true;
    pairingUrl.textContent = data.url;
    pairingStatus.textContent = t("pairingReady");
    copyPairingBtn.disabled = false;
  } catch (error) {
    pairingStatus.textContent = t("pairingFailed", { error: error.message });
    append(t("pairIos"), error.message);
  } finally {
    pairIosBtn.disabled = state.busy;
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
  state.smsPolling = !state.smsPolling;
  const button = document.querySelector("#smsPollingBtn");
  button.textContent = state.smsPolling ? t("stopPolling") : t("startPolling");
  if (state.smsPolling) callApi("sms-list");
}

setInterval(() => { if (state.smsPolling && !state.busy) callApi("sms-list"); }, 20000);
setInterval(refreshTrafficQuietly, 2000);
setInterval(refreshCallStatusQuietly, 3500);

const launchToken = launchParameters.get("token") || "";
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
  if (target === "calls" && !state.callMonitoring) toggleCallMonitoring(true);
  if (target === "calls" && !state.callCapabilityData) refreshVoiceSetup();
  if (!state.autoLoadedViews.has(target)) {
    state.autoLoadedViews.add(target);
    if (target === "sms") callApi("sms-list");
    if (target === "network") callApi("network-traffic");
    if (target === "esim") callApi("euicc-inventory");
  }
}

function resetViewScroll() {
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

for (const button of document.querySelectorAll(".nav-btn")) button.addEventListener("click", () => selectView(button.dataset.target, true));
window.addEventListener("hashchange", () => { selectView(location.hash.slice(1)); resetViewScroll(); });
window.addEventListener("beforeunload", () => { stopAudioBridge("audioNotConnected", false); stopModuleVoiceRoute(true); });
selectView(location.hash.slice(1) || "overview");
if (location.hash) window.addEventListener("load", resetViewScroll, { once: true });
for (const button of document.querySelectorAll(".preset")) button.addEventListener("click", () => { document.querySelector("#atInput").value = button.dataset.command; sendAt(); });
document.querySelector("#autoScanBtn").addEventListener("click", autoScan);
pairIosBtn.addEventListener("click", openPairingDialog);
copyPairingBtn.addEventListener("click", copyPairingLink);
pairingDialog.addEventListener("close", () => {
  pairingDeepLink = "";
  pairingQr.removeAttribute("src");
  pairingUrl.textContent = "--";
});
document.querySelector("#rescueScanBtn").addEventListener("click", rescueScan);
document.querySelector("#sendAtBtn").addEventListener("click", sendAt);
document.querySelector("#downloadProfileBtn").addEventListener("click", downloadProfile);
document.querySelector("#addEuiccAidBtn").addEventListener("click", addEuiccAid);
document.querySelector("#processNotificationsBtn").addEventListener("click", processNotifications);
document.querySelector("#sendSmsBtn").addEventListener("click", sendSmsMessage);
document.querySelector("#callMonitorBtn")?.addEventListener("click", () => toggleCallMonitoring());
document.querySelector("#dialCallBtn").addEventListener("click", () => runCallAction("dial"));
document.querySelector("#answerCallBtn").addEventListener("click", () => runCallAction("answer"));
document.querySelector("#hangupCallBtn").addEventListener("click", () => runCallAction("hangup"));
document.querySelector("#sendDtmfBtn").addEventListener("click", () => runCallAction("dtmf"));
document.querySelector("#enableCallerIdBtn")?.addEventListener("click", () => runCallAction("caller-id"));
document.querySelector("#startAudioBridgeBtn").addEventListener("click", startAudioBridge);
document.querySelector("#stopAudioBridgeBtn").addEventListener("click", () => stopAudioBridge());
document.querySelector("#refreshVoiceSetupBtn").addEventListener("click", refreshVoiceSetup);
document.querySelector("#downloadVoiceRuntimeBtn").addEventListener("click", () => runVoiceSetupAction("/api/voice-runtime-download", "DOWNLOADVOICE", "confirmVoiceDownload"));
document.querySelector("#enableVoiceUsbBtn").addEventListener("click", () => runVoiceSetupAction("/api/voice-usb-enable", "VOICEUSB", "confirmVoiceUsb"));
document.querySelector("#prepareVoiceRuntimeBtn").addEventListener("click", () => runVoiceSetupAction("/api/voice-runtime-prepare", "PREPAREVOICE", "confirmVoicePrepare"));
document.querySelector("#restoreVoiceUsbBtn").addEventListener("click", () => runVoiceSetupAction("/api/voice-usb-restore", "RESTOREVOICE", "confirmVoiceRestore"));
for (const button of document.querySelectorAll("[data-dial-key]")) button.addEventListener("click", () => {
  const activeCall = state.callStatusData?.voiceCalls?.[0];
  const target = activeCall ? document.querySelector("#dtmfInput") : document.querySelector("#callNumberInput");
  target.value += button.dataset.dialKey;
});
document.querySelector("#dialBackspaceBtn").addEventListener("click", () => {
  const activeCall = state.callStatusData?.voiceCalls?.[0];
  const target = activeCall ? document.querySelector("#dtmfInput") : document.querySelector("#callNumberInput");
  target.value = target.value.slice(0, -1);
});
document.querySelector("#sendUssdBtn").addEventListener("click", sendUssdRequest);
document.querySelector("#installEcmDriverBtn").addEventListener("click", installEcmDriver);
for (const button of document.querySelectorAll("button[data-usb-mode]")) button.addEventListener("click", () => switchUsbMode(Number(button.dataset.usbMode)));
document.querySelector("#smsPollingBtn").addEventListener("click", toggleSmsPolling);
document.querySelector("#stockConvertBtn").addEventListener("click", () => runStockSetup("/api/stock-module-convert", t("confirmStockConvert"), t("stockConvert")));
document.querySelector("#stockUsbnetBtn").addEventListener("click", () => runStockSetup("/api/stock-module-usbnet", t("confirmStockUsbnet"), t("stockUsbnet")));
document.querySelector("#atInput").addEventListener("keydown", (event) => { if (event.key === "Enter") sendAt(); });
document.querySelector("#clearBtn").addEventListener("click", () => { output.textContent = ""; });

applyLanguage();
quickStart();
