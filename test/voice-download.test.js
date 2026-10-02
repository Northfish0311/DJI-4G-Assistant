const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const { downloadRuntime } = require("../web/voice-runtime");

async function fixture(run, handler) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "voice-download-"));
  const server = http.createServer(handler);
  const sockets = new Set();
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const data = Buffer.from("verified sample voice runtime");
  const file = { name: "test.ko", size: data.length, sha256: crypto.createHash("sha256").update(data).digest("hex"), mode: 0o100644 };
  try { await run({ directory, data, options: { files: [file], baseUrl: "http://127.0.0.1:" + server.address().port + "/", request: http.get, addresses: ["127.0.0.1"], timeoutMs: 500 } }); }
  finally { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); }
}
test("downloads, verifies, reports progress and reuses a verified file", async () => {
  let requests = 0;
  await fixture(async ({ directory, data, options }) => {
    const progress = [];
    await downloadRuntime(directory, { ...options, onProgress: value => progress.push(value) });
    assert.deepEqual(fs.readFileSync(path.join(directory, "test.ko")), data);
    assert.equal(progress.at(-1).receivedBytes, data.length);
    await downloadRuntime(directory, options);
    assert.equal(requests, 1);
  }, (_req, res) => { requests++; res.end("verified sample voice runtime"); });
});
test("retries a transport reset without weakening verification", async () => {
  let requests = 0;
  await fixture(async ({ directory, options }) => {
    await downloadRuntime(directory, options);
    assert.equal(requests, 2);
    assert.equal(fs.existsSync(path.join(directory, "test.ko.download")), false);
  }, (req, res) => { requests++; if (requests === 1) req.socket.destroy(); else res.end("verified sample voice runtime"); });
});
test("rejects checksum mismatch and deletes partial output", async () => {
  await fixture(async ({ directory, options }) => {
    await assert.rejects(downloadRuntime(directory, options), { code: "VOICE_DOWNLOAD_INTEGRITY" });
    assert.deepEqual(fs.readdirSync(directory), []);
  }, (_req, res) => res.end("x".repeat(Buffer.byteLength("verified sample voice runtime"))));
});
test("an incomplete response has an absolute deadline and can be retried", async () => {
  await fixture(async ({ directory, options }) => {
    await assert.rejects(downloadRuntime(directory, options), { code: "VOICE_DOWNLOAD_NETWORK" });
    assert.deepEqual(fs.readdirSync(directory), []);
  }, (_req, res) => { res.writeHead(200); res.write("verified"); });
});
test("an HTTP 404 is explicit and is not retried indefinitely", async () => {
  let requests = 0;
  await fixture(async ({ directory, options }) => {
    await assert.rejects(downloadRuntime(directory, options), { code: "VOICE_DOWNLOAD_HTTP" });
    assert.deepEqual(fs.readdirSync(directory), []);
  }, (_req, res) => { requests++; res.writeHead(404); res.end(); });
  assert.equal(requests, 1);
});
