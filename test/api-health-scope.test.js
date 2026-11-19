const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
  const warnings = [], tokenRow = {style: {}};
  const context = vm.createContext({
    state: {}, document: {querySelector: () => tokenRow},
    showFeedback: (...args) => warnings.push(args),
    t: (key, args) => ({key, ...args}),
    updateProfileHint() {}, applyLanguage() {},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/public/api.js'), 'utf8'), context);
  return {context, warnings, tokenRow};
}

test('health applies before any request action without a scope error', () => {
  const {context, warnings, tokenRow} = harness();
  context.applyHealth({apiVersion: 2, authRequired: true, smsDeleteEnabled: false});
  assert.equal(context.state.authRequired, true);
  assert.equal(context.state.smsDeleteEnabled, false);
  assert.equal(tokenRow.style.display, 'grid');
  assert.equal(warnings.length, 0);
});

test('health API mismatch warns once using the shared client API level', () => {
  const {context, warnings} = harness();
  context.applyHealth({apiVersion: 999});
  context.applyHealth({apiVersion: 999});
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0].key, 'apiVersionMismatch');
  assert.equal(warnings[0][0].expected, 2);
});
