const http = require("http");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const originalUsb = require("./original-usb");

const root = path.resolve(process.env.ROAMDOCK_RESOURCE_ROOT || path.resolve(__dirname, ".."));
const dataRoot = path.resolve(process.env.ROAMDOCK_DATA_ROOT || root);
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 8787);
let detectedAtPort = "";
const host = process.env.HOST || "0.0.0.0";
const consoleToken = process.env.CONSOLE_TOKEN || "";
let atQueue = Promise.resolve();
let driverInstallRunning = false;

const DEFAULT_ISDR_AID = "A0000005591010FFFFFFFF8900000100";
const KNOWN_ISDR_AIDS = [
  DEFAULT_ISDR_AID,
  "A0000005591010FFFFFFFF8900050500",
  "A0000005591010000000008900000300",
  "A0000005591010FFFFFFFF8900000177",
];

function normalizeIsdrAid(value) {
  const aid = String(value || "").trim().toUpperCase();
  return aid.length >= 2 && aid.length <= 32 && aid.length % 2 === 0 && /^[0-9A-F]+$/.test(aid) ? aid : null;
}

function parseLpacData(value) {
  const lines = String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const message = JSON.parse(lines[index]);
      if (message?.type === "lpa" && message?.payload?.code === 0) return message.payload.data;
    } catch {}
  }
  return null;
}

function isEid(value) {
  return /^89[0-9]{30}$/.test(String(value || ""));
}

function localIps() {
  const result = [];
  for (const [name, items] of Object.entries(os.networkInterfaces())) {
    for (const item of items || []) {
      if (item.family !== "IPv4" || item.internal || item.address.startsWith("169.254.")) continue;
      let score = 0;
      if (/Wi-?Fi|WLAN|Wireless|无线/i.test(name)) score += 100;
      if (/^192\.168\.225\./.test(item.address)) score -= 100;
      result.push({ address: item.address, score });
    }
  }
  return [...new Set(result.sort((left, right) => right.score - left.score).map((item) => item.address))];
}

function primaryConsoleUrl() {
  const ips = localIps();
  return ips.length ? `http://${ips[0]}:${port}` : `http://127.0.0.1:${port}`;
}

function sendJson(res, status, body) {
  const data = Buffer.from(JSON.stringify(body, null, 2), "utf8");
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": data.length,
    "cache-control": "no-store",
  });
  res.end(data);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
  };

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "content-type": types[ext] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(data);
  });
}

function requestToken(req, url) {
  return req.headers["x-console-token"] || url.searchParams.get("token") || "";
}

function isAuthorized(req, url) {
  return !consoleToken || requestToken(req, url) === consoleToken;
}

