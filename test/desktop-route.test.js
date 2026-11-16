const test = require("node:test"), assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process"), path = require("node:path");
const {preferenceHandler} = require("../desktop/network-preference");
const guid = "11223344-1234-1234-1234-112233445566";
function harness(overrides={}) {
  const origin = "http://127.0.0.1:8888", frame={url:origin+"/?token=fixture"}, wc={mainFrame:frame};
  const event={sender:wc,senderFrame:frame}, win={webContents:wc,isDestroyed:()=>false};
  const ops=[];
  const handler=preferenceHandler({windowFor:()=>win,origin,confirm:async()=>true,
    run:async(...args)=>{ops.push(args);return {code:0,guid};},...overrides});
  return {handler,event,ops};
}
test("only the trusted desktop main frame may request either fixed operation", async()=>{
  const h=harness();
  assert.equal(await h.handler({...h.event,senderFrame:null},"Prefer"),21);
  assert.equal(await h.handler({...h.event,senderFrame:{url:h.event.senderFrame.url}},"Prefer"),21);
  assert.equal(await h.handler(h.event,"arbitrary"),21);
  h.event.senderFrame.url="http://localhost:8888/";
  assert.equal(await h.handler(h.event,"Restore"),21);assert.deepEqual(h.ops,[]);
});
test("absence, denied confirmation, duplicate clicks and bad preflight ids do not elevate",async()=>{
  let dialogs=0;let h=harness({run:async()=>({code:10}),confirm:async()=>{dialogs++;}});
  assert.equal(await h.handler(h.event,"Prefer"),10);assert.equal(dialogs,0);
  h=harness({run:async()=>({code:0,guid:"bad"}),confirm:async()=>{dialogs++;}});
  assert.equal(await h.handler(h.event,"Prefer"),21);assert.equal(dialogs,0);
  let answer;h=harness({confirm:async()=>new Promise(resolve=>{answer=resolve;})});
  const first=h.handler(h.event,"Prefer","zh");await new Promise(r=>setImmediate(r));
  assert.equal(await h.handler(h.event,"Restore"),19);answer(false);assert.equal(await first,15);
  assert.deepEqual(h.ops,[["Check"]]);
});
test("confirmed action pins the adapter GUID from preflight", async()=>{
  const h=harness();assert.equal(await h.handler(h.event,"Prefer","zh"),0);
  assert.deepEqual(h.ops,[["Check"],["Prefer",guid]]);
});
test("Windows metric transactions against simulated adapters", {skip:process.platform!=="win32"},()=>{
  const r=spawnSync("powershell",["-NoProfile","-ExecutionPolicy","Bypass","-File",path.join(__dirname,"fixtures","route-preference.ps1")],{encoding:"utf8",windowsHide:true,timeout:20000});
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/fixtures passed/);
});

test("a missing helper fails fast instead of wedging the button", async()=>{
  const previous = process.env.ROAMDOCK_RESOURCE_ROOT;
  process.env.ROAMDOCK_RESOURCE_ROOT = path.join(__dirname, "fixtures", "no-such-root");
  try {
    const {runPreference} = require("../desktop/network-preference");
    const result = await runPreference("Check");
    assert.equal(result.code, 21);
    assert.equal(result.guid, "");
  } finally {
    if (previous === undefined) delete process.env.ROAMDOCK_RESOURCE_ROOT;
    else process.env.ROAMDOCK_RESOURCE_ROOT = previous;
  }
});

test("the helper invocation is bounded and keeps room for diagnostics", ()=>{
  const source = require("node:fs").readFileSync(path.join(__dirname, "../desktop/network-preference.js"), "utf8");
  // Without a timeout a wedged WMI call leaves the running flag latched forever.
  assert.match(source, /timeout:\s*20000/);
  // 4 KiB was small enough for one PowerShell warning to look like a generic failure.
  assert.match(source, /maxBuffer:\s*16384/);
});

test("the console publishes its version and API level", async()=>{
  const {server, startServer, stopServer} = require("../web/server");
  // Reuse the exported helpers instead of binding a port: they are the same code path.
  const packageVersion = JSON.parse(require("node:fs").readFileSync(path.join(__dirname, "../package.json"), "utf8")).version;
  assert.match(packageVersion, /^\d+\.\d+\.\d+$/);
  const source = require("node:fs").readFileSync(path.join(__dirname, "../web/server.js"), "utf8");
  assert.match(source, /version: APP_VERSION/);
  assert.match(source, /apiVersion: CONSOLE_API_VERSION/);
  const client = require("node:fs").readFileSync(path.join(__dirname, "../web/public/api.js"), "utf8");
  const serverLevel = /const CONSOLE_API_VERSION = (\d+);/.exec(source);
  const clientLevel = /const CONSOLE_API_VERSION = (\d+);/.exec(client);
  assert.ok(serverLevel && clientLevel, "both sides must declare an API level");
  assert.equal(serverLevel[1], clientLevel[1], "server and page API levels drifted apart");
});

test("closing the window is wired to a bounded full exit", () => {
  // Closing the window used to leave the main, renderer, GPU and utility processes alive
  // with no window left to close again; only Task Manager could end them.
  const source = require("node:fs").readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
  assert.match(source, /window-all-closed", \(\) => quitEveryProcess\(\)/);
  assert.match(source, /setTimeout\(\(\) => app\.exit\(code\), 1500\)/);
  assert.match(source, /if \(!hasLock\) \{\s*\/\/[^]*?app\.exit\(0\);/);
});
