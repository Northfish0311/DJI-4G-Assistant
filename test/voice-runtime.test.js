const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseUsbComposition,
  usbCompositionCommand,
  voiceUsbTarget,
  parseQadbChallenge,
  legacyQadbPassword,
} = require("../web/voice-runtime");

test("parses the verified seven-flag QDC507 USB composition", () => {
  const value = parseUsbComposition('+QCFG: "usbcfg",0x2C7C,0x0125,1,1,1,1,1,0,0');
  assert.deepEqual(value, {
    vendorId: 0x2c7c,
    productId: 0x0125,
    flags: [1, 1, 1, 1, 1, 0, 0],
  });
});

test("enables only ADB and UAC while preserving every existing interface", () => {
  const baseline = parseUsbComposition('+QCFG: "usbcfg",0x2C7C,0x0125,1,1,1,1,1,0,0');
  const target = voiceUsbTarget(baseline);
  assert.deepEqual(target.flags, [1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(baseline.flags, [1, 1, 1, 1, 1, 0, 0]);
  assert.equal(
    usbCompositionCommand(target),
    'AT+QCFG="usbcfg",0x2C7C,0x0125,1,1,1,1,1,1,1',
  );
});

test("refuses unknown USB identities and layouts", () => {
  assert.throws(
    () => voiceUsbTarget({ vendorId: 0x1234, productId: 0x5678, flags: [1, 1, 1, 1, 1, 0, 0] }),
    /verified QDC507 USB identities/,
  );
  assert.throws(
    () => voiceUsbTarget({ vendorId: 0x2c7c, productId: 0x0125, flags: [1, 1, 1] }),
    /unknown USBCFG layout/,
  );
});

test("derives the documented legacy QADBKEY response locally", () => {
  assert.equal(legacyQadbPassword("12345678"), "0jXKXQwSwMxYoeg");
  assert.equal(parseQadbChallenge("AT+QADBKEY?\r\n+QADBKEY: 12345678\r\nOK\r\n"), "12345678");
  assert.throws(() => parseQadbChallenge("ERROR\r\n"), /does not expose/);
  assert.throws(
    () => parseQadbChallenge("+QADBKEY: 12345678\r\n+QADBKEY: 87654321\r\nOK\r\n"),
    /one valid/,
  );
});
