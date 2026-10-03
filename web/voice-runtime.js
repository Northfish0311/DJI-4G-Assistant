"use strict";

const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const dns = require("dns").promises;
const path = require("path");
const { Transform } = require("stream");
const { pipeline } = require("stream/promises");
const { withAdb } = require("./adb-usb");

const RUNTIME_COMMIT = "0443dfdaf8aec086fd76ba2ee9152fd908114524";
const RUNTIME_VERSION = "qdc507-3.18.44-voice-20260712.5";
const RUNTIME_KERNEL = "3.18.44";
const RUNTIME_BASE_URL = "https://raw.githubusercontent.com/moluncn/mavo/" + RUNTIME_COMMIT + "/Resources/ModuleVoice/";
const REMOTE_ROOT = "/tmp/dji4g-assistant-voice";
const HELPER = REMOTE_ROOT + "/mavo-pcm-bridge.armv7";
const ROUTE_PID = "/run/dji4g-assistant-route.pid";
const ROUTE_LOG = "/run/dji4g-assistant-route.log";
const CALIBRATION_PID = "/run/dji4g-assistant-alsaucm.pid";
const CALIBRATION_LOG = "/run/dji4g-assistant-alsaucm.log";
const MD5_CRYPT_MAGIC = "$1$";
const MD5_CRYPT_ALPHABET = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const RUNTIME_FILES = [
  { name: "qdc507_aprv3.ko", size: 36664, sha256: "3d82d3dec4f1e323201bba87156df9d41438e08314097353f2607f9117211d4a", mode: 0o100644, deploy: true },
  { name: "qdc507_voice.ko", size: 999236, sha256: "ed3821682d5309969a01c764192c83feff9669c61ef237c69475cd1619cf296c", mode: 0o100644, deploy: true },
  { name: "mavo-pcm-bridge.armv7", size: 17860, sha256: "88d47c15e61d1428a59c821fed804c2e6490e82859a085062f21966b58d167fc", mode: 0o100755, deploy: true },
  { name: "manifest.json", size: 729, sha256: "f4f6c266ced7015d4e61d993a6e31247c26a9e85a8fdf1c6d842c459e1e2970a", mode: 0o100644 },
  { name: "COPYING-GPL-2.0", size: 18693, sha256: "af8067302947c01fd9eee72befa54c7e3ef8a48fecde7fd71277f2290b2bf0f7", mode: 0o100644 },
  { name: "MODULE-REPORT.md", size: 7443, sha256: "fb9d58336bcfdad8938d7833c113a815c2153d9a04564eb73cddabea737f8be2", mode: 0o100644 },
];

function parseUsbComposition(text) {
  const match = String(text || "").match(/\+QCFG:\s*"usbcfg"\s*,\s*((?:0x)?[0-9a-f]+)\s*,\s*((?:0x)?[0-9a-f]+)\s*,\s*([01](?:\s*,\s*[01]){6})/i);
  if (!match) throw new Error("The module did not return a seven-flag USBCFG value.");
  const parseHex = (value) => parseInt(String(value).replace(/^0x/i, ""), 16);
  const flags = match[3].split(",").map((value) => Number(value.trim()));
  const value = { vendorId: parseHex(match[1]), productId: parseHex(match[2]), flags };
  if (!value.vendorId || !value.productId || flags.length !== 7 || flags.some((flag) => flag !== 0 && flag !== 1)) {
    throw new Error("The module USBCFG value is outside the verified QDC507 format.");
  }
  return value;
}

function usbCompositionCommand(value) {
  if (!value || !Array.isArray(value.flags) || value.flags.length !== 7) throw new Error("Invalid USB composition.");
  const hex = (number) => "0x" + Number(number).toString(16).toUpperCase().padStart(4, "0");
  return "AT+QCFG=\"usbcfg\"," + [hex(value.vendorId), hex(value.productId), ...value.flags].join(",");
}

