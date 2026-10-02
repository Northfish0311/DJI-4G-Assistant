const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { parseVoiceNetwork } = require('../web/voice-network');
const { parseVoiceIdentity, parseClcc, atAccepted } = require('../web/server');
const source = fs.readFileSync(path.join(__dirname, '../web/server.js'), 'utf8');
const enable = source.slice(source.indexOf('  if (url.pathname === "/api/call-ims-enable"'), source.indexOf('  if (url.pathname === "/api/call-ims-restore"'));
async function runCase({ allowed = true, confirm = 'ENABLEIMS', firmware = 'QDC507GLEFM21', active = false, readback = 1 } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-setup-'));
  const commands = [];
  let reply;
  const context = vm.createContext({
    fs, path, dataRoot: directory, parseVoiceIdentity, parseVoiceNetwork, parseClcc, atAccepted,
    process: { env: { ALLOW_VOICE_RUNTIME: allowed ? '1' : '' } },
    sendJson: (_res, status, data) => { reply = { status, data }; }, readJsonBody: async () => ({ confirm }),
    enqueueSerial: async task => task(), portArg: () => 'COM5',
    runAtCommands: async (_port, items) => {
      commands.push(...items);
      if (items.includes('ATI')) return { ok: true, stdout: 'Baiwang\nQDC507\nRevision: ' + firmware + '\n123456789012345\n' + (active ? '+CLCC: 2,0,0,0,0,"10086",129\n' : '') + '+QCFG: "ims",2,0\nOK\n' };
      return { ok: true, stdout: items[0] === 'AT+QCFG="ims"' ? '+QCFG: "ims",' + readback + ',1\nOK\n' : '\nOK\n' };
    },
  });
  try {
    await vm.runInContext('(async function(req,res,url){' + enable + '})', context)({ method: 'POST' }, {}, { pathname: '/api/call-ims-enable' });
    const backups = fs.existsSync(path.join(directory, '.local/voice-ims-backups')) ? fs.readdirSync(path.join(directory, '.local/voice-ims-backups')) : [];
    return { ...reply, commands, backups };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
test('IMS writes require a permission flag and separate confirmation', async () => {
  assert.equal((await runCase({ allowed: false })).commands.length, 0);
  assert.equal((await runCase({ confirm: '' })).commands.length, 0);
});
test('IMS enable backs up the exact module and verifies before reboot', async () => {
  const value = await runCase();
  assert.equal(value.data.ok, true);
  assert.equal(value.backups.length, 1);
  assert.deepEqual(value.commands.slice(-3), ['AT+QCFG="ims",1', 'AT+QCFG="ims"', 'AT+CFUN=1,1']);
  assert.ok(!value.commands.some(command => /CGDCONT=|usbnet.*,/i.test(command)));
});
test('unknown firmware, an active call or mismatched IMS readback cannot reboot', async () => {
  for (const options of [{ firmware: 'UNKNOWN' }, { active: true }, { readback: 2 }]) {
    const value = await runCase(options);
    assert.equal(value.data.ok, false);
    assert.ok(!value.commands.includes('AT+CFUN=1,1'));
  }
});
test('NO CARRIER or CME ERROR cannot be counted as an accepted call after OK', () => {
  for (const output of ['\nOK\nNO CARRIER\n', '\nOK\n+CME ERROR: 3\n', '\nBUSY\n', '\nNO ANSWER\n']) assert.equal(atAccepted({ ok: true, stdout: output }), false);
});
