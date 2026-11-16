const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {readAppSource} = require('./helpers/app-source');
const source = readAppSource();
const fragment = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const inbox = '+CMGL: 1,"REC READ","10086","","26/10/26,12:00:00+32"\nHello\nOK';

function harness() {
  const elements = new Map();
  const stats = {parse: 0, layout: 0, refresh: 0, storage: null};
  const element = id => {
    if (!elements.has(id)) elements.set(id, {textContent: '', innerHTML: '', value: '', dataset: {},
      scrollTop: 0, scrollHeight: 400, clientHeight: 400, querySelectorAll: () => [], querySelector: () => null,
      getBoundingClientRect: () => {stats.layout++; return {top: 0, bottom: 400};},
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    nativeCompanion: false, window: {}, Map,
    localStorage: {getItem: () => 'en'}, navigator: {language: 'en'},
    document: {querySelector: element},
    renderSmsStorage: storage => {stats.storage = storage;}, parseSmsStorageText: () => null,
    updateSmsComposer() {}, renderSmsRefreshState: () => {stats.refresh++;},
  });
  vm.runInContext([
    require('./helpers/browser-state.cjs'),
    fragment('function escapeHtml(', 'function formatBytes('),
    fragment('function smsStatus(', 'function parseSmsStorageText('),
    fragment('function normalizePhone(', 'function parseDialInput('),
    fragment('function renderSmsNewMessages(', 'function selectSmsConversation('),
  ].join('\n'), context);
  const parse = context.parseSmsMessages;
  context.parseSmsMessages = text => {stats.parse++; return parse(text);};
  return {context, state: vm.runInContext('state', context), stats, element};
}

test('unchanged SMS polls update freshness and capacity without parsing or measuring the inbox again', () => {
  const ui = harness();
  ui.state.smsLastRead = 1;
  ui.context.renderSms(inbox);
  const layout = ui.stats.layout, markup = ui.element('#smsList').innerHTML;
  ui.state.smsLastRead = 2;
  ui.context.renderSms(inbox, {storage: {used: 1, total: 100}});
  assert.equal(ui.stats.parse, 1);
  assert.equal(ui.stats.layout, layout);
  assert.equal(ui.element('#smsList').innerHTML, markup);
  assert.equal(ui.stats.refresh, 2);
  assert.equal(ui.stats.storage.total, 100);
});

test('search, language, permissions and draft selection redraw without re-decoding stored messages', () => {
  for (const change of [
    ui => {ui.state.smsQuery = 'Hello';},
    ui => {ui.state.language = 'zh';},
    ui => {ui.state.smsDeleteEnabled = true;},
    ui => {ui.state.smsNewDraft = true;},
  ]) {
    const ui = harness();
    ui.context.renderSms(inbox);
    const key = ui.state.smsRenderKey;
    change(ui); ui.context.renderSms(inbox);
    assert.notEqual(ui.state.smsRenderKey, key);
    assert.equal(ui.stats.parse, 1);
  }
});

test('new inbox content or another card invalidates the parsed inbox', () => {
  const ui = harness(); ui.context.renderSms(inbox); ui.context.renderSms(inbox.replace('Hello', 'Changed'));
  assert.match(ui.element('#smsList').innerHTML, /Changed/);
  assert.equal(ui.stats.parse, 2);
  const previous = ui.state.smsParsedInbox;
  ui.state.cardEpoch++;
  ui.context.renderSms(inbox.replace('Hello', 'Changed'));
  assert.notEqual(ui.state.smsParsedInbox, previous);
  assert.equal(ui.stats.parse, 3);
});

test('long conversation starts with 40 bubbles, expands, and searches older messages', () => {
  const ui = harness(), records = Array.from({length:125}, (_, i) =>
    '+CMGL: ' + (i+1) + ',"REC READ","10086","","26/11/15,09:00:00+32"\nmessage-' + (i+1) + '.').join('\n') + '\nOK';
  const body = () => ui.element('#smsList').innerHTML;
  ui.context.renderSms(records);
  assert.equal((body().match(/<article /g)||[]).length,40);
  assert.match(body(),/message-125\./);assert.doesNotMatch(body(),/message-1\./);
  ui.state.smsPageSize += 40; ui.context.renderSms(records);
  assert.equal((body().match(/<article /g)||[]).length,80);
  ui.state.smsQuery = 'message-1.'; ui.context.renderSms(records);
  assert.match(body(),/<mark>message-1\.<\/mark>/); assert.equal(ui.stats.parse,1);
});

test('local sent messages and draft edits cannot be hidden by reuse', () => {
  const ui = harness(); ui.context.renderSms(inbox);
  ui.state.smsSentThisSession.push({number: '10086', message: 'Local reply', time: '12:01'});
  ui.context.renderSms(inbox);
  assert.match(ui.element('#smsList').innerHTML, /Local reply/);
  ui.state.smsDrafts.set('10086', {message: 'Unsent draft', number: '10086'});
  ui.context.renderSms(inbox);
  assert.equal(ui.stats.parse, 1);
  assert.match(ui.element('#smsThreads').innerHTML, /Draft/);
});

test('first successful empty read replaces the not-loaded placeholder', () => {
  const ui = harness(); ui.context.renderSms('');
  const initial = ui.element('#smsList').innerHTML;
  ui.state.smsLastRead = 1;
  ui.context.renderSms('');
  assert.equal(ui.stats.parse, 1);
  assert.notEqual(ui.element('#smsList').innerHTML, initial);
});

test('a failed render is not recorded as a reusable successful inbox', () => {
  const ui = harness(), parse = ui.context.parseSmsMessages;
  ui.context.parseSmsMessages = () => {throw new Error('render interrupted');};
  assert.throws(() => ui.context.renderSms(inbox));
  ui.context.parseSmsMessages = parse;
  ui.context.renderSms(inbox);
  assert.match(ui.element('#smsList').innerHTML, /Hello/);
  assert.equal(ui.stats.parse, 1);
});

test('SMS refresh controls retain their icon until polling mode changes', () => {
  let icons = 0, replacements = 0;
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {dataset: {}, setAttribute() {}, classList: {add() {}},
      replaceChildren(child) {this.firstElementChild = child; replacements++;}});
    return elements.get(id);
  };
  const state = {smsPolling: true, language: 'en'};
  const context = vm.createContext({state, nativeCompanion: false, t: key => key,
    window: {lucide: {createIcons: () => icons++}},
    document: {querySelector: element, createElement: () => ({dataset: {}, setAttribute() {}})},
  });
  vm.runInContext(fragment('function renderSmsRefreshState()', 'async function refreshSmsQuietly()'), context);
  context.renderSmsRefreshState(); context.renderSmsRefreshState();
  assert.equal(icons, 1); assert.equal(replacements, 1);
  state.smsPolling = false; context.renderSmsRefreshState();
  assert.equal(icons, 2); assert.equal(replacements, 2);
});
