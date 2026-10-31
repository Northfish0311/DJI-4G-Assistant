const test = require("node:test");
const assert = require("node:assert/strict");
const { createPowerShellHost } = require("../web/powershell-host");

const windowsOnly = { skip: process.platform !== "win32" ? "Windows PowerShell is required" : false };

test("the resident host answers consecutive jobs without restarting", windowsOnly, async () => {
  const host = createPowerShellHost();
  try {
    const first = await host.run("Write-Output 'one'", 20000);
    assert.equal(first.ok, true);
    assert.equal(first.stdout.trim(), "one");

    const second = await host.run("Write-Output 'two'", 20000);
    assert.equal(second.ok, true);
    assert.equal(second.stdout.trim(), "two");
    assert.equal(host.pending(), 0);
  } finally {
    await host.dispose();
  }
});

test("the resident host keeps stdout and stderr apart and reports the exit code", windowsOnly, async () => {
  const host = createPowerShellHost();
  try {
    const mixed = await host.run("Write-Output 'out'; Write-Error 'bad input'; Write-Output 'tail'", 20000);
    assert.equal(mixed.ok, true);
    assert.match(mixed.stdout, /^out$/m);
    assert.match(mixed.stdout, /^tail$/m);
    assert.match(mixed.stderr, /bad input/);
    assert.doesNotMatch(mixed.stdout, /bad input/);

    const failing = await host.run("cmd /c exit 3", 20000);
    assert.equal(failing.ok, false);
    assert.equal(failing.code, 3);
  } finally {
    await host.dispose();
  }
});

test("a timed-out job fails alone and the next job runs on a fresh host", windowsOnly, async () => {
  const host = createPowerShellHost();
  try {
    const timedOut = await host.run("Start-Sleep -Seconds 5", 300);
    assert.equal(timedOut.ok, false);
    assert.match(timedOut.stderr, /Timed out after 300ms/);

    const recovered = await host.run("Write-Output 'alive'", 20000);
    assert.equal(recovered.ok, true);
    assert.equal(recovered.stdout.trim(), "alive");
  } finally {
    await host.dispose();
  }
});

test("Write-Host output reaches the caller, so port scans can report AT_PORT", windowsOnly, async () => {
  const host = createPowerShellHost();
  try {
    // find-at-port.ps1 reports everything with Write-Host; it must not bypass the frame.
    const scan = await host.run([
      "Write-Host '----- COM3 -----'",
      "Write-Host 'AT response: OK'",
      "Write-Host 'AT_PORT=COM3'",
    ].join("; "), 20000);
    assert.equal(scan.ok, true);
    assert.match(scan.stdout, /AT_PORT=COM3/);
    assert.match(scan.stdout, /AT response: OK/);
  } finally {
    await host.dispose();
  }
});

test("a failed exit code does not leak into the next job", windowsOnly, async () => {
  const host = createPowerShellHost();
  try {
    const failing = await host.run("cmd /c exit 3", 20000);
    assert.equal(failing.ok, false);
    assert.equal(failing.code, 3);

    // A plain PowerShell statement sets no exit code of its own; it must not inherit 3.
    const plain = await host.run("Write-Output 'second job'", 20000);
    assert.equal(plain.ok, true);
    assert.equal(plain.code, 0);
    assert.equal(plain.stdout.trim(), "second job");

    const scripted = await host.run("& { Write-Output 'script ran' }", 20000);
    assert.equal(scripted.ok, true);
  } finally {
    await host.dispose();
  }
});

test("a timed-out host releases its real Windows child before reporting completion", windowsOnly, async () => {
  const host = createPowerShellHost();
  let childPid = null;
  try {
    const started = await host.run([
      "$child = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe')",
      "-ArgumentList '-NoProfile','-NonInteractive','-Command','Start-Sleep -Seconds 30'",
      "-WindowStyle Hidden -PassThru; $child.Id",
    ].join(" "), 20000);
    assert.equal(started.ok, true);
    childPid = Number(started.stdout.trim());
    assert.ok(Number.isSafeInteger(childPid) && childPid > 0);
    assert.doesNotThrow(() => process.kill(childPid, 0));
    const result = await host.run("Start-Sleep -Seconds 5", 300);
    assert.equal(result.ok, false);
    assert.match(result.stderr, /Timed out after 300ms/);
    assert.throws(() => process.kill(childPid, 0), { code: "ESRCH" });
    const recovered = await host.run("Write-Output 'ready'", 20000);
    assert.equal(recovered.ok, true);
    assert.equal(recovered.stdout.trim(), "ready");
  } finally {
    await host.dispose();
    if (Number.isSafeInteger(childPid) && childPid > 0) {
      try { process.kill(childPid); } catch (error) { if (error.code !== "ESRCH") throw error; }
    }
  }
});

