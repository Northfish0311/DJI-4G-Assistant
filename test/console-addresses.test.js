const test = require("node:test");
const assert = require("node:assert/strict");
const {consoleAccess} = require("../web/console-addresses");
const ip = address => ({family: "IPv4", internal: false, address});
const networks = {WLAN: [ip("192.168.50.20")], "Ethernet 7": [ip("192.168.225.21")], Ethernet: [ip("10.0.0.2")], "vEthernet (WSL)": [ip("172.20.0.1")], VPN: [ip("10.9.0.2")]};

test("local listeners never advertise LAN pairing even with a Wi-Fi address", () => {
  for (const host of ["127.0.0.1", "localhost", "::1"]) {
    const access = consoleAccess(host, 45678, networks);
    assert.equal(access.accessMode, "local");
    assert.deepEqual(access.urls, []);
    assert.equal(access.pairingAvailable, false);
    assert.equal(access.pairingReason, "LOCAL_ONLY");
    assert.equal(access.primaryUrl, `http://${host === "::1" ? "[::1]" : "127.0.0.1"}:45678`);
  }
});

test("LAN pairing prefers Wi-Fi and does not recommend modem or virtual interfaces", () => {
  const access = consoleAccess("0.0.0.0", 8787, networks);
  assert.deepEqual(access.urls, ["http://192.168.50.20:8787", "http://10.0.0.2:8787"]);
  assert.equal(access.pairingAvailable, true);
});

test("internet through the dongle alone does not imply a shared phone LAN", () => {
  const access = consoleAccess("0.0.0.0", 8787, {Ethernet: [ip("192.168.225.21")]});
  assert.equal(access.pairingReason, "NO_LAN_ADDRESS");
  assert.equal(access.primaryUrl, "http://127.0.0.1:8787");
});

test("a specific bound adapter cannot advertise another adapter", () => {
  assert.deepEqual(consoleAccess("10.0.0.2", 8788, networks).urls, ["http://10.0.0.2:8788"]);
});

test("public, link-local and loopback addresses are not suggested as private LANs", () => {
  assert.deepEqual(consoleAccess("0.0.0.0", 8787, {Ethernet: [ip("169.254.1.1"), ip("8.8.8.8"), ip("127.0.0.1")]}).urls, []);
  assert.equal(consoleAccess("0.0.0.0", 8787, {WLAN: [ip("192.168.225.8")]}).pairingAvailable, true);
});
