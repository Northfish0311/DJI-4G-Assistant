const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const http = require("node:http");
const { EventEmitter } = require("node:events");

const source = fs.readFileSync(path.join(__dirname, "../web/server.js"), "utf8");
const logs = [];
const context = vm.createContext({ Buffer, process: { env: {} }, console: { error: (...args) => logs.push(args) } });
vm.runInContext([
  source.slice(source.indexOf("function sendJson("), source.indexOf("function sendFile(")),
  source.slice(source.indexOf("const MAX_BODY_BYTES"), source.indexOf("async function handleApi(")),
  source.slice(source.indexOf("function isSafeAt("), source.indexOf("function runAtCommands(")),
].join("\n"), context);

function parseChunks(chunks) {
  const request = new EventEmitter();
  const result = context.readJsonBody(request);
  for (const chunk of chunks) request.emit("data", Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  request.emit("end");
  return result;
}

test("JSON request decoding preserves UTF-8 characters split across chunks", async () => {
  const payload = Buffer.from(JSON.stringify({ text: "\u77ed\u4fe1\ud83d\udce8" }));
  const parsed = await parseChunks([...payload].map(byte => Buffer.from([byte])));
  assert.equal(parsed.text, "\u77ed\u4fe1\ud83d\udce8");
  assert.equal(Object.keys(await parseChunks(["  "])).length, 0);
});

test("request size limit counts bytes and accepts exactly 20 KiB", async () => {
  const boundary = JSON.stringify({ x: "a".repeat(20480 - 8) });
  assert.equal(Buffer.byteLength(boundary), 20480);
  assert.equal((await parseChunks([boundary])).x.length, 20472);
  await assert.rejects(parseChunks([boundary + " "]), { statusCode: 413, code: "BODY_TOO_LARGE" });
  await assert.rejects(parseChunks([JSON.stringify({ x: "\u4e2d".repeat(8000) })]), { statusCode: 413 });
});

test("malformed JSON and non-object bodies are rejected without echoing private input", async () => {
  for (const text of ["null", "[]", "42", '"text"', "true"]) {
    await assert.rejects(parseChunks([text]), { statusCode: 400, code: "INVALID_JSON_OBJECT" });
  }
  await assert.rejects(parseChunks(['{"activationCode":"LPA:1$private-secret"']), error => {
    assert.equal(error.statusCode, 400);
    assert.equal(error.code, "INVALID_JSON");
    assert.doesNotMatch(error.message, /private-secret|LPA:/);
    return true;
  });
});

test("oversize or aborted requests settle once and release their listeners on close", async () => {
  for (const abort of [false, true]) {
    const request = new EventEmitter();
    const result = context.readJsonBody(request);
    const rejected = assert.rejects(result, { code: abort ? "REQUEST_ABORTED" : "BODY_TOO_LARGE" });
    if (abort) request.emit("aborted");
    else request.emit("data", Buffer.alloc(20481));
    request.emit("data", Buffer.alloc(30000));
    request.emit("error", new Error("private input must not escape"));
    request.emit("close");
    await rejected;
    for (const name of ["data", "end", "aborted", "error", "close"]) assert.equal(request.listenerCount(name), 0);
  }
});

test("unexpected API errors are generic and do not expose error messages or stacks", () => {
  const response = { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(data) { this.body = data.toString(); } };
  context.handleRequestError({}, response, new Error("LPA:1$private-secret"));
  assert.equal(response.status, 500);
  assert.equal(JSON.parse(response.body).code, "INTERNAL_ERROR");
  assert.doesNotMatch(response.body + JSON.stringify(logs), /private-secret/);
  assert.doesNotThrow(() => context.handleRequestError({}, { destroyed: true }, new Error("already closed")));
});

test("read-only AT tools accept supported queries but reject writes and command chaining", () => {
  for (const command of ["AT", "ATI", "AT+GMR", "AT+CPIN?", "AT+CSQ", "AT+CEREG?", "AT+QNWINFO", 'AT+QCFG="usbnet"', "AT+CGPADDR=1", 'AT+QENG="servingcell"']) {
    assert.equal(context.isSafeAt(command), true, command);
  }
  for (const command of ["ATD10086;", "ATH", "ATZ", "AT&W", "AT+UNKNOWN=1", "AT+CFUN=1,1", 'AT+QCFG="usbnet",0', "AT+CSQ\rAT+CFUN=1,1", "AT+CSQ\n", "AT+CSQ;ATZ", "AT\x00", {}, null]) {
    assert.equal(context.isSafeAt(command), false, String(command));
  }
});

test("explicit advanced AT mode still rejects multiline and chained commands", () => {
  context.process.env.ALLOW_DANGEROUS_AT = "1";
  try {
    assert.equal(context.isSafeAt("AT+CFUN=1,1"), true);
    assert.equal(context.isSafeAt("AT+CSQ\rAT+CFUN=1,1"), false);
    assert.equal(context.isSafeAt("AT+CSQ;ATZ"), false);
  } finally { delete context.process.env.ALLOW_DANGEROUS_AT; }
});

test("real HTTP boundary rejects invalid input before accessing a modem", async () => {
  process.env.HOST = "127.0.0.1";
  process.env.PORT = "0";
  process.env.CONSOLE_TOKEN = "isolated-http-input-test-token";
  delete process.env.ALLOW_DANGEROUS_AT;
  const { server, startServer } = require("../web/server");
  await startServer();
  const port = server.address().port;
  const post = (body, token = process.env.CONSOLE_TOKEN) => fetch(`http://127.0.0.1:${port}/api/at`, {
    method: "POST", headers: { "x-console-token": token, "content-type": "application/json" }, body,
  });
  try {
    assert.equal((await post("null", "wrong-token")).status, 401);
    for (const body of ["null", "[]", "false", "42", '{"activationCode":"LPA:1$secret"']) {
      const response = await post(body);
      assert.equal(response.status, 400);
      assert.doesNotMatch(await response.text(), /LPA:|secret|TypeError|SyntaxError/);
    }
    const large = await post(JSON.stringify({ message: "\u4e2d".repeat(8000) }));
    assert.equal(large.status, 413);
    assert.equal(large.headers.get("connection"), "close");
    for (const command of ["ATZ", "AT+CSQ\rAT+CFUN=1,1", "AT+UNKNOWN=1", {}, null]) {
      assert.equal((await post(JSON.stringify({ command }))).status, 400);
    }
    const invalidUrl = await new Promise((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, path: "http://[", agent: false }, res => { res.resume(); res.on("end", () => resolve(res.statusCode)); });
      req.on("error", reject); req.end();
    });
    assert.equal(invalidUrl, 400);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { host: "[" } })).status, 200);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
