// test/helpers/app-source.js
// 还原拆分前 app.js 的单文件文本，供测试里 vm 线性切片使用，保持零偏移。
//
// 关键：i18n 抽离后 `const copy` 移到了 i18n.js，但测试仍用
// source.indexOf("const copy =") 定位。原始顺序是：
//   DOM 引用 → const copy → const state → function t → ...
// 所以这里把 i18n.js 的 copy 插回 core.js 的 `const state` 之前。
const fs = require("node:fs");
const path = require("node:path");

const PUBLIC_DIR = path.join(__dirname, "..", "..", "web", "public");
const PARTS = ["core.js", "euicc.js", "sms.js", "calls.js", "audio.js", "call-flow.js", "api.js", "automation.js", "profile-actions.js", "init.js"];

function readFile(name) {
  return fs.readFileSync(path.join(PUBLIC_DIR, name), "utf8");
}

// 去掉 i18n.js 首行注释（非代码）
function readI18nBody() {
  return readFile("i18n.js").replace(/^\/\/[^\n]*\n/, "");
}

function readAppSource() {
  const core = readFile("core.js");
  const i18n = readI18nBody();
  const marker = "const state =";
  const idx = core.indexOf(marker);
  if (idx < 0) throw new Error("core.js 中找不到 'const state =' 锚点");
  const before = core.slice(0, idx).trimEnd();
  const after = core.slice(idx);
  const rest = PARTS.slice(1).map(readFile);
  return [before, i18n.trimEnd(), after, ...rest].join("\n");
}

module.exports = { readAppSource, readFile, PUBLIC_DIR, PARTS };
