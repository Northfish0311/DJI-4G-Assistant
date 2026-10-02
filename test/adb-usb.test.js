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
  AdbUsbConnection,
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

test("ADB USB writes accept byte counts rather than treating them as buffers", async () => {
  const adb = new AdbUsbConnection({ usb: {} });
  const packets = [];
  adb.output = { transfer(value, callback) {
    packets.push(value);
    queueMicrotask(() => callback(null, value.length));
  } };
  await adb.write(COMMANDS.CNXN, 0x01000001, 4096, Buffer.from("host::test\0"));
  assert.equal(packets.length, 2);
  assert.equal(packets[0].readUInt32LE(0), COMMANDS.CNXN);
  assert.equal(packets[0].length, 24);
  assert.deepEqual(packets[1], Buffer.from("host::test\0"));
  packets.length = 0;
  await adb.write(COMMANDS.CLSE);
  assert.equal(packets.length, 1);
  assert.equal(packets[0].length, 24);
});

test("short USB writes and transfer failures reject without native callback exceptions", async () => {
  const adb = new AdbUsbConnection({ usb: {} });
  adb.output = { transfer(value, callback) { queueMicrotask(() => callback(null, value.length - 1)); } };
  await assert.rejects(adb.write(COMMANDS.CNXN), /Incomplete ADB USB write/);
  const failure = new Error("LIBUSB_ERROR_NO_DEVICE");
  adb.output = { transfer(_, callback) { queueMicrotask(() => callback(failure)); } };
  await assert.rejects(adb.write(COMMANDS.CNXN), (error) => error === failure);
});

test("USB input keeps real buffers and rejects invalid callback data promptly", async () => {
  const adb = new AdbUsbConnection({ usb: {} });
  adb.input = { transfer(_, callback) { queueMicrotask(() => callback(null, Buffer.from([1, 2, 3]))); } };
  assert.deepEqual(await adb.readExactly(3, Date.now() + 1000), Buffer.from([1, 2, 3]));
  adb.input = { transfer(_, callback) { queueMicrotask(() => callback(null, 3)); } };
  await assert.rejects(adb.readExactly(3, Date.now() + 1000), /Invalid ADB USB read buffer/);
});

test("native USB read timeouts retry only until the ADB deadline", async () => {
  const adb = new AdbUsbConnection({ usb: {} });
  let attempts = 0;
  adb.input = { transfer(_, callback) {
    attempts++;
    queueMicrotask(() => attempts === 1 ? callback(new Error("LIBUSB_TRANSFER_TIMED_OUT")) : callback(null, Buffer.from([9])));
  } };
  assert.deepEqual(await adb.readExactly(1, Date.now() + 1000), Buffer.from([9]));
  assert.equal(attempts, 2);
  await assert.rejects(adb.readExactly(1, Date.now() - 1), /Timed out/);
  assert.equal(attempts, 2);
});
