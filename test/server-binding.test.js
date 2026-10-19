const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../web/server.js"), "utf8");

test("source startup binds locally and refuses unauthenticated LAN access", async () => {
  assert.match(source, /const host = process\.env\.HOST \|\| "127\.0\.0\.1"/);
  const code = source.slice(source.indexOf("function startServer()"), source.indexOf("if (require.main === module)"));
  for (const host of ["0.0.0.0", "::", "192.168.5.6"]) {
    const context = vm.createContext({host, consoleToken: "", server: {listening: true}});
    vm.runInContext(code, context);
    await assert.rejects(context.startServer(), /LAN access requires CONSOLE_TOKEN/);
  }
  for (const host of ["127.0.0.1", "::1", "localhost"]) {
    const server = {listening: true};const context = vm.createContext({host, consoleToken: "", server});
    vm.runInContext(code, context);assert.equal(await context.startServer(), server);
  }
  const server = {listening: true};const context = vm.createContext({host: "0.0.0.0", consoleToken: "test-only", server});
  vm.runInContext(code, context);assert.equal(await context.startServer(), server);
});

test("lpac downloads use a fixed release and verify its hash before extraction", () => {
  const script = fs.readFileSync(path.join(__dirname, "../scripts/windows/install-lpac.ps1"), "utf8");
  assert.ok(!script.includes("releases/latest"));
  assert.match(script, /v2\.3\.0/);
  assert.match(script, /4781e8673d19c08c41cd104e8bc59f901e352eb10e8c952bcf2aa199a915ea6f/i);
  assert.ok(script.indexOf("Get-FileHash") < script.indexOf("Expand-Archive"));
});
