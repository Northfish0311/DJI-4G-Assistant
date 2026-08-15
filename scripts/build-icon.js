const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const width = 256;
const height = 256;
const pixels = Buffer.alloc(width * height * 4);

function setPixel(x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (y * width + x) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = color[3] ?? 255;
}

function fillRoundedRect(x, y, w, h, radius, color) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      const cx = Math.max(x + radius, Math.min(px, x + w - radius - 1));
      const cy = Math.max(y + radius, Math.min(py, y + h - radius - 1));
      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy <= radius * radius) setPixel(px, py, color);
    }
  }
}

function fillRect(x, y, w, h, color) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) setPixel(px, py, color);
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

fillRoundedRect(12, 12, 232, 232, 50, [24, 33, 43, 255]);
fillRoundedRect(35, 68, 174, 120, 26, [244, 247, 248, 255]);
fillRoundedRect(196, 99, 38, 58, 9, [111, 126, 138, 255]);
fillRect(223, 108, 11, 14, [219, 181, 89, 255]);
fillRect(223, 134, 11, 14, [219, 181, 89, 255]);

fillRoundedRect(58, 88, 82, 80, 13, [11, 114, 105, 255]);
fillRoundedRect(70, 99, 58, 58, 8, [235, 196, 95, 255]);
fillRect(97, 99, 4, 58, [11, 114, 105, 255]);
fillRect(70, 126, 58, 4, [11, 114, 105, 255]);
fillRect(82, 99, 4, 15, [11, 114, 105, 255]);
fillRect(112, 142, 4, 15, [11, 114, 105, 255]);

fillRoundedRect(153, 139, 9, 19, 4, [30, 128, 90, 255]);
fillRoundedRect(169, 124, 9, 34, 4, [30, 128, 90, 255]);
fillRoundedRect(185, 105, 9, 53, 4, [30, 128, 90, 255]);
fillRoundedRect(51, 47, 14, 14, 7, [236, 91, 77, 255]);

const raw = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y += 1) {
  const row = y * (width * 4 + 1);
  raw[row] = 0;
  pixels.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk("IHDR", ihdr),
  pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  pngChunk("IEND", Buffer.alloc(0)),
]);

const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 0;
header[7] = 0;
header[8] = 0;
header[9] = 0;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);

const output = path.join(__dirname, "..", "build");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "icon.png"), png);
fs.writeFileSync(path.join(output, "icon.ico"), Buffer.concat([header, png]));
