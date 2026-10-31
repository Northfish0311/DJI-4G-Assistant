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
  "  try {",
  "    & ([scriptblock]::Create($code)) 2>&1 | ForEach-Object {",
  "      if ($_ -is [System.Management.Automation.ErrorRecord]) { [void]$errLines.Add(($_ | Out-String)) }",
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

function createPowerShellHost({ command = "powershell", timeoutMs = 120000 } = {}) {
  const queue = [];
  let child = null;
  let active = null;
  let sequence = 0;

  const settle = (job, result) => {
    if (!job || job.settled) return;
    job.settled = true;
    clearTimeout(job.timer);
    job.resolve(result);
  };

  const discardChild = () => {
    const proc = child;
    child = null;
    if (proc) {
      try { proc.kill(); } catch {}
    }
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
    proc.stdout.on("data", onStdout);
    // The host's own stderr carries CLIXML progress noise, never job output.
    proc.stderr.on("data", () => {});
    proc.on("error", () => {
      if (child !== proc) return; // a superseded host failing must not fail the new job
      child = null;
      failActive("PowerShell host could not start.");
      scheduleDrain();
    });
    proc.on("exit", () => {
      if (child !== proc) return;
      child = null;
      failActive("PowerShell host exited before answering.");
      scheduleDrain();
    });
    child = proc;
    return proc;
  };

  function drain() {
    if (active || !queue.length) return;
    const job = queue.shift();
    const proc = ensureChild();
    active = job;
    job.timer = setTimeout(() => {
      // A wedged host must not poison later requests: drop it, fail this job, respawn.
      if (active === job) {
        active = null;
        discardChild();
        settle(job, { ok: false, code: null, stdout: job.stdout, stderr: `Timed out after ${job.timeoutMs}ms` });
        scheduleDrain();
      }
    }, job.timeoutMs);
    try {
      proc.stdin.write(`${job.id}|${Buffer.from(job.command, "utf8").toString("base64")}\n`);
    } catch (error) {
      active = null;
      discardChild();
      settle(job, { ok: false, code: null, stdout: "", stderr: `PowerShell host is not writable (${error.code || error.message}).` });
      scheduleDrain();
    }
  }

  function scheduleDrain() {
    setImmediate(drain);
  }

  return {
    run(commandBody, jobTimeoutMs = timeoutMs) {
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
      return queue.length + (active ? 1 : 0);
    },
    dispose() {
      discardChild();
    },
  };
}

module.exports = { createPowerShellHost, HOST_SCRIPT };
