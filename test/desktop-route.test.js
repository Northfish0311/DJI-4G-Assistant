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
