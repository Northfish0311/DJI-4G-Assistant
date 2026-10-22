const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("translations load before the app and provide matching English/Chinese keys", () => {
  const html = read("web/public/index.html");
  const i18n = html.indexOf('<script src="/i18n.js"');
  // 拆分后不再有单一 app.js：i18n 必须早于第一个分片，且分片按序加载
  const firstShard = html.indexOf('<script src="/core.js"');
  const lastShard = html.indexOf('<script src="/init.js"');
  assert.ok(i18n >= 0 && firstShard > i18n && lastShard > firstShard);
  const copy = vm.runInNewContext(read("web/public/i18n.js") + ";copy");
  assert.deepEqual(Object.keys(copy.zh).sort(), Object.keys(copy.en).sort());
  for (const match of html.matchAll(/data-i18n(?:-placeholder|-aria)?="([^"]+)"/g)) {
    assert.equal(typeof copy.zh[match[1]], "string", match[1]);
    assert.equal(typeof copy.en[match[1]], "string", match[1]);
  }
});
