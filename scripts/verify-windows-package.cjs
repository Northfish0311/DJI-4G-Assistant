const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");

async function smoke() {
  const resources = process.env.ROAMDOCK_RESOURCE_ROOT;
  const app = path.join(resources, "app.asar");
  const expected = process.env.PACKAGE_EXPECTED_VERSION;
  assert.equal(require(path.join(app, "package.json")).version, expected);
  const exe = path.join(resources, "tools", "lpac", "lpac.exe");
  assert.ok(fs.statSync(exe).size > 0, "The package must include lpac.exe");
  assert.equal(fs.readFileSync(exe).subarray(0, 2).toString("ascii"), "MZ", "Bundled lpac must be a Windows executable");
  const {server, startServer} = require(path.join(app, "web", "server.js"));
  try {
    await startServer();
    const base = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(`${base}/api/health`).then(reply => reply.json());
    assert.equal(health.ok, true);
    assert.equal(health.authRequired, true);
    for (const [key, value] of Object.entries(health)) if (key.endsWith("Enabled")) assert.equal(value, false);
    for (const route of ["/", "/i18n.js", "/core.js", "/euicc.js", "/sms.js", "/calls.js", "/audio.js", "/call-flow.js", "/api.js", "/automation.js", "/profile-actions.js", "/init.js", "/desktop-refresh.css", "/vendor/lucide.js"]) {
      const response = await fetch(base + route);assert.equal(response.status, 200, route);
      assert.ok((await response.text()).length > 100, route);
    }
    assert.equal((await fetch(`${base}/api/euicc-inventory`)).status, 401);
    console.log(`Packaged v${expected}: startup, static assets, auth and bundled lpac presence passed; no modem operations.`);
  } finally {
    if (server.listening) await new Promise(resolve => {server.close(resolve);server.closeAllConnections();});
  }
}

if (process.argv.includes("--child")) {
  smoke().catch(error => {console.error(error);process.exitCode = 1;});
} else {
  const root = path.resolve(__dirname, "..");
  const unpacked = path.join(root, "dist", "win-unpacked");
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "dji-package-smoke-"));
  const env = {...process.env, ELECTRON_RUN_AS_NODE: "1", HOST: "127.0.0.1", PORT: "0", CONSOLE_TOKEN: "package-smoke-only", ROAMDOCK_RESOURCE_ROOT: path.join(unpacked, "resources"), ROAMDOCK_DATA_ROOT: temporary, PACKAGE_EXPECTED_VERSION: require(path.join(root, "package.json")).version};
  for (const key of Object.keys(env)) if (key.startsWith("ALLOW_")) delete env[key];
  try {
    const result = spawnSync(path.join(unpacked, "DJI 4G Assistant.exe"), [__filename, "--child"], {env, encoding: "utf8", timeout: 60000, windowsHide: true});
    process.stdout.write(result.stdout || "");process.stderr.write(result.stderr || "");
    if (result.error) throw result.error;
    assert.equal(result.status, 0, "Packaged application smoke test failed");
  } finally {
    // This exact directory was created above, not supplied by a user or environment variable.
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}
