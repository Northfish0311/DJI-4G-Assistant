const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../web/server.js'), 'utf8');

async function status(query, result = {ok: true, stdout: '+CPIN: READY\n+QCCID: 8900000000000000001\nOK'}) {
  const calls = [], replies = [];
  const context = vm.createContext({
    createHash, url: new URL('http://localhost/api/module-status' + query), res: {},
    portArg: () => 'COM5', parseModuleTemperature: () => null,
    enqueueAt: async (port, commands, timeout) => {calls.push({port, commands: Array.from(commands), timeout}); return result;},
    sendJson: (_res, code, body) => replies.push({code, body}),
  });
  vm.runInContext(source.slice(source.indexOf('function parseCardPresence('), source.indexOf('function inventoryCandidateAids(')), context);
  const start = source.indexOf('  if (url.pathname === "/api/module-status")');
  const end = source.indexOf('  if (url.pathname === "/api/module-temperature")', start);
  await vm.runInContext('(async () => {' + source.slice(start, end) + '})()', context);
  return {call: calls[0], reply: replies[0].body, calls};
}

test('startup uses one serial session for ten essential queries and the SIM fingerprint', async () => {
  const {call, reply, calls} = await status('?startup=1');
  assert.equal(calls.length, 1);
  assert.equal(call.commands.length, 10);
  assert.deepEqual(call.commands.slice(-2), ['AT+CPIN?', 'AT+QCCID']);
  assert.equal(call.commands.filter(command => command === 'AT+CPIN?').length, 1);
  assert.equal(call.timeout, 60000);
  assert.equal(reply.card.ready, true);
  assert.match(reply.card.signature, /^[a-f0-9]{64}$/);
  for (const command of ['ATI', 'AT+CEREG?', 'AT+COPS?', 'AT+CSQ', 'AT+QTEMP', 'AT+QNWINFO', 'AT+CGPADDR=1', 'AT+QCFG="usbnet"']) assert.ok(call.commands.includes(command));
});

test('full diagnostics and periodic brief reads retain their original query sets and limits', async () => {
  const full = await status('');
  assert.equal(full.call.commands.length, 15);
  assert.ok(full.call.commands.includes('AT+CGDCONT?'));
  assert.ok(full.call.commands.includes('AT+QENG="servingcell"'));
  assert.equal(full.call.timeout, 60000);
  assert.equal(full.reply.card, undefined);
  const brief = await status('?brief=1');
  assert.equal(brief.call.commands.length, 7);
  assert.equal(brief.call.timeout, 30000);
  assert.equal(brief.reply.card, undefined);
});

test('startup SIM status does not hide transport failure, missing cards or unsupported ICCID', async () => {
  const failed = await status('?startup=1', {ok: false, stdout: ''});
  assert.equal(failed.reply.card.ok, false);
  const missing = await status('?startup=1', {ok: true, stdout: '+CME ERROR: SIM not inserted'});
  assert.equal(missing.reply.card.ready, false);
  const unsupported = await status('?startup=1', {ok: true, stdout: '+CPIN: READY\nERROR'});
  assert.equal(unsupported.reply.card.ready, true);
  assert.equal(unsupported.reply.card.signature, null);
});

test('startup retains its full timeout even when a caller also requests brief mode', async () => {
  const {call} = await status('?startup=1&brief=1');
  assert.equal(call.timeout, 60000);
  assert.equal(call.commands.length, 10);
});