function voiceUsbTarget(value) {
  const current = {
    vendorId: Number(value.vendorId),
    productId: Number(value.productId),
    flags: [...value.flags],
  };
  if (![[0x2ca3, 0x4006], [0x2c7c, 0x0125]].some((id) => id[0] === current.vendorId && id[1] === current.productId)) {
    throw new Error("Voice setup is limited to the verified QDC507 USB identities 2CA3:4006 and 2C7C:0125.");
  }
  if (current.flags.length !== 7 || current.flags.some((flag) => flag !== 0 && flag !== 1)) {
    throw new Error("Voice setup will not rewrite an unknown USBCFG layout.");
  }
  current.flags[5] = 1;
  current.flags[6] = 1;
  return current;
}

function parseQadbChallenge(text) {
  if (/(^|\r?\n)ERROR(\r?\n|$)/i.test(String(text || ""))) throw new Error("This firmware does not expose legacy QADBKEY authorization.");
  const matches = [...String(text || "").matchAll(/^\s*\+QADBKEY:\s*([0-9]{8})\s*$/gim)];
  if (matches.length !== 1 || !/(^|\r?\n)OK(\r?\n|$)/i.test(String(text || ""))) {
    throw new Error("The module did not return one valid eight-digit QADBKEY challenge.");
  }
  return matches[0][1];
}

function md5(data) {
  return crypto.createHash("md5").update(data).digest();
}

function md5CryptBase64(high, middle, low, count) {
  let value = ((high << 16) | (middle << 8) | low) >>> 0;
  let output = "";
  for (let index = 0; index < count; index += 1) {
    output += MD5_CRYPT_ALPHABET[value & 0x3f];
    value >>>= 6;
  }
  return output;
}

function md5Crypt(passwordValue, saltValue) {
  const password = Buffer.from(passwordValue, "utf8");
  const salt = Buffer.from(saltValue, "utf8");
  let initial = Buffer.concat([password, Buffer.from(MD5_CRYPT_MAGIC), salt]);
  const alternate = md5(Buffer.concat([password, salt, password]));
  for (let remaining = password.length; remaining > 0; remaining -= 16) {
    initial = Buffer.concat([initial, alternate.subarray(0, Math.min(16, remaining))]);
  }
  for (let count = password.length; count > 0; count >>>= 1) {
    initial = Buffer.concat([initial, count & 1 ? Buffer.from([0]) : password.subarray(0, 1)]);
  }
  let digest = md5(initial);
  for (let round = 0; round < 1000; round += 1) {
    const chunks = [];
    chunks.push(round & 1 ? password : digest);
    if (round % 3 !== 0) chunks.push(salt);
    if (round % 7 !== 0) chunks.push(password);
    chunks.push(round & 1 ? digest : password);
    digest = md5(Buffer.concat(chunks));
  }
  let encoded = "";
  encoded += md5CryptBase64(digest[0], digest[6], digest[12], 4);
  encoded += md5CryptBase64(digest[1], digest[7], digest[13], 4);
  encoded += md5CryptBase64(digest[2], digest[8], digest[14], 4);
  encoded += md5CryptBase64(digest[3], digest[9], digest[15], 4);
  encoded += md5CryptBase64(digest[4], digest[10], digest[5], 4);
  encoded += md5CryptBase64(0, 0, digest[11], 2);
  return MD5_CRYPT_MAGIC + saltValue + "$" + encoded;
}

function legacyQadbPassword(challenge) {
  if (!/^[0-9]{8}$/.test(String(challenge || ""))) throw new Error("Invalid QADBKEY challenge.");
  const result = md5Crypt("SH_adb_quectel", challenge);
  const prefix = MD5_CRYPT_MAGIC + challenge + "$";
  const password = result.slice(prefix.length, prefix.length + 15);
  if (password.length !== 15) throw new Error("Could not derive the QADBKEY response.");
  return password;
}

