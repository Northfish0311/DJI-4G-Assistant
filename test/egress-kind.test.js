const test = require("node:test");
const assert = require("node:assert/strict");
const {classifyEgress} = require("../web/server");

// The network page shows the default IPv4 egress. Users read that line to decide whether the
// module carries their traffic, so an unnamed adapter ("Meta", a Clash/WireGuard TUN) must
// not look like an ordinary Ethernet card.

test("the module is recognised before anything else", () => {
  assert.equal(classifyEgress({name: "以太网 7", description: "Quectel ECM Adapter", hardware: true}), "module");
  assert.equal(classifyEgress({name: "Adapter", description: "Mobile Broadband WWAN", hardware: true}), "module");
  assert.equal(classifyEgress({name: "Baiwang", description: "Baiwang (Interface 3)", hardware: true}), "module");
});

test("virtual adapters are called out even when their name says nothing", () => {
  // A TUN interface reports HardwareInterface=false; "Meta" alone is unreadable to users.
  assert.equal(classifyEgress({name: "Meta", description: "Meta Tunnel", hardware: false}), "vpn");
  assert.equal(classifyEgress({name: "以太网 3", description: "TAP-Windows Adapter V9", hardware: false}), "vpn");
});

test("real links fall back to Wi-Fi or Ethernet", () => {
  assert.equal(classifyEgress({name: "WLAN", description: "Intel(R) Wi-Fi 6 AX201 160MHz", hardware: true}), "wifi");
  assert.equal(classifyEgress({name: "Wi-Fi", description: "802.11ac Wireless Adapter", hardware: true}), "wifi");
  assert.equal(classifyEgress({name: "以太网", description: "Intel(R) Ethernet Connection (6) I219-V", hardware: true}), "ethernet");
  assert.equal(classifyEgress(null), "unknown");
});