function runPowerShell(args, timeoutMs = 45000) {
  return new Promise((resolve) => {
    const utf8 = "[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); $OutputEncoding = [Console]::OutputEncoding;";
    const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
    const command = args[0] === "-File"
      ? `${utf8}\n& ${quote(args[1])} ${args.slice(2).map(quote).join(" ")}\nexit $LASTEXITCODE`
      : `${utf8}\n${args[1] || ""}`;
    const child = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
      cwd: root,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        child.kill();
        finished = true;
        resolve({ ok: false, code: null, stdout, stderr: `${stderr}\nTimed out after ${timeoutMs}ms`.trim() });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function script(name) {
  return path.join(root, "scripts", "windows", name);
}

function saveStockBaseline(value) {
  const directory = path.join(dataRoot, ".local", "baselines");
  fs.mkdirSync(directory, { recursive: true });
  const filename = `stock-module-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  fs.writeFileSync(path.join(directory, filename), JSON.stringify(value, null, 2), "utf8");
  return path.join(".local", "baselines", filename);
}

function isTargetUsbConfig(value) {
  return /\+QCFG:\s*"usbcfg"\s*,\s*(?:0x)?2c7c\s*,\s*(?:0x)?0125/i.test(String(value || ""));
}

function findLpac() {
  const candidates = [
    path.join(dataRoot, "tools", "lpac.exe"),
    path.join(dataRoot, "tools", "lpac", "lpac.exe"),
    path.join(root, "tools", "lpac.exe"),
    path.join(root, "tools", "lpac", "lpac.exe"),
    path.join(path.dirname(root), "lpac-windows-x86_64-mingw", "lpac.exe"),
    path.join(path.dirname(root), "EasyLPAC-windows-x86_64-with-lpac", "lpac.exe"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function runLpac(lpac, portName, args, timeoutMs = 60000, options = {}) {
  return new Promise((resolve) => {
    const aid = normalizeIsdrAid(options.aid) || DEFAULT_ISDR_AID;
    const child = spawn(lpac, args, {
      cwd: root,
      windowsHide: true,
      env: {
        ...process.env,
        LPAC_APDU: "at",
        LPAC_APDU_AT_DEVICE: portName,
        LPAC_CUSTOM_ES10X_MSS: "60",
        LPAC_CUSTOM_ISD_R_AID: aid,
      },
    });

    let stdout = "";
    let stderr = "";
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, code: null, stdout, stderr: `${stderr}\nTimed out after ${timeoutMs}ms`.trim() });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", (error) => finish({ ok: false, code: null, stdout, stderr: `${stderr}\n${error.message}`.trim() }));
    child.on("close", (code) => finish({ ok: code === 0, code, stdout, stderr }));
  });
}

function euiccInventoryPath() {
  return path.join(dataRoot, ".local", "euicc-inventory.json");
}

function readEuiccState() {
  try {
    const value = JSON.parse(fs.readFileSync(euiccInventoryPath(), "utf8"));
    return {
      aids: value?.aids && typeof value.aids === "object" ? value.aids : {},
      labels: value?.labels && typeof value.labels === "object" ? value.labels : {},
    };
  } catch {
    return { aids: {}, labels: {} };
  }
}

function writeEuiccState(value) {
  const target = euiccInventoryPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ version: 1, aids: value.aids, labels: value.labels }, null, 2), "utf8");
  fs.renameSync(temporary, target);
}

function euiccLabel(value) {
  const label = String(value || "").trim();
  return label.length <= 40 && !/[\r\n\x00-\x1f]/.test(label) ? label : null;
}

function inventoryCandidateAids(savedState = readEuiccState()) {
  const configured = String(process.env.EUICC_AID_CANDIDATES || "").split(/[,;\s]+/);
  const saved = Object.values(savedState.aids || {});
  return [...new Set([...KNOWN_ISDR_AIDS, ...saved, ...configured].map(normalizeIsdrAid).filter(Boolean))];
}

function mergeEuiccRecords(records, labels = {}) {
  const eids = [];
  const byEid = new Map();
  for (const record of records || []) {
    const eid = String(record?.eid || "");
    const aid = normalizeIsdrAid(record?.aid);
    if (!isEid(eid) || !aid) continue;
    if (byEid.has(eid)) {
      const existing = byEid.get(eid);
      if (!existing.aids.includes(aid)) existing.aids.push(aid);
      continue;
    }
    const profiles = Array.isArray(record.profiles) ? record.profiles : [];
    const item = {
      eid,
      aid,
      aids: [aid],
      label: euiccLabel(labels[eid]) || "",
      profileCount: profiles.length,
      activeCount: profiles.filter((profile) => String(profile?.profileState).toLowerCase() === "enabled").length,
      freeMemory: Number(record.freeMemory) || 0,
      firmware: String(record.firmware || ""),
      profileVersion: String(record.profileVersion || ""),
      profiles,
    };
    byEid.set(eid, item);
    eids.push(item);
  }
  return eids;
}

async function discoverEuiccInventory(lpac, portName) {
  const savedState = readEuiccState();
  const candidates = inventoryCandidateAids(savedState);
  const records = [];
  for (const aid of candidates) {
    const chipResult = await runLpac(lpac, portName, ["chip", "info"], 30000, { aid });
    const chip = chipResult.ok ? parseLpacData(chipResult.stdout) : null;
    if (!chip || !isEid(chip.eidValue)) continue;
    const profileResult = await runLpac(lpac, portName, ["profile", "list"], 45000, { aid });
    const profiles = profileResult.ok ? parseLpacData(profileResult.stdout) : [];
    records.push({
      eid: chip.eidValue,
      aid,
      profiles: Array.isArray(profiles) ? profiles : [],
      freeMemory: chip.EUICCInfo2?.extCardResource?.freeNonVolatileMemory,
      firmware: chip.EUICCInfo2?.euiccFirmwareVer,
      profileVersion: chip.EUICCInfo2?.profileVersion,
    });
    savedState.aids[chip.eidValue] = aid;
  }
  const eids = mergeEuiccRecords(records, savedState.labels);
  if (eids.length) writeEuiccState(savedState);
  return {
    ok: eids.length > 0,
    eids,
    count: eids.length,
    candidatesChecked: candidates.length,
    warning: eids.length ? "" : "No accessible eUICC EID was found.",
  };
}

function requestedAid(url, body = {}) {
  const raw = body.aid || url.searchParams.get("aid") || DEFAULT_ISDR_AID;
  return normalizeIsdrAid(raw);
}

function activationCode(value) {
  const code = String(value || "").trim();
  const parts = code.split("$");
  if (
    code.length > 1024 ||
    /[\r\n\x00-\x1f]/.test(code) ||
    parts.length < 3 ||
    parts.length > 4 ||
    parts[0] !== "LPA:1" ||
    parts.slice(1).some((part) => !part)
  ) {
    return null;
  }
  return code;
}

function redactResult(result, secret) {
  if (!secret) return result;
  const redact = (value) => String(value || "").split(secret).join("[activation code redacted]");
  return { ...result, stdout: redact(result.stdout), stderr: redact(result.stderr) };
}

function profileId(value) {
  const id = String(value || "").trim();
  return /^[0-9a-f]+$/i.test(id) ? id : null;
}

function profileNickname(value) {
  const nickname = String(value || "").trim();
  return nickname && nickname.length <= 64 && !/[\r\n\x00-\x1f]/.test(nickname) ? nickname : null;
}

function smsRecipient(value) {
  const number = String(value || "").trim();
  return /^\+?[0-9]{3,20}$/.test(number) ? number : null;
}

function smsText(value) {
  const message = String(value || "").trim();
  return message && message.length <= 480 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(message) ? message : null;
}

function byteHex(value) {
  return Number(value).toString(16).padStart(2, "0").toUpperCase();
}

function ucs2Hex(value) {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    result += value.charCodeAt(index).toString(16).padStart(4, "0");
  }
  return result.toUpperCase();
}

function splitUcs2(value, maxBytes) {
  const parts = [];
  let current = "";
  let currentBytes = 0;
  for (const character of value) {
    const bytes = character.length * 2;
    if (current && currentBytes + bytes > maxBytes) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += character;
    currentBytes += bytes;
  }
  if (current) parts.push(current);
  return parts;
}

function encodeAddress(number) {
  const international = number.startsWith("+");
  const digits = number.replace(/^\+/, "");
  const padded = digits.length % 2 ? `${digits}F` : digits;
  let swapped = "";
  for (let index = 0; index < padded.length; index += 2) {
    swapped += padded[index + 1] + padded[index];
  }
  return { digits, swapped, type: international ? "91" : "81" };
}

function buildSmsPdus(number, message) {
  const address = encodeAddress(number);
  const singlePart = ucs2Hex(message).length / 2 <= 140;
  const chunks = singlePart ? [message] : splitUcs2(message, 134);
  const reference = Math.floor(Math.random() * 256);
  return chunks.map((chunk, index) => {
    const header = chunks.length > 1
      ? `050003${byteHex(reference)}${byteHex(chunks.length)}${byteHex(index + 1)}`
      : "";
    const userData = `${header}${ucs2Hex(chunk)}`;
    const firstOctet = chunks.length > 1 ? "41" : "01";
    const tpdu = [
      firstOctet,
      "00",
      byteHex(address.digits.length),
      address.type,
      address.swapped,
      "00",
      "08",
      byteHex(userData.length / 2),
      userData,
    ].join("");
    return { pdu: `00${tpdu}`, length: tpdu.length / 2 };
  });
}

function sendSms(portName, number, message) {
  const payload = Buffer.from(JSON.stringify({ pdus: buildSmsPdus(number, message) }), "utf8").toString("base64");
  const ps = `
$payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}')) | ConvertFrom-Json
$sp = New-Object System.IO.Ports.SerialPort '${portName.replace(/'/g, "''")}',115200,'None',8,'One'
$sp.ReadTimeout = 1800
$sp.WriteTimeout = 1800
$sp.NewLine = "\`r"
function Read-Until([string]$pattern, [int]$seconds) {
  $out = ''
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    $out += $sp.ReadExisting()
    if ($out -match $pattern) { return $out }
    Start-Sleep -Milliseconds 120
  }
  return $out
}
try {
  $sp.Open()
  $sp.DiscardInBuffer()
  $sp.WriteLine('AT+CMGF=0')
  $mode = Read-Until '(\\r|\\n)(OK|ERROR)(\\r|\\n)' 8
  if ($mode -notmatch '(\\r|\\n)OK(\\r|\\n)') { throw 'The modem did not accept SMS PDU mode.' }
  $segment = 0
  foreach ($item in $payload.pdus) {
    $segment += 1
    $sp.DiscardInBuffer()
    $sp.WriteLine(('AT+CMGS={0}' -f $item.length))
    $prompt = Read-Until '>' 10
    if ($prompt -notmatch '>') { throw ('The modem did not present an SMS prompt for segment {0}.' -f $segment) }
    $sp.Write([string]$item.pdu)
    $sp.Write([char]26)
    $sent = Read-Until '(\\r|\\n)(OK|ERROR)(\\r|\\n)' 60
    if ($sent -notmatch '(\\r|\\n)OK(\\r|\\n)') { throw ('The modem rejected SMS segment {0} or did not finish in time.' -f $segment) }
    ('SMS segment {0}/{1} accepted by modem.' -f $segment, $payload.pdus.Count)
  }
} finally {
  if ($sp.IsOpen) { $sp.Close() }
}`;
  return enqueueSerial(() => runPowerShell(["-Command", ps], 90000));
}

function ussdCode(value) {
  const code = String(value || "").trim();
  return /^[0-9*#]{1,32}$/.test(code) ? code : null;
}

function callNumber(value) {
  const number = String(value || "").trim();
  return /^\+?[0-9]{3,20}$/.test(number) ? number : null;
}

function dtmfDigits(value) {
  const digits = String(value || "").trim();
  return /^[0-9*#]{1,32}$/.test(digits) ? digits : null;
}

const callStateNames = {
  0: "active",
  1: "held",
  2: "dialing",
  3: "alerting",
  4: "incoming",
  5: "waiting",
  6: "disconnected",
};

function parseClcc(text) {
  const calls = [];
  const pattern = /\+CLCC:\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*"([^"]*)"\s*,\s*(\d+))?/gi;
  for (const match of String(text || "").matchAll(pattern)) {
    const mode = Number(match[4]);
    const stateCode = Number(match[3]);
    calls.push({
      id: Number(match[1]),
      direction: Number(match[2]) === 1 ? "incoming" : "outgoing",
      state: callStateNames[stateCode] || "unknown",
      stateCode,
      mode,
      isVoice: mode === 0,
      multiparty: Number(match[5]) === 1,
      number: match[6] || "",
      type: match[7] ? Number(match[7]) : null,
    });
  }
  return calls;
}

function buildCallAction(body = {}) {
  const action = String(body.action || "").trim().toLowerCase();
  const confirm = String(body.confirm || "").trim().toUpperCase();
  if (action === "dial") {
    const number = callNumber(body.number);
    return number && confirm === "DIAL" ? { action, commands: ["ATD" + number + ";"] } : null;
  }
  if (action === "answer") return confirm === "ANSWER" ? { action, commands: ["ATA"] } : null;
  if (["hangup", "reject"].includes(action)) return confirm === "HANGUP" ? { action, commands: ["ATH"] } : null;
  if (action === "dtmf") {
    const digits = dtmfDigits(body.digits);
    return digits && confirm === "DTMF" ? { action, commands: [...digits].map((digit) => 'AT+VTS="' + digit + '"') } : null;
  }
  if (action === "caller-id") return confirm === "CALLERID" ? { action, commands: ["AT+CLIP=1"] } : null;
  return null;
}

function sendUssd(portName, code) {
  const ps = `
