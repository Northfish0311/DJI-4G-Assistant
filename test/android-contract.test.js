const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const base = "android/app/src/main/java/com/northfish0311/dji4gremote/";

test("Android discovery requests the exact service advertised by Windows", () => {
  const type = read("web/server.js").match(/bonjour\.publish\(\{[\s\S]*?type: "([^"]+)"/)[1];
  assert.ok(read(base + "ComputerDiscovery.java").includes('"_' + type + '._tcp."'));
  assert.match(read(base + "ComputerDiscovery.java"), /new ArrayList<>\(found\.values\(\)\)/);
});
test("Android resume does not reload a healthy console or hide corrupt pairing data", () => {
  const source = read(base + "MainActivity.java");
  const start = source.split("@Override protected void onStart()")[1].split("@Override protected void onStop()")[0];
  assert.doesNotMatch(start, /reload\(/);
  assert.match(start, /loadFailed && retryableFailure/);
  assert.match(source, /if \(vaultUnreadable \|\| !savedPairings\.isEmpty\(\)\)/);
  const list = read(base + "PairingVault.java").split("List<JSONObject> list()")[1].split("void add")[0];
  assert.doesNotMatch(list, /catch/);
});
test("Android retries are scheduled on failed loads, not immediately after starting a load", () => {
  const source = read(base + "MainActivity.java");
  const reload = source.split("private void reload()")[1].split("private void forget()")[0];
  assert.doesNotMatch(reload, /scheduleReconnect/);
  assert.match(reload, /appendQueryParameter\("nativeLoad", Long\.toString\(\+\+pageLoad\)\)/);
  assert.match(source, /if \(retryable\) scheduleReconnect\(\)/);
  assert.match(source, /code >= 500/);
  assert.match(read(".github/workflows/android.yml"), /connectedDebugAndroidTest/);
});
