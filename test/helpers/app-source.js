// 按加载顺序拼接前端分片，还原成拆分前的单文件文本，供测试做 indexOf 线性切片。
const fs = require("node:fs");
const path = require("node:path");

const PUBLIC_DIR = path.join(__dirname, "..", "..", "web", "public");
const PARTS = ["core.js", "euicc.js", "sms.js", "calls.js", "audio.js", "call-flow.js", "api.js", "automation.js", "profile-actions.js", "init.js"];

function readAppSource() {
  return PARTS.map((name) => fs.readFileSync(path.join(PUBLIC_DIR, name), "utf8")).join("\n");
}

module.exports = { readAppSource, PUBLIC_DIR, PARTS };
