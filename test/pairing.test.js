const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const {
  TOKEN_FILE,
  buildPairingDeepLink,
  isValidConsoleToken,
  loadOrCreateConsoleToken,
} = require("../web/pairing");

test("persists one valid console token per Windows installation", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dji4g-pairing-"));
  try {
    const generated = loadOrCreateConsoleToken(directory, () => Buffer.alloc(32, 0xab));
    const reloaded = loadOrCreateConsoleToken(directory, () => {
      throw new Error("A persisted token must be reused.");
    });
    assert.equal(generated, reloaded);
    assert.ok(isValidConsoleToken(generated));
    assert.equal(fs.readFileSync(path.join(directory, TOKEN_FILE), "utf8").trim(), generated);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("replaces a malformed saved token", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dji4g-pairing-invalid-"));
  try {
    fs.writeFileSync(path.join(directory, TOKEN_FILE), "short\n", "utf8");
    const generated = loadOrCreateConsoleToken(directory, () => Buffer.alloc(32, 0xcd));
    assert.ok(isValidConsoleToken(generated));
    assert.notEqual(generated, "short");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("encodes the LAN host and token in the custom iOS pairing link", () => {
  const link = buildPairingDeepLink("http://192.168.5.6:8787", "paired-token");
  const parsed = new URL(link);
  assert.equal(parsed.protocol, "dji4g:");
  assert.equal(parsed.hostname, "pair");
  assert.equal(parsed.searchParams.get("url"), "http://192.168.5.6:8787");
  assert.equal(parsed.searchParams.get("token"), "paired-token");
});

test("pairing API requires authentication and returns a scannable deep link", async () => {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));

  const originalInterfaces = os.networkInterfaces;
  const originalEnvironment = Object.fromEntries(
    ["PORT", "HOST", "CONSOLE_TOKEN"].map((key) => [key, process.env[key]])
  );
  os.networkInterfaces = () => ({
    WLAN: [{ family: "IPv4", internal: false, address: "192.168.50.20" }],
  });
  process.env.PORT = String(port);
  process.env.HOST = "127.0.0.1";
  process.env.CONSOLE_TOKEN = "test_console_token_abcdefghijklmnopqrstuvwxyz";
  const { server, startServer } = require("../web/server");

  try {
    await startServer();
    for (const platform of ["android", "ios"]) {
      const page = await fetch(`http://127.0.0.1:${port}/?native=${platform}`);
      assert.equal(page.status, 200);
      assert.match(page.headers.get("content-type"), /text\/html/);
      assert.match(await page.text(), /id="tokenInput"/);
    }
    for (const asset of ["/app.js", "/styles.css", "/vendor/lucide.js"]) {
      const response = await fetch(`http://127.0.0.1:${port}${asset}`);
      assert.equal(response.status, 200, asset);
      assert.ok((await response.text()).length > 100, asset);
    }
    const unauthorized = await fetch(`http://127.0.0.1:${port}/api/pairing`);
    assert.equal(unauthorized.status, 401);
    assert.equal((await unauthorized.json()).authRequired, true);

    const wrongToken = await fetch(`http://127.0.0.1:${port}/api/pairing`, {
      headers: { "x-console-token": "invalid-token" },
    });
    assert.equal(wrongToken.status, 401);
    assert.ok(!(await wrongToken.text()).includes(process.env.CONSOLE_TOKEN));

    const response = await fetch(`http://127.0.0.1:${port}/api/pairing`, {
      headers: { "x-console-token": process.env.CONSOLE_TOKEN },
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.url, `http://192.168.50.20:${port}`);
    assert.match(payload.qrDataUrl, /^data:image\/png;base64,/);
    assert.equal(new URL(payload.deepLink).searchParams.get("token"), process.env.CONSOLE_TOKEN);

    os.networkInterfaces = () => ({
      Loopback: [{ family: "IPv4", internal: true, address: "127.0.0.1" }],
    });
    const offline = await fetch(`http://127.0.0.1:${port}/api/pairing`, {
      headers: { "x-console-token": process.env.CONSOLE_TOKEN },
    });
    assert.equal(offline.status, 409);
    const offlinePayload = await offline.json();
    assert.equal(offlinePayload.ok, false);
    assert.equal(offlinePayload.qrDataUrl, undefined);

    os.networkInterfaces = () => ({
      WLAN: [{ family: "IPv4", internal: false, address: "192.168.50.21" }],
    });
    const retry = await fetch(`http://127.0.0.1:${port}/api/pairing`, {
      headers: { "x-console-token": process.env.CONSOLE_TOKEN },
    });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).url, `http://192.168.50.21:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    os.networkInterfaces = originalInterfaces;
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
