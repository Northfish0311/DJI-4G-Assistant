const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../web/public/sms.js"), "utf8");

function ui({reply, accepted = false, nextPort = "COM3", confirm = true, networkError = false} = {}) {
  const message = "fixture", number = "10086", fields = new Map();
  const field = key => {
    if (!fields.has(key)) fields.set(key, {value:"", dataset:{}});
    return fields.get(key);
  };
  field("#smsMessageInput").value = message; field("#smsNumberInput").value = number;
  let posts = 0;
  const ctx = vm.createContext({
    localStorage:{getItem:()=>"zh"}, navigator:{language:"zh"}, document:{querySelector:field},
    normalizePhone:s=>s, apiHeaders:()=>({}), confirmOperation:async()=>confirm, setBusy(){}, updateSummary(){}, renderSms(){},
    append(){}, textFromResult:data=>data.error || data.stdout,
    requestAction:async()=>{ctx.stateRef.atPort=nextPort;return {text:""};},
    fetch:async()=>{posts++; if(networkError) throw Error("network interrupted");return {ok:accepted,status:accepted?200:502,json:async()=>reply};},
  });
  vm.runInContext(require("./helpers/browser-state.cjs"), ctx);
  vm.runInContext(source.slice(source.indexOf("function smsDraftKey()"), source.indexOf("function saveSmsDraft("))
    + source.slice(source.indexOf("function setSmsFeedback("), source.indexOf("function updateSmsComposer("))
    + source.slice(source.indexOf("async function sendSmsMessage(")),ctx);
  const state = ctx.stateRef = vm.runInContext("state", ctx);
  Object.assign(state,{atPort:"COM3",smsSendEnabled:true,smsNewDraft:true});
  state.smsDrafts.set("new",{number,message});
  return {send:()=>ctx.sendSmsMessage(), state, field, posts:()=>posts};
}

test("a rejected multipart SMS shows the actual modem reason and retains the draft", async () => {
  const u = ui({reply:{ok:false,status:"rejected",modemError:"+CMS ERROR: 331",submittedSegments:1,totalSegments:3}});
  await u.send();
  assert.match(u.field("#smsComposeFeedback").textContent, /无网络服务.*\+CMS ERROR: 331.*1\/3/);
  assert.equal(u.state.smsSentThisSession.length,0); assert.equal(u.field("#smsMessageInput").value,"fixture");
  assert.ok(u.state.smsDrafts.has("new")); assert.equal(u.posts(),1);
});

test("a lost HTTP reply or missing modem acknowledgement never becomes a sent bubble", async () => {
  for (const opts of [{networkError:true},{reply:{ok:false,status:"unconfirmed",submittedSegments:0,totalSegments:1}},
    {accepted:true,reply:{ok:true}}]) {
    const u = ui(opts); await u.send();
    assert.match(u.field("#smsComposeFeedback").textContent,/请先核实再重发/);
    assert.equal(u.field("#smsMessageInput").value,"fixture"); assert.equal(u.state.smsSentThisSession.length,0);
    assert.equal(u.posts(),1);
  }
});

test("confirmed submission clears only its draft and does not claim delivery", async () => {
  const u = ui({accepted:true,reply:{ok:true,status:"submitted",submittedSegments:1,totalSegments:1}});
  await u.send(); assert.equal(u.posts(),1); assert.equal(u.field("#smsMessageInput").value,"");
  assert.equal(u.state.smsDrafts.has("new"),false); assert.equal(u.state.smsSentThisSession.length,1);
  assert.match(u.field("#smsComposeFeedback").textContent,/已提交.*尚无送达回执/);
});

test("cancelling or discovering a different port after confirmation never sends", async () => {
  for (const opts of [{confirm:false},{nextPort:"COM9"}]) {
    const u = ui(opts); await u.send(); assert.equal(u.posts(),0); assert.ok(u.state.smsDrafts.has("new"));
  }
});
