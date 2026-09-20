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

test("ignores Bluetooth COM ports during modem discovery", () => {
  const finder = read("scripts/windows/find-at-port.ps1");
  const diagnostics = read("scripts/windows/read-only-device-check.ps1");
  for (const source of [finder, diagnostics]) {
    assert.match(source, /BTHENUM\|Bluetooth/);
    assert.match(source, /Win32_SerialPort/);
  }
  assert.match(finder, /Skipping Bluetooth serial port/);
  assert.match(diagnostics, /none are USB modem interfaces/);
});


test("includes a bilingual responsive iOS pairing surface", () => {
  const html = read("web/public/index.html");
  const app = read("web/public/app.js");
  const css = read("web/public/styles.css");
  assert.match(html, /id="pairIosBtn"/);
  assert.match(html, /id="pairingDialog"/);
  assert.match(html, /id="pairingQr"/);
  assert.match(app, /fetch\("\/api\/pairing"/);
  assert.match(app, /连接 iPhone \/ iPad/);
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
});
