const { spawn } = require("child_process");

// A resident PowerShell host. Every request used to pay ~400 ms to start
// powershell.exe, which dominated call-status (460 ms) and module reads (719 ms).
// The host keeps one process and feeds it jobs over stdin, framed as
//
//   <id>|<base64 utf8 command>\n
//
// and answers with three framed sections:
//
//   <<<B:<id>>>\n<stdout>\n<<<X:<id>>>\n<stderr>\n<<<E:<id>:<exit>>>\n
//
// The script is ASCII only and carries no backticks so the caller can rebuild the
// same command strings it already sends to `powershell -Command`.
const HOST_SCRIPT = [
  "$ProgressPreference = 'SilentlyContinue'",
  "$ErrorActionPreference = 'Continue'",
  "[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)",
  "while ($true) {",
  "  $line = [Console]::In.ReadLine()",
  "  if ($null -eq $line) { break }",
  "  if ($line.Length -eq 0) { continue }",
  "  $sep = $line.IndexOf('|')",
  "  if ($sep -lt 1) { continue }",
  "  $id = $line.Substring(0, $sep)",
  "  $code = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($line.Substring($sep + 1)))",
  "  $outLines = New-Object System.Collections.ArrayList",
  "  $errLines = New-Object System.Collections.ArrayList",
  "  $exit = 0",
  "  $global:LASTEXITCODE = 0",
  "  try {",
  // *>&1 also routes Write-Host through the pipeline: scripts such as find-at-port.ps1
  // report AT_PORT=COMx with Write-Host, which would otherwise bypass the frame.
  "    & ([scriptblock]::Create($code)) *>&1 | ForEach-Object {",
  "      if ($_ -is [System.Management.Automation.ErrorRecord]) { [void]$errLines.Add(($_ | Out-String)) }",
  "      elseif ($_ -is [System.Management.Automation.InformationRecord]) { [void]$outLines.Add([string]$_.MessageData) }",
  "      else { [void]$outLines.Add([string]$_) }",
  "    }",
  "    if ($null -ne $LASTEXITCODE) { $exit = [int]$LASTEXITCODE }",
  "  } catch {",
  "    [void]$errLines.Add(($_ | Out-String))",
  "    $exit = 1",
  "  }",
  "  [Console]::Out.Write('<<<B:' + $id + '>>>' + [char]10)",
  "  [Console]::Out.Write(($outLines -join [char]10))",
  "  [Console]::Out.Write([char]10 + '<<<X:' + $id + '>>>' + [char]10)",
  "  [Console]::Out.Write(($errLines -join [char]10))",
  "  [Console]::Out.Write([char]10 + '<<<E:' + $id + ':' + $exit + '>>>' + [char]10)",
  "  [Console]::Out.Flush()",
  "}",
].join("\n");

