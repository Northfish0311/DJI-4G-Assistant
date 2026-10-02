const test = require("node:test");
const assert = require("node:assert/strict");
const { parseVoiceNetwork } = require("../web/voice-network");

test("separates working LTE data from explicitly disabled IMS", () => {
  const value = parseVoiceNetwork('+QCFG: "ims",2,0\n+CEREG: 0,1\n+CREG: 0,3\n+CEER: 0,-1');
  assert.equal(value.lteRegistered, true);
  assert.equal(value.imsMode, 2);
  assert.equal(value.diagnosis, "IMS_DISABLED");
  assert.equal(value.lastFailure, "");
});
test("does not claim IMS registration from QCFG configuration alone", () => {
  const value = parseVoiceNetwork('+QCFG: "ims",1,1\n+CEREG: 0,5\n+CGDCONT: 5,"IPV4V6","ims"\n+CGACT: 5,1');
  assert.equal(value.volteEnabled, true);
  assert.equal(value.imsBearerActive, true);
  assert.equal(value.diagnosis, "VOICE_NETWORK_UNVERIFIED");
  assert.equal(value.imsRegistered, undefined);
});
test("keeps inactive IMS bearer separate from failed LTE registration", () => {
  assert.equal(parseVoiceNetwork('+QCFG: "ims",1,1\n+CEREG: 0,1\n+CGDCONT: 5,"IPV4V6","ims"\n+CGACT: 1,1\n+CGACT: 5,0').diagnosis, "IMS_BEARER_INACTIVE");
  assert.equal(parseVoiceNetwork('+QCFG: "ims",1,1\n+CEREG: 0,3').diagnosis, "LTE_NOT_REGISTERED");
});
test("preserves a modem failure cause and does not invent unsupported values", () => {
  const value = parseVoiceNetwork('ERROR\n+CEER: 6,267');
  assert.equal(value.imsMode, null);
  assert.equal(value.lteRegistered, null);
  assert.equal(value.lastFailure, "6,267");
});