function sha256File(filename) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filename);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function verifyRuntimeFile(directory, expected) {
  const filename = path.join(directory, expected.name);
  let stat;
  try { stat = await fs.promises.stat(filename); } catch { throw new Error("Missing " + expected.name + "."); }
  if (!stat.isFile() || stat.size !== expected.size) throw new Error("Unexpected size for " + expected.name + ".");
  if ((await sha256File(filename)).toLowerCase() !== expected.sha256) throw new Error("SHA-256 mismatch for " + expected.name + ".");
  return filename;
}

async function verifyRuntime(directory) {
  for (const expected of RUNTIME_FILES) await verifyRuntimeFile(directory, expected);
  return { ok: true, version: RUNTIME_VERSION, directory, totalBytes: RUNTIME_FILES.reduce((sum, item) => sum + item.size, 0) };
}

async function downloadOne(expected, target, options = {}) {
  const temporary = target + ".download";
  const url = new URL(encodeURIComponent(expected.name), options.baseUrl || RUNTIME_BASE_URL);
  const requestFile = options.request || https.get;
  const onProgress = options.onProgress || (() => {});
  const addresses = options.addresses || [];
  const attempts = [...addresses.slice(0, 2), null];
  let lastError;
  for (const address of attempts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || 20000);
    let response;
    try {
      response = await new Promise((resolve, reject) => {
        const request = requestFile(url, {
          headers: { "user-agent": "DJI-4G-Assistant/" + RUNTIME_VERSION },
          signal: controller.signal,
          ...(address ? { family: 4, lookup: (_host, _options, callback) => callback(null, address, 4) } : {}),
        }, resolve);
        request.on("error", reject);
      });
      if (response.statusCode !== 200) {
        const error = new Error("Runtime download returned HTTP " + response.statusCode + " for " + expected.name + ".");
        error.code = "VOICE_DOWNLOAD_HTTP";
        error.retryable = response.statusCode >= 500;
        throw error;
      }
      const declared = Number(response.headers["content-length"] || 0);
      if (declared && declared !== expected.size) {
        const error = new Error("Runtime download size changed for " + expected.name + ".");
        error.code = "VOICE_DOWNLOAD_INTEGRITY";
        throw error;
      }
      let received = 0;
      const hash = crypto.createHash("sha256");
      const verify = new Transform({ transform(chunk, _encoding, callback) {
        received += chunk.length;
        if (received > expected.size) {
          const error = new Error("Runtime file exceeded its pinned size.");
          error.code = "VOICE_DOWNLOAD_INTEGRITY";
          callback(error);
          return;
        }
        hash.update(chunk);
        onProgress(received);
        callback(null, chunk);
      } });
      await pipeline(response, verify, fs.createWriteStream(temporary, { mode: expected.mode & 0o777 }), { signal: controller.signal });
      if (received !== expected.size || hash.digest("hex") !== expected.sha256) {
        const error = new Error("Runtime verification failed for " + expected.name + ".");
        error.code = "VOICE_DOWNLOAD_INTEGRITY";
        throw error;
      }
      await fs.promises.rename(temporary, target);
      return;
    } catch (error) {
      lastError = error;
      response?.destroy();
      await fs.promises.rm(temporary, { force: true }).catch(() => {});
      if (error.code === "VOICE_DOWNLOAD_INTEGRITY" || error.retryable === false || ["EACCES", "EPERM", "ENOSPC"].includes(error.code)) break;
    } finally { clearTimeout(timer); }
  }
  if (!lastError.code?.startsWith("VOICE_DOWNLOAD_")) {
    lastError.code = ["EACCES", "EPERM", "ENOSPC"].includes(lastError.code) ? "VOICE_DOWNLOAD_STORAGE" : "VOICE_DOWNLOAD_NETWORK";
  }
  throw lastError;
}