$sp = New-Object System.IO.Ports.SerialPort '${portName.replace(/'/g, "''")}',115200,'None',8,'One'
$sp.ReadTimeout = 1800
$sp.WriteTimeout = 1800
$sp.NewLine = "\`r"
try {
  $sp.Open()
  $sp.DiscardInBuffer()
  $sp.WriteLine('AT+CUSD=1,"${code}",15')
  $out = ''
  $deadline = (Get-Date).AddSeconds(35)
  while ((Get-Date) -lt $deadline) {
    $out += $sp.ReadExisting()
    if ($out -match '(\`r|\`n)\+CUSD:') { break }
    if ($out -match '(\`r|\`n)ERROR(\`r|\`n)') { break }
    Start-Sleep -Milliseconds 150
  }
  ($out -replace "\`r","")
} finally {
  if ($sp.IsOpen) { $sp.Close() }
}`;
  return enqueueSerial(() => runPowerShell(["-Command", ps], 45000));
}
function portArg(url) {
  const value = url.searchParams.get("port") || detectedAtPort || "COM5";
  return /^COM\d+$/i.test(value) ? value.toUpperCase() : (detectedAtPort || "COM5");
}

function isSafeAt(command) {
  const normalized = command.trim().toUpperCase();
  if (!normalized.startsWith("AT")) return false;

  const dangerous = [
    "AT+QCFG=",
    "AT+CFUN=",
    "AT+QPRTPARA",
    "AT+QF",
    "AT+CMGD",
    "AT+CMGS",
    "AT+CGDCONT=",
    "AT+CGACT=",
    "AT+CLCK=",
    "AT+CPWD=",
  ];

  if (process.env.ALLOW_DANGEROUS_AT === "1") {
    return true;
  }

  return !dangerous.some((prefix) => normalized.startsWith(prefix));
}

function runAtCommands(portName, commands, timeoutMs = 60000) {
  const commandArray = `@(${commands.map((command) => `'${command.replace(/'/g, "''")}'`).join(",")})`;
  const ps = `
