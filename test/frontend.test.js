const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (relative) => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

test("uses the native mobile layout for Android and iOS only", () => {
  const bootstrap = read("web/public/app.js").split('const output =')[0];
  for (const platform of ["android", "ios", "unknown", ""]) {
    const classes = [];
    vm.runInNewContext(bootstrap, {
      URLSearchParams,
      location: { search: "?native=" + platform },
      document: { documentElement: { classList: { add: (...values) => classes.push(...values) } } },
    });
    assert.deepEqual(classes, ["android", "ios"].includes(platform)
      ? ["native-companion", "native-" + platform] : []);
  }
  assert.match(read("web/public/styles.css"), /html\.native-companion \.topbar/);
});

test("keeps iOS connection help off the main pairing surface", () => {
  const source = read("ios/DJI4GAssistant/Views/PairingView.swift");
  assert.match(source, /sheet\(isPresented: \$showingHelp\)/);
  assert.doesNotMatch(source, /discoverySection\s+stepsSection\s+manualSection/);
  assert.match(source, /if discovery.state == \.failed/);
  for (const language of ["en", "zh-Hans"]) {
    assert.match(read("ios/DJI4GAssistant/Resources/" + language + ".lproj/Localizable.strings"), /"pairing.help" =/);
  }
});

test("keeps mobile pairing compact and buttons free of legacy shadows", () => {
  const android = read("android/app/src/main/java/com/northfish0311/dji4gremote/MainActivity.java");
  const ios = read("ios/DJI4GAssistant/Views/PairingView.swift");
  assert.match(android, /setStateListAnimator\(null\)/);
  assert.match(android, /setElevation\(0\)/);
  assert.match(android, /RippleDrawable/);
  assert.doesNotMatch(android, /ic_menu_edit/);
  const header = ios.split("private var brandHeader:")[1].split("private var primaryPairingSection:")[0];
  assert.doesNotMatch(header, /Text\("app.title"\)/);
  assert.match(header, /Text\("pairing.ready_title"\)/);
  assert.match(ios, /ViewThatFits\(in: \.horizontal\)/);
  assert.doesNotMatch(ios, /\.frame\(height: (44|50)\)/);
});

