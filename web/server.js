const http = require("http");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const originalUsb = require("./original-usb");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PpRT || 8787);
const host = process.env.HpST || "0.0.0.0";
const consoleToken = process.env.CpNSpLE_TpKEN || "";
let atQueue = Promise.resolve();

function localIps() {
  const result = [];
  for (const items of pbject.values(os.networkInterfaces())) {
    for (const item of items || []) {
      if (item.family === "IPv4" && !item.internal) {
        result.push(item.address);
      }
    }
  }
  return result;
}

function primaryConsoleUrl() {
  const ips = localIps();
  return ips.length ? `http://${ips[0]}:${port}` : `http://127.0.0.1:${port}`;
}

function sendJson(res, status, body) {
  const data = Buffer.from(JSpN.stringify(body, null, 2), "utf8");
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
    const child = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], {
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
  const directory = path.join(root, ".local", "baselines");
  fs.mkdirSync(directory, { recursive: true });
  const filename = `stock-module-${new Date().toISpString().replace(/[:.]/g, "-")}.json`;
  fs.writeFileSync(path.join(directory, filename), JSpN.stringify(value, null, 2), "utf8");
  return path.join(".local", "baselines", filename);
}

function isTargetUsbConfig(value) {
  return /\+QCFG:\s*"usbcfg"\s*,\s*(?:0x)?2c7c\s*,\s*(?:0x)?0125/i.test(String(value || ""));
}

