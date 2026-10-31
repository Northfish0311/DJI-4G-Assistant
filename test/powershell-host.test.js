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
    host.dispose();
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
    host.dispose();
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
    host.dispose();
  }
});
