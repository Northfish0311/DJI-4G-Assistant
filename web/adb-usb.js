"use strict";

// Minimal ADB transport for the QDC507 USB function. The wire protocol is
// based on Android's public ADB protocol and MaVo's MIT-licensed transport.
const crypto = require("crypto");
const MAX_PAYLOAD = 4096;
const MAX_OUTPUT = 1024 * 1024;
const TARGET_IDS = new Set(["2ca3:4006", "2c7c:125"]);

function adbCommand(value) {
  const buffer = Buffer.from(value, "ascii");
  if (buffer.length !== 4) throw new Error("ADB command must contain four ASCII bytes.");
  return buffer.readUInt32LE(0);
}

const COMMANDS = {
  AUTH: adbCommand("AUTH"),
  CLSE: adbCommand("CLSE"),
  CNXN: adbCommand("CNXN"),
  OKAY: adbCommand("OKAY"),
  OPEN: adbCommand("OPEN"),
  WRTE: adbCommand("WRTE"),
};

function checksum(payload) {
  let value = 0;
  for (const byte of payload) value = (value + byte) >>> 0;
  return value;
}

function encodeMessage(command, argument0 = 0, argument1 = 0, payload = Buffer.alloc(0)) {
  const body = Buffer.from(payload);
  if (body.length > MAX_PAYLOAD) throw new Error("ADB payload exceeds 4096 bytes.");
  const header = Buffer.alloc(24);
  header.writeUInt32LE(command >>> 0, 0);
  header.writeUInt32LE(argument0 >>> 0, 4);
  header.writeUInt32LE(argument1 >>> 0, 8);
  header.writeUInt32LE(body.length, 12);
  header.writeUInt32LE(checksum(body), 16);
  header.writeUInt32LE((command ^ 0xffffffff) >>> 0, 20);
  return Buffer.concat([header, body]);
}

function decodeMessage(header, payload) {
  if (!Buffer.isBuffer(header) || header.length !== 24) throw new Error("Invalid ADB header.");
  const command = header.readUInt32LE(0);
  const argument0 = header.readUInt32LE(4);
  const argument1 = header.readUInt32LE(8);
  const length = header.readUInt32LE(12);
  if (header.readUInt32LE(20) !== ((command ^ 0xffffffff) >>> 0)) throw new Error("Invalid ADB message magic.");
  if (length !== payload.length || length > MAX_PAYLOAD || checksum(payload) !== header.readUInt32LE(16)) {
    throw new Error("Invalid ADB message payload.");
  }
  return { command, argument0, argument1, payload };
}

