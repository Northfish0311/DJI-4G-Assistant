const test = require("node:test");
const assert = require("node:assert/strict");

const {
  COMMANDS,
  checksum,
  encodeMessage,
  decodeMessage,
  checkedShellCommand,
  parseCheckedShellOutput,
  isAdbInterface,
} = require("../web/adb-usb");

test("encodes and verifies a direct ADB USB packet", () => {
  const payload = Buffer.from("host::dji-4g-assistant\0", "utf8");
  const packet = encodeMessage(COMMANDS.CNXN, 0x01000000, 4096, payload);
  assert.equal(checksum(payload), payload.reduce((sum, byte) => (sum + byte) >>> 0, 0));
  assert.deepEqual(decodeMessage(packet.subarray(0, 24), packet.subarray(24)), {
    command: COMMANDS.CNXN,
    argument0: 0x01000000,
    argument1: 4096,
    payload,
  });
  const corrupt = Buffer.from(packet);
  corrupt[24] ^= 0xff;
  assert.throws(() => decodeMessage(corrupt.subarray(0, 24), corrupt.subarray(24)), /payload/);
});

test("matches only a genuine Android ADB interface", () => {
  assert.equal(isAdbInterface({ descriptor: { bInterfaceClass: 0xff, bInterfaceSubClass: 0x42, bInterfaceProtocol: 0x01 } }), true);
  assert.equal(isAdbInterface({ descriptor: { bInterfaceClass: 0xff, bInterfaceSubClass: 0xff, bInterfaceProtocol: 0xff } }), false);
  assert.equal(isAdbInterface({ descriptor: { bInterfaceClass: 0x02, bInterfaceSubClass: 0x06, bInterfaceProtocol: 0x00 } }), false);
});

test("checks shell exit status without interpolating user input", () => {
  const token = "0123456789abcdef01234567";
  const command = checkedShellCommand("id -u", token);
  assert.match(command, /printf/);
  assert.deepEqual(parseCheckedShellOutput("0\n__DJI_STATUS_0123456789abcdef01234567_0__\n", token), {
    status: 0,
    output: "0",
  });
  assert.throws(() => parseCheckedShellOutput("0\n", token), /exit status/);
});