async function downloadRuntime(directory, options = {}) {
  await fs.promises.mkdir(directory, { recursive: true });
  const files = options.files || RUNTIME_FILES;
  const totalBytes = files.reduce((sum, item) => sum + item.size, 0);
  let completedBytes = 0;
  let addresses = options.addresses;
  if (!addresses) {
    let timer;
    try {
      addresses = await Promise.race([
        (options.resolve4 || dns.resolve4)(new URL(options.baseUrl || RUNTIME_BASE_URL).hostname),
        new Promise(resolve => { timer = setTimeout(() => resolve([]), 5000); }),
      ]);
    } catch { addresses = []; } finally { clearTimeout(timer); }
  }
  for (const expected of files) {
    const progress = received => options.onProgress?.({ phase: "downloading", file: expected.name, receivedBytes: completedBytes + received, totalBytes });
    progress(0);
    try { await verifyRuntimeFile(directory, expected); }
    catch {
      await downloadOne(expected, path.join(directory, expected.name), { ...options, addresses, onProgress: progress });
      await verifyRuntimeFile(directory, expected);
    }
    completedBytes += expected.size;
    progress(0);
  }
  if (options.files) return { ok: true, totalBytes };
  return verifyRuntime(directory);
}

function shellOk(result, label) {
  if (!result || result.status !== 0) {
    const detail = result && result.output ? ": " + result.output : "";
    throw new Error(label + detail);
  }
  return result.output;
}

function soundDeviceCheck() {
  return [
    "test -c /dev/snd/controlC0",
    "test -c /dev/snd/pcmC0D4p",
    "test -c /dev/snd/pcmC0D4c",
    "test -c /dev/snd/pcmC0D5p",
    "test -c /dev/snd/pcmC0D6c",
    "grep -Fq mdm9607-tomtom-i2s-snd-card /proc/asound/cards",
  ].join(" && ");
}

function ownedProcessCheck(pidFile, executable, requiredArgument) {
  return "test -s " + pidFile + " && read pid born < " + pidFile +
    " && test \"$(cut -d ' ' -f 22 /proc/$pid/stat 2>/dev/null)\" = \"$born\"" +
    " && test \"$(tr '\\000' '\\n' < /proc/$pid/cmdline 2>/dev/null | sed -n '1p')\" = \"" + executable + "\"" +
    (requiredArgument ? " && tr '\\000' '\\n' < /proc/$pid/cmdline 2>/dev/null | grep -Fxq \"" + requiredArgument + "\"" : "");
}

class VoiceRuntimeManager {
  constructor(dataRoot, options = {}) {
    this.directory = path.join(dataRoot, "voice-runtime", RUNTIME_VERSION);
    this.withAdb = options.withAdb || withAdb;
    this.prepared = false;
    this.routeActive = false;
    this.downloadProgress = { phase: "idle", receivedBytes: 0, totalBytes: RUNTIME_FILES.reduce((sum, item) => sum + item.size, 0) };
    this.downloadTask = null;
  }

  async localStatus() {
    try { return { ...(await verifyRuntime(this.directory)), downloaded: true }; }
    catch (error) {
      return {
        ok: false,
        downloaded: false,
        version: RUNTIME_VERSION,
        directory: this.directory,
        totalBytes: RUNTIME_FILES.reduce((sum, item) => sum + item.size, 0),
        error: error.message,
      };
    }
  }

  async download() {
    if (!this.downloadTask) {
      this.downloadProgress = { ...this.downloadProgress, phase: "downloading", file: "", receivedBytes: 0, errorCode: "" };
      this.downloadTask = (async () => {
        try {
          const result = await downloadRuntime(this.directory, { onProgress: progress => { this.downloadProgress = progress; } });
          this.downloadProgress = { ...this.downloadProgress, phase: "complete", receivedBytes: result.totalBytes };
          return { ...result, downloaded: true, upstream: RUNTIME_BASE_URL };
        } catch (error) {
          this.downloadProgress = { ...this.downloadProgress, phase: "failed", errorCode: error.code || "VOICE_DOWNLOAD_STORAGE" };
          throw error;
        } finally { this.downloadTask = null; }
      })();
    }
    return this.downloadTask;
  }

