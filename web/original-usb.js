"use strict";

// This adapter intentionally only speaks to an untouched 2CA3:4006 module.
// It discovers an AT bulk pair by asking every candidate interface for "AT".
const STOCK_VENDOR_ID = 0x2ca3;
const STOCK_PRODUCT_ID = 0x4006;
const TARGET_VENDOR_ID = 0x2c7c;
const TARGET_PRODUCT_ID = 0x0125;

function loadUsb() {
  try {
    return require("usb");
  } catch (error) {
    const message = error.code === "MODULE_NOT_FOUND"
      ? "Raw USB support is not installed. Run npm install in this project first."
      : `Raw USB support could not start: ${error.message}`;
    throw new Error(message);
  }
}

function usbApi(moduleValue) {
  return moduleValue.usb || moduleValue;
}

function descriptor(device) {
  return device.deviceDescriptor || device.descriptor || {};
}

function findStockDevice(api) {
  if (typeof api.findByIds === "function") return api.findByIds(STOCK_VENDOR_ID, STOCK_PRODUCT_ID);
  if (typeof api.getDeviceList === "function") {
    return api.getDeviceList().find((device) => {
      const item = descriptor(device);
      return item.idVendor === STOCK_VENDOR_ID && item.idProduct === STOCK_PRODUCT_ID;
    });
  }
  throw new Error("The installed USB package does not expose a compatible device enumeration API.");
}

function transfer(endpoint, payload) {
  return new Promise((resolve, reject) => {
    endpoint.transfer(payload, (error, data) => error ? reject(error) : resolve(data));
  });
}

function waitFor(endpoint, timeoutMs) {
  endpoint.timeout = timeoutMs;
  return transfer(endpoint, 1024).then((value) => Buffer.from(value || "").toString("utf8"));
}

function release(device, iface) {
  try {
    if (iface?.isClaimed && typeof iface.release === "function") iface.release(true, () => {});
  } catch (_) {}
  try { device?.close(); } catch (_) {}
}

async function openBridge() {
  const api = usbApi(loadUsb());
  const device = findStockDevice(api);
  if (!device) throw new Error("No untouched DJI/Baiwang USB module (2CA3:4006) was found.");

  try {
    device.open();
  } catch (error) {
    throw new Error(`Windows could not open the original module: ${error.message}. Bind WinUSB to the original USB function, then try again.`);
  }

  const interfaces = device.interfaces || [];
  for (const iface of interfaces) {
    const endpoints = iface.endpoints || [];
    const input = endpoints.find((endpoint) => endpoint.direction === "in" && (endpoint.transferType === 2 || endpoint.transferType === "bulk"));
    const output = endpoints.find((endpoint) => endpoint.direction === "out" && (endpoint.transferType === 2 || endpoint.transferType === "bulk"));
    if (!input || !output) continue;

    try {
      iface.claim();
      output.timeout = 2500;
      await transfer(output, Buffer.from("AT\r", "ascii"));
      const reply = await waitFor(input, 2500);
      if (/\bOK\b/i.test(reply)) {
        return { device, iface, input, output, firstReply: reply };
      }
    } catch (_) {
      // Another candidate may be the actual modem control interface.
    }
    release(device, iface);
    try { device.open(); } catch (_) {}
  }

  release(device);
  throw new Error("The original module was found, but no USB interface returned OK to AT.");
}

async function command(bridge, value, timeoutMs = 5000) {
  bridge.output.timeout = timeoutMs;
  await transfer(bridge.output, Buffer.from(`${value}\r`, "ascii"));
  let output = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    output += await waitFor(bridge.input, Math.max(200, deadline - Date.now()));
    if (/(^|\r?\n)(OK|ERROR)(\r?\n|$)/i.test(output)) break;
  }
  return output;
}

async function inspect() {
  const bridge = await openBridge();
  try {
    const outputs = {};
    for (const item of ["ATI", "AT+GMR", "AT+QCFG=\"usbnet\"", "AT+QCFG=\"usbcfg\""]) {
      outputs[item] = await command(bridge, item);
    }
    return {
      ok: true,
      usb: { vendorId: "2CA3", productId: "4006" },
      firstReply: bridge.firstReply,
      outputs,
    };
  } finally {
    release(bridge.device, bridge.iface);
  }
}

function targetUsbConfig(output) {
  const match = String(output || "").match(/\+QCFG:\s*"usbcfg"\s*,\s*([^\r\n]+)/i);
  if (!match) throw new Error("The module did not return a parseable AT+QCFG=\"usbcfg\" baseline.");
  const values = match[1].split(",").map((item) => item.trim()).filter(Boolean);
  if (values.length < 2 || !/^(?:0x)?2ca3$/i.test(values[0]) || !/^(?:0x)?4006$/i.test(values[1])) {
    throw new Error("The original USB identity did not match the expected 2CA3:4006 baseline.");
  }
  values[0] = "0x2C7C";
  values[1] = "0x0125";
  return `AT+QCFG="usbcfg",${values.join(",")}`;
}

async function convert({ onBaseline } = {}) {
  const bridge = await openBridge();
  try {
    const baseline = await command(bridge, "AT+QCFG=\"usbcfg\"");
    const writeCommand = targetUsbConfig(baseline);
    if (typeof onBaseline === "function") {
      await onBaseline({
        capturedAt: new Date().toISOString(),
        usb: { vendorId: "2CA3", productId: "4006" },
        usbcfg: baseline,
        writeCommand,
      });
    }
    const writeReply = await command(bridge, writeCommand, 8000);
    if (!/(^|\r?\n)OK(\r?\n|$)/i.test(writeReply)) throw new Error("The module rejected the USB identity change. No reboot command was sent.");
    bridge.output.timeout = 2500;
    await transfer(bridge.output, Buffer.from("AT+CFUN=1,1\r", "ascii"));
    return { ok: true, baseline, writeCommand, message: "USB identity saved. The module is restarting; unplug and reconnect it after its light settles." };
  } finally {
    release(bridge.device, bridge.iface);
  }
}

module.exports = {
  STOCK_VENDOR_ID,
  STOCK_PRODUCT_ID,
  TARGET_VENDOR_ID,
  TARGET_PRODUCT_ID,
  inspect,
  convert,
};
