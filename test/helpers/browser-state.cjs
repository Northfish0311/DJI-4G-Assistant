const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../../web/public/core.js"), "utf8");
const translations = fs.readFileSync(path.join(__dirname, "../../web/public/i18n.js"), "utf8");
const start = app.indexOf("const state =");
const end = app.indexOf("function applyLanguage()");
assert.ok(start >= 0 && end > start, "Browser state fixture boundaries must exist");
module.exports = translations + "\n" + app.slice(start, end);