  async probe() {
    return this.withAdb(async (adb) => {
      const uid = await adb.shellChecked("id -u", 8000);
      const kernel = await adb.shellChecked("uname -r", 8000);
      const root = uid.status === 0 && uid.output.trim() === "0";
      const kernelCompatible = kernel.status === 0 && kernel.output.trim() === RUNTIME_KERNEL;
      const ready = root && kernelCompatible && (await adb.shellChecked(
        soundDeviceCheck() + " && test -c /dev/ttyGS0 && test -p /run/voc_svr && test -p /run/alsaucm_test && (" +
        ownedProcessCheck(CALIBRATION_PID, "/usr/bin/alsaucm_test", "") + ") && " +
        "grep -q 'ACDB -> Sent VocProc Cal!' " + CALIBRATION_LOG,
        8000,
      )).status === 0;
      const routeActive = ready && await this.routeReady(adb);
      return {
        ok: root && kernel.status === 0,
        root,
        kernel: kernel.output.trim(),
        kernelCompatible,
        prepared: Boolean(ready),
        routeActive: Boolean(routeActive),
      };
    });
  }

  async prepare() {
    await verifyRuntime(this.directory);
    return this.withAdb(async (adb) => {
      const uid = await adb.shellChecked("id -u", 8000);
      if (uid.status !== 0 || uid.output.trim() !== "0") throw new Error("The QDC507 ADB shell is not root.");
      const kernel = await adb.shellChecked("uname -r", 8000);
      if (kernel.status !== 0 || kernel.output.trim() !== RUNTIME_KERNEL) {
        throw new Error("Voice runtime needs kernel " + RUNTIME_KERNEL + "; module reported " + (kernel.output.trim() || "unknown") + ".");
      }
      shellOk(await adb.shellChecked("mkdir -p " + REMOTE_ROOT + " && chmod 700 " + REMOTE_ROOT, 8000), "Could not create the module runtime directory");
      for (const expected of RUNTIME_FILES.filter((item) => item.deploy)) {
        await adb.push(await fs.promises.readFile(path.join(this.directory, expected.name)), REMOTE_ROOT + "/" + expected.name, expected.mode);
      }

      const ready = await adb.shellChecked(soundDeviceCheck(), 8000);
      if (ready.status !== 0) {
        const legacy = await adb.shellChecked("grep -q '^qdc507_afe ' /proc/modules", 8000);
        if (legacy.status === 0) throw new Error("An older qdc507_afe driver is loaded. Reboot the module before using this runtime.");
        for (const module of [
          { file: "qdc507_aprv3.ko", name: "qdc507_aprv3" },
          { file: "qdc507_voice.ko", name: "qdc507_voice" },
        ]) {
          const present = await adb.shellChecked("grep -q '^" + module.name + " ' /proc/modules", 8000);
          if (present.status === 0) continue;
          const loaded = await adb.shellChecked("insmod " + REMOTE_ROOT + "/" + module.file, 20000);
          if (loaded.status !== 0) {
            const diagnostics = await adb.shellChecked("dmesg | tail -n 100", 8000);
            throw new Error("Could not load " + module.name + ": " + [loaded.output, diagnostics.output].filter(Boolean).join("\n"));
          }
        }
      }

      const wait = "n=0; while test $n -lt 100; do " + soundDeviceCheck() + " && exit 0; sleep 0.2; n=$((n+1)); done; exit 1";
      shellOk(await adb.shellChecked(wait, 25000), "QDC507 audio devices did not appear");
      await this.ensureCalibration(adb);
      shellOk(await adb.shellChecked("test -c /dev/ttyGS0 && test -p /run/voc_svr", 8000), "The module lacks ttyGS0 or voc_svr");
      shellOk(await adb.shellChecked(HELPER + " --check", 15000), "The module voice helper self-check failed");
      this.prepared = true;
      return { ok: true, prepared: true, kernel: RUNTIME_KERNEL, version: RUNTIME_VERSION };
    });
  }