function syncPacket(identifier, payload) {
  const id = Buffer.from(identifier, "ascii");
  const body = Buffer.from(payload);
  if (id.length !== 4) throw new Error("Invalid ADB sync identifier.");
  const header = Buffer.alloc(8);
  id.copy(header, 0);
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

function syncHeader(identifier, value) {
  const header = Buffer.alloc(8);
  Buffer.from(identifier, "ascii").copy(header, 0);
  header.writeUInt32LE(value >>> 0, 4);
  return header;
}

function checkedShellCommand(command, token) {
  if (!/^[A-Za-z0-9]+$/.test(token)) throw new Error("Invalid shell status token.");
  return "{ " + command + "; }; __dji_status=$?; printf '\\n__DJI_STATUS_" + token + "_%u__\\n' \"$__dji_status\"";
}

function parseCheckedShellOutput(raw, token) {
  const pattern = new RegExp("__DJI_STATUS_" + token + "_(\\d+)__", "g");
  const matches = [...String(raw || "").matchAll(pattern)];
  const match = matches.at(-1);
  if (!match) throw new Error("The module shell did not return an exit status.");
  return { output: String(raw).slice(0, match.index).trim(), status: Number(match[1]) };
}

function loadUsb() {
  const moduleValue = require("usb");
  return moduleValue.usb || moduleValue;
}

function deviceDescriptor(device) {
  return device && (device.deviceDescriptor || device.descriptor) || {};
}

function interfaceDescriptor(iface) {
  return iface && iface.descriptor || {};
}

function interfaceNumber(iface) {
  const item = interfaceDescriptor(iface);
  return Number(item.bInterfaceNumber === undefined ? iface && iface.interfaceNumber : item.bInterfaceNumber);
}

function isAdbInterface(iface) {
  const item = interfaceDescriptor(iface);
  return Number(item.bInterfaceClass) === 0xff &&
    Number(item.bInterfaceSubClass) === 0x42 &&
    Number(item.bInterfaceProtocol) === 0x01;
}

function transfer(endpoint, value) {
  return new Promise((resolve, reject) => {
    endpoint.transfer(value, (error, data) => error ? reject(error) : resolve(Buffer.from(data || [])));
  });
}

function bulkEndpoints(iface) {
  const endpoints = iface && iface.endpoints || [];
  const bulk = (item) => item.transferType === 2 || item.transferType === "bulk";
  return {
    input: endpoints.find((item) => item.direction === "in" && bulk(item)),
    output: endpoints.find((item) => item.direction === "out" && bulk(item)),
  };
}

function releaseInterface(device, iface) {
  return new Promise((resolve) => {
    const close = () => {
      try { if (device) device.close(); } catch {}
      resolve();
    };
    if (!iface || !iface.isClaimed || typeof iface.release !== "function") return close();
    try { iface.release(true, close); } catch { close(); }
  });
}

function adbDriverHelp(error) {
  const suffix = error && error.message ? " (" + error.message + ")" : "";
  return new Error(
    "Windows cannot open the QDC507 ADB interface" + suffix +
    ". Bind WinUSB only to USB\\VID_2C7C&PID_0125&MI_06 (or the detected ff/42/01 interface). " +
    "Do not replace the composite, ECM, AT, NMEA, modem, or USB audio drivers."
  );
}

class AdbUsbConnection {
  constructor(options = {}) {
    this.usb = options.usb || loadUsb();
    this.device = null;
    this.iface = null;
    this.input = null;
    this.output = null;
    this.pending = Buffer.alloc(0);
    this.remoteMaxPayload = MAX_PAYLOAD;
    this.nextLocalId = 1;
  }

  findDevice() {
    const devices = this.usb.getDeviceList ? this.usb.getDeviceList() : [];
    return devices.find((device) => {
      const item = deviceDescriptor(device);
      return TARGET_IDS.has(Number(item.idVendor).toString(16) + ":" + Number(item.idProduct).toString(16));
    }) || null;
  }

  async open() {
    if (this.device) return this;
    const device = this.findDevice();
    if (!device) throw new Error("No supported QDC507 USB device was found.");
    try { device.open(); } catch (error) { throw adbDriverHelp(error); }
    const interfaces = device.interfaces || [];
    const iface = interfaces.find(isAdbInterface);
    if (!iface) {
      try { device.close(); } catch {}
      throw new Error("The QDC507 ADB interface is not present. Enable the ADB/UAC USB functions and reconnect first.");
    }
    const endpoints = bulkEndpoints(iface);
    if (!endpoints.input || !endpoints.output) {
      try { device.close(); } catch {}
      throw new Error("The QDC507 ADB interface has no usable bulk endpoints.");
    }
    try {
      if (process.platform !== "win32" && iface.isKernelDriverActive && iface.isKernelDriverActive()) iface.detachKernelDriver();
      iface.claim();
    } catch (error) {
      try { device.close(); } catch {}
      throw adbDriverHelp(error);
    }
    this.device = device;
    this.iface = iface;
    this.input = endpoints.input;
    this.output = endpoints.output;
    this.input.timeout = 1000;
    this.output.timeout = 3000;
    return this;
  }

  async close() {
    const device = this.device;
    const iface = this.iface;
    this.device = null;
    this.iface = null;
    this.input = null;
    this.output = null;
    this.pending = Buffer.alloc(0);
    await releaseInterface(device, iface);
  }

  async write(command, argument0 = 0, argument1 = 0, payload = Buffer.alloc(0)) {
    if (!this.output) throw new Error("ADB USB is not open.");
    await transfer(this.output, encodeMessage(command, argument0, argument1, payload));
  }

  async readExactly(length, deadline) {
    while (this.pending.length < length) {
      if (Date.now() >= deadline) throw new Error("Timed out waiting for QDC507 ADB data.");
      this.input.timeout = Math.max(100, Math.min(1000, deadline - Date.now()));
      try {
        const chunk = await transfer(this.input, Math.max(1, Math.min(MAX_PAYLOAD + 24, length - this.pending.length)));
        if (chunk.length) this.pending = Buffer.concat([this.pending, chunk]);
      } catch (error) {
        if (!/timed? ?out|LIBUSB_ERROR_TIMEOUT/i.test(String(error && error.message || error))) throw error;
      }
    }
    const result = this.pending.subarray(0, length);
    this.pending = this.pending.subarray(length);
    return result;
  }

  async receive(timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    const header = await this.readExactly(24, deadline);
    const length = header.readUInt32LE(12);
    if (length > MAX_PAYLOAD) throw new Error("QDC507 returned an oversized ADB payload.");
    return decodeMessage(header, await this.readExactly(length, deadline));
  }

  async connect() {
    await this.open();
    const banner = Buffer.from("host::DJI4GAssistant\0", "utf8");
    await this.write(COMMANDS.CNXN, 0x01000001, MAX_PAYLOAD, banner);
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const message = await this.receive(Math.max(200, deadline - Date.now()));
      if (message.command === COMMANDS.AUTH) throw new Error("The QDC507 ADB interface still requires authorization.");
      if (message.command === COMMANDS.CNXN) {
        this.remoteMaxPayload = Math.max(256, Math.min(MAX_PAYLOAD, message.argument1 || MAX_PAYLOAD));
        return this;
      }
      if ([COMMANDS.WRTE, COMMANDS.OKAY, COMMANDS.CLSE].includes(message.command) && message.argument0 && message.argument1) {
        await this.write(COMMANDS.CLSE, message.argument1, message.argument0);
        await this.write(COMMANDS.CNXN, 0x01000001, MAX_PAYLOAD, banner);
        continue;
      }
      throw new Error("The QDC507 did not accept the ADB connection.");
    }
    throw new Error("Timed out connecting to the QDC507 ADB interface.");
  }

  allocateLocalId() {
    const value = this.nextLocalId >>> 0 || 1;
    this.nextLocalId = (value + 1) >>> 0 || 1;
    return value;
  }

  async openService(service) {
    const localId = this.allocateLocalId();
    const payload = Buffer.concat([Buffer.from(service, "utf8"), Buffer.from([0])]);
    await this.write(COMMANDS.OPEN, localId, 0, payload);
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const message = await this.receive(Math.max(200, deadline - Date.now()));
      if (message.command === COMMANDS.OKAY && message.argument0 && message.argument1 === localId) {
        return { localId, remoteId: message.argument0 };
      }
      if (message.command === COMMANDS.CLSE && message.argument1 === localId) throw new Error("The QDC507 rejected the ADB service.");
      if ([COMMANDS.WRTE, COMMANDS.OKAY, COMMANDS.CLSE].includes(message.command) && message.argument0 && message.argument1) {
        await this.write(COMMANDS.CLSE, message.argument1, message.argument0);
        continue;
      }
      throw new Error("Unexpected ADB response while opening a service.");
    }
    throw new Error("Timed out opening a QDC507 ADB service.");
  }

  async closeStream(stream) {
    await this.write(COMMANDS.CLSE, stream.localId, stream.remoteId);
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const message = await this.receive(Math.max(200, deadline - Date.now()));
      if (message.command === COMMANDS.CLSE && message.argument0 === stream.remoteId && message.argument1 === stream.localId) return;
      if (message.command === COMMANDS.WRTE && message.argument0 === stream.remoteId && message.argument1 === stream.localId) {
        await this.write(COMMANDS.OKAY, stream.localId, stream.remoteId);
        continue;
      }
      throw new Error("Unexpected ADB response while closing a service.");
    }
    throw new Error("Timed out closing a QDC507 ADB service.");
  }

  async writeStream(stream, payload) {
    const data = Buffer.from(payload);
    if (data.length > this.remoteMaxPayload) throw new Error("ADB stream payload is too large.");
    await this.write(COMMANDS.WRTE, stream.localId, stream.remoteId, data);
    const response = await this.receive(10000);
    if (response.command !== COMMANDS.OKAY || response.argument0 !== stream.remoteId || response.argument1 !== stream.localId) {
      throw new Error("The QDC507 did not acknowledge ADB stream data.");
    }
  }

  async shell(command, timeoutMs = 15000) {
    const stream = await this.openService("shell:" + command);
    const chunks = [];
    let size = 0;
    const deadline = Date.now() + timeoutMs;
    try {
      while (Date.now() < deadline) {
        const message = await this.receive(Math.max(200, deadline - Date.now()));
        if (message.command === COMMANDS.WRTE && message.argument0 === stream.remoteId && message.argument1 === stream.localId) {
          size += message.payload.length;
          if (size > MAX_OUTPUT) throw new Error("QDC507 shell output is too large.");
          chunks.push(message.payload);
          await this.write(COMMANDS.OKAY, stream.localId, stream.remoteId);
          continue;
        }
        if (message.command === COMMANDS.CLSE && message.argument1 === stream.localId &&
            (!message.argument0 || message.argument0 === stream.remoteId)) {
          if (message.argument0) await this.write(COMMANDS.CLSE, stream.localId, stream.remoteId);
          return Buffer.concat(chunks).toString("utf8");
        }
        if (message.command === COMMANDS.OKAY && message.argument0 === stream.remoteId &&
            message.argument1 === stream.localId) continue;
        throw new Error("Unexpected ADB shell response.");
      }
      throw new Error("Timed out waiting for the QDC507 shell.");
    } catch (error) {
      try { await this.closeStream(stream); } catch {}
      throw error;
    }
  }

  async shellChecked(command, timeoutMs = 15000) {
    const token = crypto.randomBytes(12).toString("hex");
    return parseCheckedShellOutput(await this.shell(checkedShellCommand(command, token), timeoutMs), token);
  }

  async push(data, remotePath, mode = 0o100755) {
    if (!remotePath || /[,\0]/.test(remotePath)) throw new Error("Invalid ADB destination path.");
    const stream = await this.openService("sync:");
    let closed = false;
    try {
      await this.writeStream(stream, syncPacket("SEND", Buffer.from(remotePath + "," + mode, "utf8")));
      const source = Buffer.from(data);
      const chunkSize = Math.max(256, this.remoteMaxPayload - 8);
      for (let offset = 0; offset < source.length; offset += chunkSize) {
        await this.writeStream(stream, syncPacket("DATA", source.subarray(offset, Math.min(source.length, offset + chunkSize))));
      }
      await this.writeStream(stream, syncHeader("DONE", Math.floor(Date.now() / 1000)));
      let response = Buffer.alloc(0);
      const deadline = Date.now() + 20000;
      while (response.length < 8 && Date.now() < deadline) {
        const message = await this.receive(Math.max(200, deadline - Date.now()));
        if (message.command !== COMMANDS.WRTE || message.argument0 !== stream.remoteId ||
            message.argument1 !== stream.localId) throw new Error("Unexpected ADB sync response.");
        response = Buffer.concat([response, message.payload]);
        await this.write(COMMANDS.OKAY, stream.localId, stream.remoteId);
      }
      if (response.length < 8) throw new Error("Incomplete ADB sync response.");
      const identifier = response.subarray(0, 4).toString("ascii");
      const value = response.readUInt32LE(4);
      if (identifier === "FAIL") {
        while (response.length < 8 + value) {
          const message = await this.receive(Math.max(200, deadline - Date.now()));
          if (message.command !== COMMANDS.WRTE) throw new Error("Incomplete ADB sync failure response.");
          response = Buffer.concat([response, message.payload]);
          await this.write(COMMANDS.OKAY, stream.localId, stream.remoteId);
        }
        throw new Error("The QDC507 rejected the file transfer: " + response.subarray(8, 8 + value).toString("utf8"));
      }
      if (identifier !== "OKAY" || value !== 0) throw new Error("Invalid ADB sync completion response.");
      await this.closeStream(stream);
      closed = true;
    } finally {
      if (!closed) {
        try { await this.closeStream(stream); } catch {}
      }
    }
  }
}

async function withAdb(task, options = {}) {
  const connection = new AdbUsbConnection(options);
  try {
    await connection.connect();
    return await task(connection);
  } finally {
    await connection.close();
  }
}

module.exports = {
  AdbUsbConnection,
  COMMANDS,
  MAX_PAYLOAD,
  adbCommand,
  checksum,
  encodeMessage,
  decodeMessage,
  syncPacket,
  syncHeader,
  checkedShellCommand,
  parseCheckedShellOutput,
  isAdbInterface,
  withAdb,
};