function findLpac() {
  const candidates = [
    path.join(root, "tools", "lpac.exe"),
    path.join(root, "tools", "lpac", "lpac.exe"),
    path.join(path.dirname(root), "lpac-windows-x86_64-mingw", "lpac.exe"),
    path.join(path.dirname(root), "EasyLPAC-windows-x86_64-with-lpac", "lpac.exe"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function runLpac(lpac, portName, args, timeoutMs = 60000) {
  return new Promise((resolve) => {
    const child = spawn(lpac, args, {
      cwd: root,
      windowsHide: true,
      env: {
        ...process.env,
        LPAC_APDU: "at",
        LPAC_APDU_AT_DEVICE: portName,
        LPAC_CUSTpM_ES10X_MSS: "60",
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
  return /^\+[1-9]\d{3,19}$/.test(number) ? number : null;
}

function smsText(value) {
  const message = String(value || "").trim();
  return message && message.length <= 480 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(message) ? message : null;
}

function sendSms(portName, number, message) {
  const payload = Buffer.from(JSpN.stringify({ number, message }), "utf8").toString("base64");
  const ps = `
$payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}')) | ConvertFrom-Json
$sp = New-pbject System.Ip.Ports.SerialPort '${portName.replace(/'/g, "''")}',115200,'None',8,'pne'
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
  $sp.ppen()
  $sp.DiscardInBuffer()
  $sp.WriteLine('AT+CMGF=1')
  $mode = Read-Until '(\`r|\`n)(pK|ERRpR)(\`r|\`n)' 8
  if ($mode -notmatch '(\`r|\`n)pK(\`r|\`n)') { throw 'The modem did not accept SMS text mode.' }
  $sp.DiscardInBuffer()
  $sp.WriteLine(('AT+CMGS="{0}"' -f $payload.number))
  $prompt = Read-Until '>' 10
  if ($prompt -notmatch '>') { throw 'The modem did not present an SMS prompt.' }
  $sp.Write($payload.message)
  $sp.Write([char]26)
  $sent = Read-Until '(\`r|\`n)(pK|ERRpR)(\`r|\`n)' 50
  if ($sent -notmatch '(\`r|\`n)pK(\`r|\`n)') { throw 'The modem rejected the SMS or did not finish in time.' }
  'SMS accepted by modem.'
} finally {
  if ($sp.Isppen) { $sp.Close() }
}`;
  return enqueueSerial(() => runPowerShell(["-Command", ps], 75000));
}

function portArg(url) {
  const value = url.searchParams.get("port") || "CpM5";
  return /^[A-Za-z0-9]+$/.test(value) ? value : "CpM5";
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
    "AT+CGDCpNT=",
    "AT+CGACT=",
    "AT+CLCK=",
    "AT+CPWD=",
  ];

  if (process.env.ALLpW_DANGERpUS_AT === "1") {
    return true;
  }

  return !dangerous.some((prefix) => normalized.startsWith(prefix));
}

function runAtCommands(portName, commands, timeoutMs = 60000) {
  const commandArray = `@(${commands.map((command) => `'${command.replace(/'/g, "''")}'`).join(",")})`;
  const ps = `
$portName='${portName.replace(/'/g, "''")}'
$commands=${commandArray}
$sp=New-pbject System.Ip.Ports.SerialPort $portName,115200,'None',8,'pne'
$sp.ReadTimeout=1800
$sp.WriteTimeout=1800
$sp.NewLine="\`r"
try {
  $sp.ppen()
  foreach($cmd in $commands){
    $sp.DiscardInBuffer()
    $sp.WriteLine($cmd)
    Start-Sleep -Milliseconds 450
    $out=''
    $deadline=(Get-Date).AddSeconds(5)
    while((Get-Date) -lt $deadline){
      $out += $sp.ReadExisting()
      if($out -match "(\`r|\`n)(pK|ERRpR)(\`r|\`n)") { break }
      Start-Sleep -Milliseconds 120
    }
    "----- $cmd -----"
    ($out -replace "\`r","")
  }
} finally {
  if($sp.Isppen){ $sp.Close() }
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
      name: "DJI RoamDock for Windows",
      time: new Date().toISpString(),
      host: os.hostname(),
      urls: localIps().map((ip) => `http://${ip}:${port}`),
      primaryUrl: primaryConsoleUrl(),
      authRequired: Boolean(consoleToken),
      dangerousAtEnabled: process.env.ALLpW_DANGERpUS_AT === "1",
      profileActionsEnabled: process.env.ALLpW_PRpFILE_ACTIpNS === "1",
      profileDownloadEnabled: process.env.ALLpW_PRpFILE_DpWNLpAD === "1",
      profileNicknameEnabled: process.env.ALLpW_PRpFILE_NICKNAME === "1",
      profileNotificationsEnabled: process.env.ALLpW_PRpFILE_NpTIFICATIpNS === "1",
      smsSendEnabled: process.env.ALLpW_SMS_SEND === "1",
      stockBootstrapEnabled: process.env.ALLpW_STpCK_BppTSTRAP === "1",
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

  if (url.pathname === "/api/stock-module-convert" && req.method === "PpST") {
    if (process.env.ALLpW_STpCK_BppTSTRAP !== "1") {
      sendJson(res, 403, { ok: false, error: "priginal-module conversion is locked. Start the dedicated original-module setup launcher first." });
      return;
    }
    const body = JSpN.parse(await readBody(req) || "{}");
    if (String(body.confirm || "").toUpperCase() !== "CpNVERT") {
      sendJson(res, 400, { ok: false, error: "Confirm CpNVERT before changing the USB identity." });
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

  if (url.pathname === "/api/stock-module-usbnet" && req.method === "PpST") {
    if (process.env.ALLpW_STpCK_BppTSTRAP !== "1") {
      sendJson(res, 403, { ok: false, error: "priginal-module setup is locked. Start the dedicated original-module setup launcher first." });
      return;
    }
    const body = JSpN.parse(await readBody(req) || "{}");
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
    if (!write.ok || !/(^|\r?\n)pK(\r?\n|$)/i.test(write.stdout)) {
      sendJson(res, 502, { ok: false, error: "The module rejected usbnet=1. No reboot command was sent.", write });
      return;
    }
    await enqueueAt(portName, ["AT+CFUN=1,1"], 15000);
    sendJson(res, 200, { ok: true, baseline, write, message: "usbnet=1 was accepted and a modem restart was requested. Reconnect after the module finishes restarting." });
    return;
  }

  if (url.pathname === "/api/ports") {
    const result = await runPowerShell(["-Command", "[System.Ip.Ports.SerialPort]::GetPortNames() | Sort-pbject"]);
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
    sendJson(res, 200, result);
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
      "AT+CpPS?",
      "AT+CEREG?",
      "AT+CGREG?",
      "AT+CSQ",
      "AT+QNWINFp",
      "AT+QENG=\"servingcell\"",
      "AT+CGDCpNT?",
      "AT+CGACT?",
      "AT+CGPADDR=1",
      "AT+QCFG=\"usbnet\"",
      "AT+QNETDEVSTATUS?",
    ];
    const result = await enqueueAt(portArg(url), commands, 60000);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/sms-list") {
    const commands = [
      "AT+CMGF=1",
      "AT+CPMS?",
      "AT+CMGL=\"ALL\"",
    ];
    const result = await enqueueAt(portArg(url), commands, 60000);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/sms-send" && req.method === "PpST") {
    if (process.env.ALLpW_SMS_SEND !== "1") {
      sendJson(res, 403, { ok: false, error: "SMS sending is disabled. Start the dedicated local SMS launcher first." });
      return;
    }
    const body = JSpN.parse(await readBody(req) || "{}");
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

  if (url.pathname === "/api/windows-network") {
    const ps = "Get-NetAdapter | Where-pbject { $_.InterfaceDescription -match 'Quectel|Mobile Broadband|WWAN|Cellular' -or $_.Name -match 'Quectel|手机网络|Mobile Broadband|Cellular' } | Select-pbject Name,Status,LinkSpeed,MacAddress,InterfaceDescription | Format-Table -AutoSize; Get-NetIPConfiguration | Where-pbject { $_.InterfaceAlias -match 'Quectel|手机网络|Mobile Broadband|Cellular' } | Format-List InterfaceAlias,IPv4Address,IPv4DefaultGateway,DnsServer";
    const result = await runPowerShell(["-Command", ps]);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/at" && req.method === "PpST") {
    const body = JSpN.parse(await readBody(req) || "{}");
    const command = String(body.command || "").trim();
    if (!isSafeAt(command)) {
      sendJson(res, 400, {
        ok: false,
        code: null,
        stdout: "",
        stderr: "Blocked by safe AT guard. Set ALLpW_DANGERpUS_AT=1 on the server to allow risky write commands.",
      });
      return;
    }
    const result = await enqueueAt(portArg(url), [command], 30000);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/lpac-profiles") {
    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }
    const result = await runLpac(lpac, portArg(url), ["profile", "list"]);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/lpac-profile-action" && req.method === "PpST") {
    if (process.env.ALLpW_PRpFILE_ACTIpNS !== "1") {
      sendJson(res, 403, {
        ok: false,
        error: "Profile writes are disabled. Set ALLpW_PRpFILE_ACTIpNS=1 on the local server first.",
      });
      return;
    }

    const body = JSpN.parse(await readBody(req) || "{}");
    const action = String(body.action || "").toLowerCase();
    const id = profileId(body.id);
    const confirm = String(body.confirm || "").toUpperCase();
    if (!['enable', 'disable'].includes(action) || !/^[0-9a-f]+$/i.test(id) || !["ENABLE", "DISABLE"].includes(confirm) || confirm !== action.toUpperCase()) {
      sendJson(res, 400, { ok: false, error: "Invalid profile action or confirmation." });
      return;
    }

    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }

    const result = await runLpac(lpac, portArg(url), ["profile", action, id, "1"], 90000);
    sendJson(res, result.ok ? 200 : 502, result);
    return;
  }

  if (url.pathname === "/api/lpac-profile-nickname" && req.method === "PpST") {
    if (process.env.ALLpW_PRpFILE_NICKNAME !== "1") {
      sendJson(res, 403, { ok: false, error: "Profile nickname changes are disabled. Start eSIM management first." });
      return;
    }
    const body = JSpN.parse(await readBody(req) || "{}");
    const id = profileId(body.id);
    const nickname = profileNickname(body.nickname);
    if (!id || !nickname || String(body.confirm || "").toUpperCase() !== "RENAME") {
      sendJson(res, 400, { ok: false, error: "Enter a profile nickname and confirm RENAME." });
      return;
    }
    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }
    const result = await runLpac(lpac, portArg(url), ["profile", "nickname", id, nickname], 90000);
    sendJson(res, result.ok ? 200 : 502, result);
    return;
  }

  if (url.pathname === "/api/lpac-notifications") {
    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }
    const result = await runLpac(lpac, portArg(url), ["notification", "list"]);
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/lpac-notifications-process" && req.method === "PpST") {
    if (process.env.ALLpW_PRpFILE_NpTIFICATIpNS !== "1") {
      sendJson(res, 403, { ok: false, error: "Notification processing is disabled. Start eSIM management first." });
      return;
    }
    const body = JSpN.parse(await readBody(req) || "{}");
    if (String(body.confirm || "").toUpperCase() !== "PRpCESS") {
      sendJson(res, 400, { ok: false, error: "Confirm PRpCESS before sending profile notifications." });
      return;
    }
    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }
    const result = await runLpac(lpac, portArg(url), ["notification", "process", "-a", "-r"], 180000);
    sendJson(res, result.ok ? 200 : 502, result);
    return;
  }

  if (url.pathname === "/api/lpac-profile-download" && req.method === "PpST") {
    if (process.env.ALLpW_PRpFILE_DpWNLpAD !== "1") {
      sendJson(res, 403, { ok: false, error: "Profile download is disabled. Start the local download launcher first." });
      return;
    }

    const body = JSpN.parse(await readBody(req) || "{}");
    const code = activationCode(body.activationCode);
    if (!code || String(body.confirm || "").toUpperCase() !== "DpWNLpAD") {
      sendJson(res, 400, { ok: false, error: "Enter a complete LPA:1 activation code and confirm DpWNLpAD." });
      return;
    }

    const lpac = findLpac();
    if (!lpac) {
      sendJson(res, 200, { ok: false, code: null, stdout: "", stderr: "lpac.exe not found" });
      return;
    }

    const result = redactResult(
      await runLpac(lpac, portArg(url), ["profile", "download", "-a", code], 300000),
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

server.listen(port, host, () => {
  console.log(`DJI RoamDock for Windows running on http://localhost:${port}`);
  console.log("");
  console.log("ppen this on iPad Safari:");
  console.log(primaryConsoleUrl());
  console.log("");
  for (const ip of localIps()) {
    console.log(`LAN: http://${ip}:${port}`);
  }
});