test("Android recovery keeps controls synchronized and detaches the console before disposal", () => {
  const source = read("android/app/src/main/java/com/northfish0311/dji4gremote/MainActivity.java");
  const vault = read("android/app/src/main/java/com/northfish0311/dji4gremote/PairingVault.java");
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  const uiCheck = read("android/scripts/check_pairing_ui.py");
  const workflow = read(".github/workflows/android.yml");
  assert.match(source, /if \(message != null\).*setManualExpanded\(true\)/);
  assert.match(source, /new View\[\]\{connect, scan, paste, address, password\}/);
  assert.match(source, /setConnecting\(false\)/);
  const expansion = source.split("private void setManualExpanded(boolean open)")[1].split("private void setConnecting")[0];
  assert.match(expansion, /manual\.setVisibility/);
  assert.match(expansion, /manualToggle\.setText/);
  assert.match(expansion, /setStateDescription/);
  const disposal = source.split("private void destroyConsole()")[1];
  assert.ok(disposal.indexOf("removeView(web)") < disposal.indexOf("web.destroy()"));
  assert.doesNotMatch(source, /密码失效时请断开/);
  assert.match(source, /registerDefaultNetworkCallback/);
  assert.match(source, /网络已恢复，正在重新连接/);
  assert.match(source, /payload\.optString\("name"/);
  assert.match(vault, /put\("name", name\)/);
  assert.match(manifest, /android\.permission\.ACCESS_NETWORK_STATE/);
  assert.match(uiCheck, /\/data\/local\/tmp\/dji4g-pairing-ui\.xml/);
  assert.doesNotMatch(uiCheck, /\/sdcard\/pairing-ui\.xml/);
  assert.ok(workflow.indexOf("hide_error_dialogs 1") < workflow.indexOf("adb install"));
});

test("native clients remove stale browser tokens without persisting fresh credentials", () => {
  const source = read("web/public/app.js");
  const bootstrap = source.split("const output =")[0];
  const start = source.indexOf('const launchToken =');
  const end = source.indexOf('languageBtn.addEventListener', start);
  assert.ok(start > 0 && end > start);
  for (const platform of ["android", "ios", ""]) {
    for (const supplied of ["", "fixture-pairing-token"]) {
      const values = new Map([["consoleToken", "old-browser-token"], ["uiLanguage", "zh"]]);
      const handlers = {};
      const input = { value: "", addEventListener: (event, fn) => { handlers[event] = fn; } };
      vm.runInNewContext(bootstrap + source.slice(start, end), {
        URLSearchParams,
        location: { search: "?" + new URLSearchParams({ native: platform, token: supplied }) },
        document: { documentElement: { classList: { add() {} } } },
        tokenInput: input,
        localStorage: {
          getItem: key => values.get(key) ?? null,
          setItem: (key, value) => values.set(key, value),
          removeItem: key => values.delete(key),
        },
      });
      assert.equal(input.value, supplied || (platform ? "" : "old-browser-token"));
      if (platform) assert.equal(values.has("consoleToken"), false);
      input.value = " replacement-token ";
      handlers.change();
      assert.equal(values.get("consoleToken"), platform ? undefined : "replacement-token");
      assert.equal(values.get("uiLanguage"), "zh");
    }
  }
});

test("loads the eSIM inventory using the actual navigation target", () => {
  const html = read("web/public/index.html");
  const app = read("web/public/app.js");
  assert.ok(html.includes('data-target="euicc"'));
  assert.ok(html.includes('id="euicc"'));
  assert.ok(app.includes('if (target === "euicc") callApi("euicc-inventory")'));
  assert.ok(html.includes('id="euiccReadStatus"'));
});

test("allows Start Audio to auto-prepare a downloaded runtime", () => {
  const source = read("web/public/app.js");
  assert.match(source, /standardUsbAudio \|\| !state\.voiceRuntimeStatus\?\.runtime\?\.local\?\.downloaded/);
  assert.match(source, /state\.voiceRuntimeStatus\?\.runtime\?\.local\?\.downloaded === true/);
  assert.doesNotMatch(source, /standardUsbAudio \|\| !state\.voiceRuntimeStatus\?\.runtime\?\.prepared/);
});

test("keeps the SMS workspace single-column below 1000px after desktop refinements", () => {
  const css = read("web/public/styles.css");
  const desktopRule = css.lastIndexOf("grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.72fr)");
  const responsiveGuard = css.lastIndexOf("/* Final responsive guard:");
  assert.ok(desktopRule >= 0);
  assert.ok(responsiveGuard > desktopRule);
  assert.match(css.slice(responsiveGuard), /@media \(max-width: 1000px\)[\s\S]*\.sms-workspace\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});

test("keeps mobile eSIM profiles readable after desktop refinements", () => {
  const css = read("web/public/desktop-refresh.css");
  const desktopRule = css.lastIndexOf("grid-template-columns:minmax(0,1fr) 270px");
  const responsiveGuard = css.lastIndexOf("/* Final mobile guard.");
  assert.ok(desktopRule >= 0);
  assert.ok(responsiveGuard > desktopRule);
  const mobile = css.slice(responsiveGuard);
  assert.match(mobile, /@media \(max-width:879px\)[\s\S]*\.esim-workspace,[\s\S]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(mobile, /\.profile-panel \.profile-list \{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(mobile, /\.profile-card \{width:100%/);
  assert.match(mobile, /\.rail \{[\s\S]*overflow-x:auto/);
});

test("ships one source launcher with the complete guarded console", () => {
  const cmd = read("Start-Web-Console.cmd");
  const ps = read("scripts/windows/start-console.ps1");
  for (const flag of [
    "EnableProfileDelete",
    "EnableSmsDelete",
    "EnableVoiceRuntime",
    "EnableUssd",
    "EnableUsbMode",
    "EnableDriverInstall",
  ]) assert.ok(cmd.includes("-" + flag), flag + " missing from launcher");
  for (const variable of [
    "ALLOW_PROFILE_DELETE",
    "ALLOW_SMS_DELETE",
    "ALLOW_VOICE_RUNTIME",
    "ALLOW_USSD",
    "ALLOW_USB_MODE",
    "ALLOW_DRIVER_INSTALL",
  ]) assert.ok(ps.includes("$env:" + variable + ' = "1"'), variable + " is not enabled");
});

test("never falls back from the standard ADB class descriptor to an interface number", () => {
  const source = read("web/adb-usb.js");
  assert.match(source, /const iface = interfaces\.find\(isAdbInterface\);/);
  assert.doesNotMatch(source, /interfaces\.find\(\(item\) => interfaceNumber\(item\) === 6\)/);
});

test("contains the SMS capacity and three-step voice setup surfaces", () => {
  const html = read("web/public/index.html");
  assert.match(html, /id="smsStorageWarning"/);
  assert.match(html, /id="voiceRuntimeStep"/);
  assert.match(html, /id="voiceUsbStep"/);
  assert.match(html, /id="voicePrepareStep"/);
});

test("shows module temperature without polling during calls or write operations", () => {
  const html = read("web/public/index.html");
  const app = read("web/public/app.js");
  const server = read("web/server.js");
  assert.match(html, /id="temperatureValue"/);
  assert.match(server, /AT\+QTEMP/);
  assert.match(server, /\/api\/module-temperature/);
  assert.match(app, /refreshModuleTemperatureQuietly/);
  assert.match(app, /state\.callActionInFlight/);
  assert.match(app, /state\.callStatusData\?\.voiceCalls\?\.length/);
});

test("verifies a live ICCID and IMSI after enabling an eSIM profile", () => {
  const app = read("web/public/app.js");
  const server = read("web/server.js");
  assert.match(server, /verifyProfileActivation/);
  assert.match(server, /\["AT\+QCCID", "AT\+CIMI"\]/);
  assert.doesNotMatch(server.split("async function verifyProfileActivation")[1].split("function profileNickname")[0], /AT\+CFUN/);
  assert.match(app, /profileSwitchVerified/);
  assert.match(app, /profileSwitchNetworkPending/);
  assert.match(app, /profileSwitchPending/);
});

test("sends post-dial extension keys only after an outgoing call connects", () => {
  const app = read("web/public/app.js");
  assert.match(app, /function parseDialInput/);
  assert.match(app, /call\?\.direction !== "outgoing"/);
  assert.match(app, /!\["active", "held"\]\.includes\(call\.state\)/);
  assert.match(app, /token === ","[\s\S]*setTimeout\(resolve, 2000\)/);
  assert.match(app, /postDialFailed/);
  assert.match(app, /state\.postDialAbortController\?\.abort\(\)/);
});

test("lets Windows users choose call microphone and speaker independently", () => {
  const html = read("web/public/index.html");
  const app = read("web/public/app.js");
  assert.match(html, /id="callMicrophoneSelect"/);
  assert.match(html, /id="callSpeakerSelect"/);
  assert.match(html, /id="refreshAudioDevicesBtn"/);
  assert.match(app, /localStorage\.setItem\("callMicrophoneId"/);
  assert.match(app, /localStorage\.setItem\("callSpeakerId"/);
  assert.match(app, /downlinkAudio\.setSinkId\(systemOutput\.deviceId\)/);
  assert.match(app, /uplinkAudio\.setSinkId\(moduleOutput\.deviceId\)/);
  const bridge = app.split("async function startAudioBridge()")[1].split("function syncCallButtons")[0];
  assert.ok(bridge.indexOf("getUserMedia({ audio: true })") < bridge.indexOf("/api/voice-route-start"));
});

test("ignores Bluetooth COM ports during modem discovery", () => {
  const finder = read("scripts/windows/find-at-port.ps1");
  const diagnostics = read("scripts/windows/read-only-device-check.ps1");
  for (const source of [finder, diagnostics]) {
    assert.match(source, /BTHENUM\|Bluetooth/);
    assert.match(source, /Win32_SerialPort/);
  }
  assert.match(finder, /Skipping Bluetooth serial port/);
  assert.match(finder, /Quectel\|QDC507\|Baiwang/);
  assert.match(finder, /for \(\$pass = 1; \$pass -le 2/);
  assert.match(finder, /foreach \(\$command in @\("AT", "ATI"\)\)/);
  assert.match(finder, /Waiting briefly for newly attached USB serial interfaces/);
  assert.match(diagnostics, /none are USB modem interfaces/);
});


test("includes a bilingual responsive mobile pairing surface", () => {
  const html = read("web/public/index.html");
  const app = read("web/public/app.js");
  const css = read("web/public/styles.css");
  assert.match(html, /id="pairIosBtn"/);
  assert.match(html, /id="pairingDialog"/);
  assert.match(html, /id="pairingQr"/);
  assert.match(app, /fetch\("\/api\/pairing"/);
  assert.match(app, /连接手机 \/ 平板/);
  assert.doesNotMatch(app, /连接 iPhone \/ iPad/);
  assert.match(app, /launchToken && !nativeCompanion/);
  assert.match(app, /nativePlatform === "ios" \|\| nativePlatform === "android"/);
  assert.match(app, /if \(nativeCompanion\) localStorage.removeItem\("consoleToken"\)/);
  assert.match(css, /\.pairing-content[\s\S]*grid-template-columns/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.pairing-content[\s\S]*grid-template-columns: 1fr/);
});


test("ships the native iPhone and iPad companion project", () => {
  const project = read("ios/project.yml");
  const pairing = read("ios/DJI4GAssistant/Models/PairingStore.swift");
  const discovery = read("ios/DJI4GAssistant/Services/BonjourDiscovery.swift");
  const scanner = read("ios/DJI4GAssistant/Views/QRScannerView.swift");
  const consoleView = read("ios/DJI4GAssistant/Views/ConsoleView.swift");
  assert.match(project, /NSBonjourServices:[\s\S]*_dji4g\._tcp/);
  assert.match(project, /NSCameraUsageDescription/);
  assert.match(project, /NSAllowsLocalNetworking: true/);
  assert.match(pairing, /kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
  assert.match(pairing, /host\.isPrivateNetworkHost/);
  assert.match(discovery, /_dji4g\._tcp\./);
  assert.match(scanner, /AVMetadataObject\.ObjectType|metadataOutputTypes|metadataObjectTypes = \[\.qr\]/);
  assert.match(consoleView, /allowedBaseURL/);
  assert.match(consoleView, /native", value: "ios"/);
  assert.match(consoleView, /retryCount\.wrappedValue = 0/);
  assert.match(consoleView, /console\.disconnected/);
});