function createPowerShellHost({ command = "powershell", timeoutMs = 120000, cleanupTimeoutMs = 5000 } = {}) {
  const queue = [];
  let child = null;
  let active = null;
  let sequence = 0;
  let retiring = null;
  let disposed = false;
  let cleanupError = "";

  const settle = (job, result) => {
    if (!job || job.settled) return;
    job.settled = true;
    clearTimeout(job.timer);
    job.resolve(result);
  };

  const failure = (message, stdout = "") => ({ ok: false, code: null, stdout, stderr: message });

  const endProcessTree = (proc) => new Promise((resolve) => {
    if (!proc || typeof proc.pid !== "number") { resolve(true); return; }
    let closed = proc.exitCode != null || proc.signalCode != null;
    let treeStopped = process.platform !== "win32";
    let finished = false;
    let killer = null;
    const finish = (ok) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      proc.off("close", onClose);
      resolve(ok);
    };
    const check = () => { if (closed && treeStopped) finish(true); };
    const onClose = () => { closed = true; check(); };
    const fail = () => {
      try { proc.kill(); } catch {}
      finish(false);
    };
    const timer = setTimeout(() => {
      try { killer?.kill(); } catch {}
      fail();
    }, cleanupTimeoutMs);
    proc.once("close", onClose);
    try {
      if (process.platform === "win32") {
        killer = spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
        killer.once("error", fail);
        killer.once("close", (code) => {
          if (finished) return;
          // 128 is taskkill's "process not found": the host already exited by itself, which
          // is a clean outcome. Treating it as failure would latch cleanupError and disable
          // every later request until the assistant is restarted.
          if (code !== 0 && code !== 128) { fail(); return; }
          treeStopped = true;
          check();
        });
      } else {
        proc.kill();
        check();
      }
    } catch { fail(); }
  });

  const failWaiting = (message) => {
    for (const job of queue.splice(0)) settle(job, failure(message));
  };

  const retireChild = (proc, message) => {
    if (child !== proc) return retiring || Promise.resolve();
    const job = active;
    clearTimeout(job?.timer);
    child = null;
    // Keep the caller (and its serial lock) waiting until the entire old tree is gone.
    retiring = endProcessTree(proc).then((stopped) => {
      if (!stopped) cleanupError = "A previous Windows command could not be stopped. Exit and reopen the assistant before retrying.";
      if (active === job) active = null;
      settle(job, failure(cleanupError || message, job?.stdout || ""));
      if (cleanupError) failWaiting(cleanupError);
    }).finally(() => {
      retiring = null;
      scheduleDrain();
    });
    return retiring;
  };

  const failActive = (message) => {
    const job = active;
    active = null;
    if (!job) return;
    settle(job, { ok: false, code: null, stdout: job.stdout, stderr: message });
  };

  const onStdout = (chunk) => {
    const job = active;
    if (!job) return;
    job.buffer += chunk;
    const beginTag = `<<<B:${job.id}>>>\n`;
    const midTag = `<<<X:${job.id}>>>\n`;
    const endHead = `<<<E:${job.id}:`;
    const begin = job.buffer.indexOf(beginTag);
    if (begin < 0) return;
    const mid = job.buffer.indexOf(midTag, begin + beginTag.length);
    if (mid < 0) return;
    const end = job.buffer.indexOf(endHead, mid + midTag.length);
    if (end < 0) return;
    const close = job.buffer.indexOf(">>>", end + endHead.length);
    if (close < 0) return;

    job.stdout = job.buffer.slice(begin + beginTag.length, mid);
    const stderr = job.buffer.slice(mid + midTag.length, end);
    const code = Number(job.buffer.slice(end + endHead.length, close));
    active = null;
    settle(job, {
      ok: code === 0,
      code: Number.isFinite(code) ? code : null,
      stdout: job.stdout.endsWith("\n") ? job.stdout.slice(0, -1) : job.stdout,
      stderr: stderr.endsWith("\n") ? stderr.slice(0, -1) : stderr,
    });
    drain();
  };

  const ensureChild = () => {
    if (child && !child.killed) return child;
    const encoded = Buffer.from(HOST_SCRIPT, "utf16le").toString("base64");
    const proc = spawn(command, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], {
      windowsHide: true,
    });
    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (chunk) => { if (child === proc) onStdout(chunk); });
    // The host's own stderr carries CLIXML progress noise, never job output.
    proc.stderr.on("data", () => {});
    const onPipeError = (error) => {
      retireChild(proc, `PowerShell host pipe failed (${error.code || "IO_ERROR"}).`);
    };
    proc.stdin.on("error", onPipeError);
    proc.stdout.on("error", onPipeError);
    proc.stderr.on("error", onPipeError);
    proc.on("error", () => {
      if (child !== proc) return; // a superseded host failing must not fail the new job
      child = null;
      failActive("PowerShell host could not start.");
      scheduleDrain();
    });
    proc.on("close", () => {
      if (child !== proc) return;
      child = null;
      failActive("PowerShell host exited before answering.");
      scheduleDrain();
    });
    child = proc;
    return proc;
  };

  function drain() {
    if (active || retiring || disposed || cleanupError || !queue.length) return;
    const job = queue.shift();
    active = job;
    let proc;
    try { proc = ensureChild(); }
    catch { failActive("PowerShell host could not start."); scheduleDrain(); return; }
    job.timer = setTimeout(() => {
      if (active === job) {
        retireChild(proc, `Timed out after ${job.timeoutMs}ms`);
      }
    }, job.timeoutMs);
    try {
      proc.stdin.write(`${job.id}|${Buffer.from(job.command, "utf8").toString("base64")}\n`, (error) => {
        if (error && active === job) retireChild(proc, `PowerShell host is not writable (${error.code || "IO_ERROR"}).`);
      });
    } catch (error) {
      retireChild(proc, `PowerShell host is not writable (${error.code || "IO_ERROR"}).`);
    }
  }

  function scheduleDrain() {
    setImmediate(drain);
  }

  return {
    run(commandBody, jobTimeoutMs = timeoutMs) {
      if (disposed || cleanupError) return Promise.resolve(failure(cleanupError || "PowerShell host was closed."));
      return new Promise((resolve) => {
        queue.push({
          id: String(++sequence),
          command: commandBody,
          timeoutMs: jobTimeoutMs,
          resolve,
          buffer: "",
          stdout: "",
          settled: false,
          timer: null,
        });
        drain();
      });
    },
    pending() {
      return queue.length + (active || retiring ? 1 : 0);
    },
    blockedReason() {
      return cleanupError;
    },
    dispose() {
      disposed = true;
      failWaiting("PowerShell host was closed.");
      if (retiring) return retiring;
      return child ? retireChild(child, "PowerShell host was closed.") : Promise.resolve();
    },
  };
}

module.exports = { createPowerShellHost, HOST_SCRIPT };
