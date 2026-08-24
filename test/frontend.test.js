const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relative) => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

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