$portName='${portName.replace(/'/g, "''")}'
$commands=${commandArray}
$sp=New-Object System.IO.Ports.SerialPort $portName,115200,'None',8,'One'
$sp.ReadTimeout=1800
$sp.WriteTimeout=1800
$sp.NewLine="\`r"
try {
  $sp.Open()
  foreach($cmd in $commands){
    $sp.DiscardInBuffer()
    $sp.WriteLine($cmd)
    Start-Sleep -Milliseconds 450
    $out=''
    $deadline=(Get-Date).AddSeconds(5)
    while((Get-Date) -lt $deadline){
      $out += $sp.ReadExisting()
      if($out -match "(\`r|\`n)(OK|ERROR)(\`r|\`n)") { break }
      Start-Sleep -Milliseconds 120
    }
    "----- $cmd -----"
    ($out -replace "\`r","")
  }
} finally {
  if($sp.IsOpen){ $sp.Close() }
}`;
  return runPowerShell(["-Command", ps], timeoutMs);
}

function enqueueSerial(task) {
  const queued = atQueue.then(task);
  atQueue = queued.catch(() => {});
  return queued;
}

function enqueueAt(portName, commands, timeoutMs = 60000) {
  return enqueueSerial(() => runAtCommands(portName, commands, timeoutMs));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (body.length > 20480) {
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      name: "DJI 4G Assistant for Windows",
      time: new Date().toISOString(),
      host: os.hostname(),
      urls: localIps().map((ip) => `http://${ip}:${port}`),
      primaryUrl: primaryConsoleUrl(),
      authRequired: Boolean(consoleToken),
      dangerousAtEnabled: process.env.ALLOW_DANGEROUS_AT === "1",
      profileActionsEnabled: process.env.ALLOW_PROFILE_ACTIONS === "1",
      profileDownloadEnabled: process.env.ALLOW_PROFILE_DOWNLOAD === "1",
      profileNicknameEnabled: process.env.ALLOW_PROFILE_NICKNAME === "1",
      profileNotificationsEnabled: process.env.ALLOW_PROFILE_NOTIFICATIONS === "1",
      profileDeleteEnabled: process.env.ALLOW_PROFILE_DELETE === "1",
      smsSendEnabled: process.env.ALLOW_SMS_SEND === "1",
      callActionsEnabled: process.env.ALLOW_CALL_ACTIONS === "1",
      ussdEnabled: process.env.ALLOW_USSD === "1",
      usbModeEnabled: process.env.ALLOW_USB_MODE === "1",
      stockBootstrapEnabled: process.env.ALLOW_STOCK_BOOTSTRAP === "1",
      driverInstallEnabled: process.env.ALLOW_DRIVER_INSTALL === "1",
    });
    return;
  }

  if (!isAuthorized(req, url)) {
    sendJson(res, 401, {
      ok: false,
      error: "Unauthorized",
      authRequired: true,
    });
    return;
  }

  if (url.pathname === "/api/stock-module-probe") {
    const result = await enqueueSerial(() => originalUsb.inspect());
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/stock-module-convert" && req.method === "POST") {
    if (process.env.ALLOW_STOCK_BOOTSTRAP !== "1") {
      sendJson(res, 403, { ok: false, error: "Original-module conversion is locked. Start the dedicated original-module setup launcher first." });
      return;
    }
    const body = JSON.parse(await readBody(req) || "{}");
    if (String(body.confirm || "").toUpperCase() !== "CONVERT") {
      sendJson(res, 400, { ok: false, error: "Confirm CONVERT before changing the USB identity." });
      return;
    }
    let baselineFile = null;
    const result = await enqueueSerial(() => originalUsb.convert({
      onBaseline: (snapshot) => {
        baselineFile = saveStockBaseline(snapshot);
      },
    }));
    sendJson(res, 200, { ...result, baselineFile });
    return;
  }

  if (url.pathname === "/api/stock-module-usbnet" && req.method === "POST") {
    if (process.env.ALLOW_STOCK_BOOTSTRAP !== "1") {
      sendJson(res, 403, { ok: false, error: "Original-module setup is locked. Start the dedicated original-module setup launcher first." });
      return;
    }
    const body = JSON.parse(await readBody(req) || "{}");
    if (String(body.confirm || "").toUpperCase() !== "USBNET") {
      sendJson(res, 400, { ok: false, error: "Confirm USBNET before changing the USB networking mode." });
      return;
    }
    const portName = portArg(url);
    const baseline = await enqueueAt(portName, ["AT+QCFG=\"usbcfg\"", "AT+QCFG=\"usbnet\""], 30000);
    if (!baseline.ok || !isTargetUsbConfig(baseline.stdout)) {
      sendJson(res, 409, { ok: false, error: "The AT port did not report target USB identity 2C7C:0125. Reconnect the converted module and run Find AT first.", baseline });
      return;
    }
    const write = await enqueueAt(portName, ["AT+QCFG=\"usbnet\",1"], 30000);
    if (!write.ok || !/(^|\r?\n)OK(\r?\n|$)/i.test(write.stdout)) {
      sendJson(res, 502, { ok: false, error: "The module rejected usbnet=1. No reboot command was sent.", write });
      return;
    }
    await enqueueAt(portName, ["AT+CFUN=1,1"], 15000);
    sendJson(res, 200, { ok: true, baseline, write, message: "usbnet=1 was accepted and a modem restart was requested. Reconnect after the module finishes restarting." });
    return;
  }

  if (url.pathname === "/api/ports") {
    const result = await runPowerShell(["-Command", "[System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object"]);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/device-check") {
    const result = await runPowerShell(["-File", script("read-only-device-check.ps1")], 45000);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/find-at") {
    const result = await runPowerShell(["-File", script("find-at-port.ps1")], 30000);
    const found = String(result.stdout || "").match(/AT_PORT=(COM\d+)/i);
    if (found) detectedAtPort = found[1].toUpperCase();
    sendJson(res, 200, { ...result, port: detectedAtPort || null });
    return;
  }

  if (url.pathname === "/api/baseline") {
    const result = await runPowerShell(["-File", script("at-baseline.ps1"), "-PortName", portArg(url)], 60000);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/module-status") {
    const commands = [
      "ATI",
      "AT+CPIN?",
      "AT+CIMI",
      "AT+COPS?",
      "AT+CEREG?",
      "AT+CGREG?",
      "AT+CSQ",
      "AT+QNWINFO",
      "AT+QENG=\"servingcell\"",
      "AT+CGDCONT?",
      "AT+CGACT?",
      "AT+CGPADDR=1",
      "AT+QCFG=\"usbnet\"",
      "AT+QNETDEVSTATUS?",
    ];
    const result = await enqueueAt(portArg(url), commands, 60000);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/call-status") {
    const result = await enqueueAt(portArg(url), ["AT+CLCC", "AT+CPAS", "AT+CLIP?"], 30000);
    const calls = parseClcc(result.stdout);
    const activityMatch = String(result.stdout || "").match(/\+CPAS:\s*(\d+)/i);
    const clipMatch = String(result.stdout || "").match(/\+CLIP:\s*(\d+)/i);
    sendJson(res, 200, {
      ...result,
      calls,
      voiceCalls: calls.filter((call) => call.isVoice),
      dataCalls: calls.filter((call) => !call.isVoice),
      activity: activityMatch ? Number(activityMatch[1]) : null,
      callerIdEnabled: clipMatch ? Number(clipMatch[1]) === 1 : null,
    });
    return;
  }

  if (url.pathname === "/api/call-capabilities") {
    const result = await enqueueAt(portArg(url), ["ATI", "AT+CLIP?", "AT+QPCMV=?", "AT+QCFG=\"usbcfg\"", "AT+QCFG=\"usbnet\""], 45000);
    const audio = await runPowerShell(["-Command", "Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { ($_.Class -eq 'AudioEndpoint' -or $_.Class -eq 'MEDIA') -and $_.FriendlyName -match 'Quectel|QDC507|Baiwang|AC Interface|AS Interface' } | Select-Object Status,Class,FriendlyName,InstanceId | ConvertTo-Json -Compress"]);
    sendJson(res, 200, {
      ...result,
      callerIdSupported: /\+CLIP:/i.test(result.stdout || ""),
      rawPcmSupported: /\+QPCMV:\s*\(/i.test(result.stdout || ""),
      standardUsbAudio: Boolean(String(audio.stdout || "").trim()),
      audioDevices: String(audio.stdout || "").trim(),
    });
    return;
  }

  if (url.pathname === "/api/call-action" && req.method === "POST") {
    if (process.env.ALLOW_CALL_ACTIONS !== "1") {
      sendJson(res, 403, { ok: false, error: "Call controls are disabled on this local server." });
      return;
    }
    const callAction = buildCallAction(JSON.parse(await readBody(req) || "{}"));
    if (!callAction) {
      sendJson(res, 400, { ok: false, error: "Invalid call action, number, DTMF digits, or confirmation." });
      return;
    }
    const result = await enqueueAt(portArg(url), callAction.commands, 30000);
    const accepted = result.ok && /(^|\r?\n)OK(\r?\n|$)/i.test(result.stdout || "") && !/(^|\r?\n)ERROR(\r?\n|$)/i.test(result.stdout || "");
    sendJson(res, accepted ? 200 : 502, { ...result, ok: accepted, action: callAction.action });
    return;
  }

  if (url.pathname === "/api/sms-list") {
    const commands = [
      "AT+CMGF=1",
      "AT+CPMS=\"MT\",\"MT\",\"MT\"",
      "AT+CPMS?",
      "AT+CMGL=\"ALL\"",
    ];
    const result = await enqueueAt(portArg(url), commands, 60000);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/sms-send" && req.method === "POST") {
    if (process.env.ALLOW_SMS_SEND !== "1") {
      sendJson(res, 403, { ok: false, error: "SMS sending is disabled. Start the dedicated local SMS launcher first." });
      return;
    }
    const body = JSON.parse(await readBody(req) || "{}");
    const number = smsRecipient(body.number);
    const message = smsText(body.message);
    if (!number || !message || String(body.confirm || "").toUpperCase() !== "SEND") {
      sendJson(res, 400, { ok: false, error: "Use an international number such as +447700900123, enter a message, and confirm SEND." });
      return;
    }
    const result = await sendSms(portArg(url), number, message);
    sendJson(res, result.ok ? 200 : 502, result);
    return;
  }

  if (url.pathname === "/api/ussd" && req.method === "POST") {
    if (process.env.ALLOW_USSD !== "1") {
      sendJson(res, 403, { ok: false, error: "USSD is disabled." });
      return;
    }
    const body = JSON.parse(await readBody(req) || "{}");
    const code = ussdCode(body.code);
    if (!code || String(body.confirm || "").toUpperCase() !== "USSD") {
      sendJson(res, 400, { ok: false, error: "Enter a USSD code such as *100# and confirm USSD." });
      return;
    }
    const result = await sendUssd(portArg(url), code);
    sendJson(res, result.ok ? 200 : 502, result);
    return;
  }

  if (url.pathname === "/api/usbnet-mode" && req.method === "POST") {
    if (process.env.ALLOW_USB_MODE !== "1") {
      sendJson(res, 403, { ok: false, error: "USB mode switching is disabled." });
      return;
    }
    const body = JSON.parse(await readBody(req) || "{}");
    const mode = Number(body.mode);
    const expected = mode === 0 ? "USBNET0" : mode === 1 ? "USBNET1" : "";
    if (!expected || String(body.confirm || "").toUpperCase() !== expected) {
      sendJson(res, 400, { ok: false, error: "Only usbnet modes 0 and 1 are exposed. Confirm the selected mode." });
      return;
    }
    const portName = portArg(url);
    const baseline = await enqueueAt(portName, ["AT+QCFG=\"usbcfg\"", "AT+QCFG=\"usbnet\""], 30000);
    if (!baseline.ok || !isTargetUsbConfig(baseline.stdout)) {
      sendJson(res, 409, { ok: false, error: "The connected module is not the verified 2C7C:0125 target. No write was made.", baseline });
      return;
    }
    const write = await enqueueAt(portName, [`AT+QCFG="usbnet",${mode}`], 30000);
    if (!write.ok || !/(^|\r?\n)OK(\r?\n|$)/i.test(write.stdout)) {
      sendJson(res, 502, { ok: false, error: "The module rejected the requested USB mode. No reboot command was sent.", write });
      return;
    }
    const reboot = await enqueueAt(portName, ["AT+CFUN=1,1"], 15000);
    sendJson(res, 200, { ok: true, baseline, write, reboot, message: `usbnet=${mode} was accepted. The module is restarting and will reconnect shortly.` });
    return;
  }
  if (url.pathname === "/api/windows-network") {
    const ps = "Get-NetAdapter | Where-Object { $_.InterfaceDescription -match 'Quectel|Mobile Broadband|WWAN|Cellular' -or $_.Name -match 'Quectel|手机网络|Mobile Broadband|Cellular' } | Select-Object Name,Status,LinkSpeed,MacAddress,InterfaceDescription | Format-Table -AutoSize; Get-NetIPConfiguration | Where-Object { $_.InterfaceAlias -match 'Quectel|手机网络|Mobile Broadband|Cellular' } | Format-List InterfaceAlias,IPv4Address,IPv4DefaultGateway,DnsServer";
    const result = await runPowerShell(["-Command", ps]);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/network-traffic") {
    const ps = `
$targetDevice = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object {
  $_.InstanceId -like 'USB\\VID_2C7C&PID_0125&MI_04*'
} | Select-Object -First 1
$targetPresent = [bool]$targetDevice
$driver = Get-CimInstance Win32_PnPSignedDriver -ErrorAction SilentlyContinue | Where-Object {
  $_.DeviceID -like 'USB\\VID_2C7C&PID_0125&MI_04*'
} | Sort-Object DriverDate -Descending | Select-Object -First 1
$driverVersion = $null
if ($driver -and $driver.DriverVersion) {
  try { $driverVersion = [version]$driver.DriverVersion } catch { $driverVersion = $null }
}
$driverReady = [bool]($targetPresent -and $driver -and $driver.DeviceName -eq 'Quectel ECM Adapter' -and $driverVersion -and $driverVersion -ge [version]'19.0.33.201')
$items = @()
$adapters = @(Get-NetAdapter -IncludeHidden -ErrorAction SilentlyContinue | Where-Object {
  $_.InterfaceDescription -match 'Quectel|Mobile Broadband|WWAN|Cellular|Remote NDIS|USB Ethernet'
})
if (-not $targetPresent) {
  $adapters = @($adapters | Where-Object { $_.InterfaceDescription -ne 'Quectel ECM Adapter' })
}
foreach ($adapter in $adapters) {
  $stats = Get-NetAdapterStatistics -Name $adapter.Name -ErrorAction SilentlyContinue
  $receivedRaw = if ($stats) { [uint64]$stats.ReceivedBytes } else { [uint64]0 }
  $sentRaw = if ($stats) { [uint64]$stats.SentBytes } else { [uint64]0 }
  $statisticsReliable = [bool]($receivedRaw -lt [uint64]1PB -and $sentRaw -lt [uint64]1PB)
  $receivedBytes = if ($statisticsReliable) { [int64]$receivedRaw } else { [int64]0 }
  $sentBytes = if ($statisticsReliable) { [int64]$sentRaw } else { [int64]0 }
  $ip = Get-NetIPConfiguration -InterfaceIndex $adapter.ifIndex -ErrorAction SilentlyContinue
  $ipInterface = Get-NetIPInterface -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
  $items += [pscustomobject]@{
    name = $adapter.Name
    description = $adapter.InterfaceDescription
    status = [string]$adapter.Status
    mediaState = [string]$adapter.MediaConnectionState
    linkSpeed = [string]$adapter.LinkSpeed
    receivedBytes = $receivedBytes
    sentBytes = $sentBytes
    statisticsReliable = $statisticsReliable
    ipv4 = [string]($ip.IPv4Address.IPAddress)
    gateway = [string]($ip.IPv4DefaultGateway.NextHop)
    dhcp = [string]($ipInterface.Dhcp)
    driverName = if ($driver) { [string]$driver.DeviceName } else { '' }
    driverVersion = if ($driver) { [string]$driver.DriverVersion } else { '' }
    driverDate = if ($driver) { [string]$driver.DriverDate } else { '' }
    driverInf = if ($driver) { [string]$driver.InfName } else { '' }
    driverSigned = if ($driver) { [bool]$driver.IsSigned } else { $false }
    driverTargetPresent = $targetPresent
    driverReady = $driverReady
  }
}
if ($targetPresent -and $items.Count -eq 0) {
  $items += [pscustomobject]@{
    name = [string]$targetDevice.FriendlyName
    description = if ($driver) { [string]$driver.DeviceName } else { 'Quectel ECM interface' }
    status = [string]$targetDevice.Status
    mediaState = ''
    linkSpeed = ''
    receivedBytes = 0
    sentBytes = 0
    statisticsReliable = $false
    ipv4 = ''
    gateway = ''
    dhcp = ''
    driverName = if ($driver) { [string]$driver.DeviceName } else { '' }
    driverVersion = if ($driver) { [string]$driver.DriverVersion } else { '' }
    driverDate = if ($driver) { [string]$driver.DriverDate } else { '' }
    driverInf = if ($driver) { [string]$driver.InfName } else { '' }
    driverSigned = if ($driver) { [bool]$driver.IsSigned } else { $false }
    driverTargetPresent = $true
    driverReady = $driverReady
  }
}
$items | ConvertTo-Json -Depth 4 -Compress
`;
    const result = await runPowerShell(["-Command", ps]);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/ecm-driver-install" && req.method === "POST") {
    if (process.env.ALLOW_DRIVER_INSTALL !== "1") {
      sendJson(res, 403, { ok: false, error: "ECM driver installation is available only in the Windows desktop app." });
      return;
    }
    const body = JSON.parse(await readBody(req) || "{}");
    if (String(body.confirm || "").toUpperCase() !== "ECMDRIVER") {
      sendJson(res, 400, { ok: false, error: "Confirm ECMDRIVER before installing a Windows driver." });
      return;
    }
    if (driverInstallRunning) {
      sendJson(res, 409, { ok: false, error: "An ECM driver operation is already running." });
      return;
    }

    driverInstallRunning = true;
    try {
      const result = await runPowerShell(["-File", script("install-quectel-ecm-driver.ps1")], 600000);
      let detail = null;
      try { detail = JSON.parse(String(result.stdout || "").trim()); } catch {}
      const response = detail ? { ...result, detail } : result;
      sendJson(res, result.ok && detail?.ok ? 200 : 502, response);
    } finally {
      driverInstallRunning = false;
    }
    return;
  }

  if (url.pathname === "/api/at" && req.method === "POST") {
    const body = JSON.parse(await readBody(req) || "{}");
    const command = String(body.command || "").trim();
    if (!isSafeAt(command)) {
      sendJson(res, 400, {
        ok: false,
        code: null,
        stdout: "",
        stderr: "Blocked by safe AT guard. Set ALLOW_DANGEROUS_AT=1 on the server to allow risky write commands.",
      });
      return;
    }
    const result = await enqueueAt(portArg(url), [command], 30000);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/euicc-inventory") {
    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, eids: [], count: 0, error: "lpac.exe not found" });
      return;
    }
    const result = await discoverEuiccInventory(lpac, portArg(url));
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/euicc-label" && req.method === "POST") {
    const body = JSON.parse(await readBody(req) || "{}");
    const eid = String(body.eid || "");
    const label = euiccLabel(body.label);
    if (!isEid(eid) || label === null) {
      sendJson(res, 400, { ok: false, error: "Invalid EID or label." });
      return;
    }
    const state = readEuiccState();
    if (label) state.labels[eid] = label;
    else delete state.labels[eid];
    writeEuiccState(state);
    sendJson(res, 200, { ok: true, eid, label });
    return;
  }

  if (url.pathname === "/api/euicc-aid" && req.method === "POST") {
    const body = JSON.parse(await readBody(req) || "{}");
    const aid = normalizeIsdrAid(body.aid);
    if (!aid || String(body.confirm || "").toUpperCase() !== "ADD") {
      sendJson(res, 400, { ok: false, error: "Enter a valid ISD-R AID and confirm ADD." });
      return;
    }
    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, error: "lpac.exe not found" });
      return;
    }
    const chipResult = await runLpac(lpac, portArg(url), ["chip", "info"], 30000, { aid });
    const chip = chipResult.ok ? parseLpacData(chipResult.stdout) : null;
    if (!chip || !isEid(chip.eidValue)) {
      sendJson(res, 422, { ok: false, error: "This AID did not return a valid EID." });
      return;
    }
    const state = readEuiccState();
    state.aids[chip.eidValue] = aid;
    writeEuiccState(state);
    sendJson(res, 200, { ok: true, eid: chip.eidValue, aid });
    return;
  }

  if (url.pathname === "/api/lpac-chip") {
    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }
    const aid = requestedAid(url);
    if (!aid) { sendJson(res, 400, { ok: false, error: "Invalid ISD-R AID." }); return; }
    const result = await runLpac(lpac, portArg(url), ["chip", "info"], 60000, { aid });
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/lpac-discovery") {
    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }
    const aid = requestedAid(url);
    if (!aid) { sendJson(res, 400, { ok: false, error: "Invalid ISD-R AID." }); return; }
    const result = await runLpac(lpac, portArg(url), ["profile", "discovery"], 180000, { aid });
    sendJson(res, 200, result);
    return;
  }
  if (url.pathname === "/api/lpac-profiles") {
    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }
    const aid = requestedAid(url);
    if (!aid) { sendJson(res, 400, { ok: false, error: "Invalid ISD-R AID." }); return; }
    const result = await runLpac(lpac, portArg(url), ["profile", "list"], 60000, { aid });
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/lpac-profile-action" && req.method === "POST") {
    if (process.env.ALLOW_PROFILE_ACTIONS !== "1") {
      sendJson(res, 403, {
        ok: false,
        error: "Profile writes are disabled. Set ALLOW_PROFILE_ACTIONS=1 on the local server first.",
      });
      return;
    }

    const body = JSON.parse(await readBody(req) || "{}");
    const action = String(body.action || "").toLowerCase();
    const aid = requestedAid(url, body);
    const id = profileId(body.id);
    const confirm = String(body.confirm || "").toUpperCase();
    if (!aid || !["enable", "disable", "delete"].includes(action) || !id || !["ENABLE", "DISABLE", "DELETE"].includes(confirm) || confirm !== action.toUpperCase()) {
      sendJson(res, 400, { ok: false, error: "Invalid profile action or confirmation." });
      return;
    }

    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }

    if (action === "delete" && process.env.ALLOW_PROFILE_DELETE !== "1") {
      sendJson(res, 403, { ok: false, error: "Profile deletion is disabled." });
      return;
    }
    const args = action === "delete" ? ["profile", "delete", id] : ["profile", action, id, "1"];
    const result = await runLpac(lpac, portArg(url), args, 90000, { aid });
    sendJson(res, result.ok ? 200 : 502, result);
    return;
  }

  if (url.pathname === "/api/lpac-profile-nickname" && req.method === "POST") {
    if (process.env.ALLOW_PROFILE_NICKNAME !== "1") {
      sendJson(res, 403, { ok: false, error: "Profile nickname changes are disabled. Start eSIM management first." });
      return;
    }
    const body = JSON.parse(await readBody(req) || "{}");
    const aid = requestedAid(url, body);
    const id = profileId(body.id);
    const nickname = profileNickname(body.nickname);
    if (!aid || !id || !nickname || String(body.confirm || "").toUpperCase() !== "RENAME") {
      sendJson(res, 400, { ok: false, error: "Enter a profile nickname and confirm RENAME." });
      return;
    }
    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }
    const result = await runLpac(lpac, portArg(url), ["profile", "nickname", id, nickname], 90000, { aid });
    sendJson(res, result.ok ? 200 : 502, result);
    return;
  }

  if (url.pathname === "/api/lpac-notifications") {
    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }
    const aid = requestedAid(url);
    if (!aid) { sendJson(res, 400, { ok: false, error: "Invalid ISD-R AID." }); return; }
    const result = await runLpac(lpac, portArg(url), ["notification", "list"], 60000, { aid });
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/lpac-notifications-process" && req.method === "POST") {
    if (process.env.ALLOW_PROFILE_NOTIFICATIONS !== "1") {
      sendJson(res, 403, { ok: false, error: "Notification processing is disabled. Start eSIM management first." });
      return;
    }
    const body = JSON.parse(await readBody(req) || "{}");
    const aid = requestedAid(url, body);
    if (!aid || String(body.confirm || "").toUpperCase() !== "PROCESS") {
      sendJson(res, 400, { ok: false, error: "Confirm PROCESS before sending profile notifications." });
      return;
    }
    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }
    const result = await runLpac(lpac, portArg(url), ["notification", "process", "-a", "-r"], 180000, { aid });
    sendJson(res, result.ok ? 200 : 502, result);
    return;
  }

  if (url.pathname === "/api/lpac-profile-download" && req.method === "POST") {
    if (process.env.ALLOW_PROFILE_DOWNLOAD !== "1") {
      sendJson(res, 403, { ok: false, error: "Profile download is disabled. Start the local download launcher first." });
      return;
    }

    const body = JSON.parse(await readBody(req) || "{}");
    const aid = requestedAid(url, body);
    const code = activationCode(body.activationCode);
    if (!aid || !code || String(body.confirm || "").toUpperCase() !== "DOWNLOAD") {
      sendJson(res, 400, { ok: false, error: "Enter a complete LPA:1 activation code and confirm DOWNLOAD." });
      return;
    }

    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }

    const result = redactResult(
      await runLpac(lpac, portArg(url), ["profile", "download", "-a", code], 300000, { aid }),
      code,
    );
    sendJson(res, result.ok ? 200 : 502, result);
    return;
  }

  sendJson(res, 404, { ok: false, error: "Unknown API" });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch((error) => {
      console.error(error.stack || error.message);
      sendJson(res, 500, { ok: false, error: error.message || "The local operation failed." });
    });
    return;
  }

  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const resolved = path.resolve(publicDir, `.${requestPath}`);
  if (!resolved.startsWith(publicDir)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  sendFile(res, resolved);
});

function startServer() {
  if (server.listening) return Promise.resolve(server);
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      console.log(`DJI 4G Assistant running on http://127.0.0.1:${port}`);
      console.log("");
      if (host !== "127.0.0.1") {
        console.log("Open this in any browser on this Windows PC, or from a trusted device on the same LAN:");
        console.log(primaryConsoleUrl());
        for (const ip of localIps()) console.log(`LAN: http://${ip}:${port}`);
      }
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { server, startServer, localIps, primaryConsoleUrl, buildSmsPdus, parseClcc, buildCallAction, normalizeIsdrAid, parseLpacData, mergeEuiccRecords, inventoryCandidateAids };
