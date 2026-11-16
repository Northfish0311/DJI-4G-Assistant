const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm");
const {readAppSource} = require("./helpers/app-source");
const source = readAppSource();
test("two signal monitors distinguish speech from silence and release both taps without recording", () => {
  const els = new Map(), document={querySelector(id) {
    if(!els.has(id)) els.set(id,{dataset:{}}); return els.get(id);
  }};
  let created=0, disconnected=0, closed=0, cleared=0, next;
  class FakeContext {
    state="running";
    createMediaStreamSource() { return {connect(){},disconnect(){disconnected++;}}; }
    createAnalyser(){const amplitude=created++ ? 0 : 0.2;return {getFloatTimeDomainData:a=>a.fill(amplitude),disconnect(){disconnected++;}};}
    resume(){return Promise.resolve();} close(){closed++;return Promise.resolve();}
  }
  const c=vm.createContext({document, AudioContext:FakeContext,t:key=>key,setInterval:f=>{next=f;return 1;},clearInterval:()=>{cleared++;}});
  vm.runInContext(source.slice(source.indexOf("function observeAudioSignals("),source.indexOf("async function prepareLocalCallAudio()")),c);
  const mic={active:true}, stop=c.observeAudioSignals(mic,{active:true});
  assert.equal(els.get("#micSignalValue").textContent,"audioSignal");assert.equal(els.get("#modemSignalValue").textContent,"audioQuiet");
  mic.active=false;next();assert.equal(els.get("#micSignalValue").textContent,"meterUnavailable");
  stop();assert.deepEqual([disconnected,closed,cleared],[4,1,1]);assert.equal(els.get("#audioSignals").hidden,true);
});
test("default IPv4 label does not guess when no route, read failure or equal priorities occur", () => {
  let text;const state={},c=vm.createContext({state,document:{querySelector:()=>({set textContent(v){text=v;}})},t:(k,p)=>k+(p?.names||"")});
  vm.runInContext(source.slice(source.indexOf("function renderDefaultRoute("),source.indexOf("function smsStatus(")),c);
  for(const [names,label] of [[undefined,"--"],[null,"routeUnavailable"],[[],"routeAbsent"],[["WLAN"],"WLAN"],[["USB","WLAN"],"routeTieUSB / WLAN"]]){
    state.routeNames=names;c.renderDefaultRoute();assert.equal(text,label);
  }
});
