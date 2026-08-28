const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TOKEN_FILE = "console-token.txt";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function isValidConsoleToken(value) {
  return TOKEN_PATTERN.test(String(value || "").trim());
}

function loadOrCreateConsoleToken(dataRoot, randomBytes = crypto.randomBytes) {
  if (!dataRoot) throw new Error("A writable data directory is required.");
  fs.mkdirSync(dataRoot, { recursive: true });
  const tokenPath = path.join(dataRoot, TOKEN_FILE);
  try {
    const existing = fs.readFileSync(tokenPath, "utf8").trim();
    if (isValidConsoleToken(existing)) return existing;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const token = randomBytes(32).toString("base64url");
  fs.writeFileSync(tokenPath, `${token}\n`, { encoding: "utf8", mode: 0o600 });
  return token;
}

function buildPairingDeepLink(baseUrl, token) {
  const target = new URL("dji4g://pair");
  target.searchParams.set("url", String(baseUrl || ""));
  target.searchParams.set("token", String(token || ""));
  return target.toString();
}

module.exports = { TOKEN_FILE, isValidConsoleToken, loadOrCreateConsoleToken, buildPairingDeepLink };
