const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {pruneUsbPrebuilds} = require('../lab/tauri/prune-usb.cjs');

function fixture(t, platforms) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dji-usb-prune-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const base = path.join(root, 'node_modules/usb/prebuilds');
  for (const name of platforms) {
    fs.mkdirSync(path.join(base, name), {recursive: true});
    fs.writeFileSync(path.join(base, name, 'usb.node'), name);
  }
  fs.writeFileSync(path.join(base, '..', 'LICENSE'), 'fixture');
  return {root, base};
}

test('Tauri payload keeps only Windows x64 USB binaries and preserves license', t => {
  const {root, base} = fixture(t, ['win32-x64', 'linux-x64', 'darwin-x64+arm64', 'win32-arm64']);
  assert.equal(pruneUsbPrebuilds(root).length, 3);
  assert.deepEqual(fs.readdirSync(base), ['win32-x64']);
  assert.equal(fs.readFileSync(path.join(base, 'win32-x64/usb.node'), 'utf8'), 'win32-x64');
  assert.equal(fs.readFileSync(path.join(base, '../LICENSE'), 'utf8'), 'fixture');
  assert.deepEqual(pruneUsbPrebuilds(root), []);
});

test('missing target or unexpected entries leave staging files untouched', t => {
  const {root, base} = fixture(t, ['linux-x64']);
  assert.throws(() => pruneUsbPrebuilds(root), /Missing win32-x64/);
  assert.ok(fs.existsSync(path.join(base, 'linux-x64/usb.node')));
  fs.mkdirSync(path.join(base, 'win32-x64'));
  fs.writeFileSync(path.join(base, 'unexpected.txt'), 'keep');
  assert.throws(() => pruneUsbPrebuilds(root), /Unexpected/);
  assert.ok(fs.existsSync(path.join(base, 'linux-x64/usb.node')));
});