  async ensureCalibration(adb) {
    const owned = ownedProcessCheck(CALIBRATION_PID, "/usr/bin/alsaucm_test", "");
    const command =
      "if ! (" + owned + "); then " +
      "if test -p /run/alsaucm_test; then exit 73; fi; " +
      "rm -f " + CALIBRATION_PID + " " + CALIBRATION_LOG + "; " +
      "nohup /usr/bin/alsaucm_test </dev/null >> " + CALIBRATION_LOG + " 2>&1 & pid=$!; " +
      "born=$(cut -d ' ' -f 22 /proc/$pid/stat 2>/dev/null); printf '%s %s\\n' \"$pid\" \"$born\" > " + CALIBRATION_PID + "; " +
      "n=0; while test $n -lt 50 && test ! -p /run/alsaucm_test; do kill -0 $pid 2>/dev/null || exit 72; sleep 0.1; n=$((n+1)); done; " +
      "test -p /run/alsaucm_test || exit 74; fi; " +
      "if ! grep -q 'ACDB -> Sent VocProc Cal!' " + CALIBRATION_LOG + " 2>/dev/null; then " +
      "printf 'open snd_soc_msm_9x07_Tomtom_I2S\\n' > /run/alsaucm_test; " +
      "printf 'set _verb VoLTE\\n' > /run/alsaucm_test; " +
      "printf 'set _enadev Auxpcm Rx\\n' > /run/alsaucm_test; " +
      "printf 'set _enadev Auxpcm Tx\\n' > /run/alsaucm_test; " +
      "n=0; while test $n -lt 100; do grep -q 'ACDB -> Sent VocProc Cal!' " + CALIBRATION_LOG + " && break; sleep 0.1; n=$((n+1)); done; fi; " +
      "grep -q 'ACDB -> Sent VocProc Cal!' " + CALIBRATION_LOG;
    const result = await adb.shellChecked(command, 25000);
    if (result.status !== 0) {
      if (result.status === 73) throw new Error("Another app owns the module ALSA calibration pipe. Close it and retry.");
      const log = await adb.shellChecked("test ! -f " + CALIBRATION_LOG + " || tail -n 100 " + CALIBRATION_LOG, 8000);
      throw new Error("QDC507 VoLTE audio calibration failed: " + (log.output || result.output || "no diagnostic output"));
    }
  }

  async routeReady(adb) {
    const owned = ownedProcessCheck(ROUTE_PID, HELPER, "--voice-route-session");
    const check = owned +
      " && grep -q 'VoLTE route session active on hw:0,4' " + ROUTE_LOG +
      " && test \"$(cat /sys/class/android_usb/f_audio/audio_enable)\" = 1" +
      " && grep -q '^state: RUNNING' /proc/asound/card0/pcm4p/sub0/status" +
      " && grep -q '^state: RUNNING' /proc/asound/card0/pcm4c/sub0/status";
    return (await adb.shellChecked(check, 8000)).status === 0;
  }

