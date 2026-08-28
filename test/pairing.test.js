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
  os.networkInterfaces = () => ({
    WLAN: [{ family: "IPv4", internal: false, address: "192.168.50.20" }],
  });
  process.env.PORT = String(port);
  process.env.HOST = "127.0.0.1";
  process.env.CONSOLE_TOKEN = "test_console_token_abcdefghijklmnopqrstuvwxyz";
  const { server, startServer } = require("../web/server");

  try {
    await startServer();
    const unauthorized = await fetch(`http://127.0.0.1:${port}/api/pairing`);
    assert.equal(unauthorized.status, 401);

    const response = await fetch(`http://127.0.0.1:${port}/api/pairing`, {
      headers: { "x-console-token": process.env.CONSOLE_TOKEN },
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.url, `http://192.168.50.20:${port}`);
    assert.match(payload.qrDataUrl, /^data:image\/png;base64,/);
    assert.equal(new URL(payload.deepLink).searchParams.get("token"), process.env.CONSOLE_TOKEN);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    os.networkInterfaces = originalInterfaces;
  }
});