  async startRoute() {
    if (!this.prepared) await this.prepare();
    if (await this.withAdb((adb) => this.routeReady(adb))) {
      this.routeActive = true;
      return { ok: true, active: true, reused: true };
    }
    const launch =
        "if (" + ownedProcessCheck(ROUTE_PID, HELPER, "--voice-route-session") + "); then exit 0; fi; " +
        "rm -f " + ROUTE_PID + " " + ROUTE_LOG + "; " +
        "nohup " + HELPER + " --voice-route-session --verbose </dev/null >> " + ROUTE_LOG + " 2>&1 & pid=$!; " +
        "born=$(cut -d ' ' -f 22 /proc/$pid/stat 2>/dev/null); " +
        "case \"$pid:$born\" in :*|*:|*[!0-9:]*) exit 70;; *) printf '%s %s\\n' \"$pid\" \"$born\" > " + ROUTE_PID + ";; esac";
    let launchAttempted = false;
    let lastError = "";
    try {
      await this.withAdb(async (adb) => {
        launchAttempted = true;
        shellOk(await adb.shellChecked(launch, 8000), "Could not launch the owned voice helper");
      });
    } catch (error) {
      if (!launchAttempted) throw error;
      lastError = error.message;
    }
    // audio_enable can re-enumerate the USB gadget after launch; never launch twice.
    const deadline = Date.now() + 30000;
    for (let index = 0; index < 100 && Date.now() < deadline; index += 1) {
      try {
        if (await this.withAdb((adb) => this.routeReady(adb))) {
          this.routeActive = true;
          return { ok: true, active: true, reused: false };
        }
      } catch (error) { lastError = error.message; }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    let log = "";
    try { log = (await this.withAdb((adb) => adb.shellChecked("test ! -f " + ROUTE_LOG + " || tail -n 160 " + ROUTE_LOG, 8000))).output; }
    catch (error) { lastError = error.message; }
    try { await this.stopRoute(); } catch (error) { lastError += "; cleanup: " + error.message; }
    throw new Error("The QDC507 UAC route did not enter RUNNING: " + (log || lastError || "no diagnostic output"));
  }

  async stopRouteWithAdb(adb) {
    const owned = ownedProcessCheck(ROUTE_PID, HELPER, "--voice-route-session");
    const stop =
      "stopped=1; if (" + owned + "); then read pid born < " + ROUTE_PID + "; kill -TERM $pid 2>/dev/null || true; " +
      "n=0; while (" + owned + ") && test $n -lt 50; do sleep 0.1; n=$((n+1)); done; (" + owned + ") && stopped=0 || true; fi; " +
      "test $stopped -eq 1 && rm -f " + ROUTE_PID;
    shellOk(await adb.shellChecked(stop, 10000), "The owned voice helper did not stop cleanly");
    const cleanup =
      "echo 0 > /sys/class/android_usb/f_audio/audio_enable; " +
      "if test -p /run/voc_svr; then printf 'T\\n' > /run/voc_svr; printf 'T\\n' > /run/voc_svr; printf 'B\\n' > /run/voc_svr; fi; " +
      "test \"$(cat /sys/class/android_usb/f_audio/audio_enable)\" = 0";
    shellOk(await adb.shellChecked(cleanup, 8000), "The module voice route did not roll back");
    this.routeActive = false;
    return { ok: true, active: false };
  }

  async stopRoute() {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try { return await this.withAdb((adb) => this.stopRouteWithAdb(adb)); }
      catch (error) { lastError = error; }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw lastError;
  }

  async status() {
    const local = await this.localStatus();
    try {
      const probe = await this.probe();
      this.prepared = probe.prepared;
      this.routeActive = probe.routeActive;
      return { ok: true, local, adb: probe, prepared: this.prepared, routeActive: this.routeActive };
    } catch (error) {
      this.prepared = false;
      this.routeActive = false;
      return { ok: true, local, adb: { ok: false, error: error.message }, prepared: this.prepared, routeActive: this.routeActive };
    }
  }
}

module.exports = {
  RUNTIME_COMMIT,
  RUNTIME_VERSION,
  RUNTIME_KERNEL,
  RUNTIME_BASE_URL,
  RUNTIME_FILES,
  VoiceRuntimeManager,
  parseUsbComposition,
  usbCompositionCommand,
  voiceUsbTarget,
  parseQadbChallenge,
  md5Crypt,
  legacyQadbPassword,
  verifyRuntime,
  downloadRuntime,
  downloadOne,
};
