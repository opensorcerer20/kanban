const path = require("path");
const fs = require("fs").promises;

const ROOT = __dirname;
const PRIVATE_DIR = process.env.PRIVATE_DIR || path.join(ROOT, "private");

async function readJson(filename) {
  const filePath = path.join(PRIVATE_DIR, filename);
  const buf = await fs.readFile(filePath);
  return JSON.parse(buf.toString());
}

async function writeJson(filename, data) {
  const filePath = path.join(PRIVATE_DIR, filename);
  let str;
  try {
    str = JSON.stringify(data, null, 2);
  } catch (e) {
    throw new Error("Invalid JSON data: stringify failed");
  }
  // Validate that the string is parseable JSON before writing
  try {
    JSON.parse(str);
  } catch (e) {
    throw new Error("Invalid JSON output: parse check failed");
  }
  // Atomic write: write to temp file then rename
  const tmpPath = filePath + ".tmp";
  await fs.writeFile(tmpPath, str);
  await fs.rename(tmpPath, filePath);
}

// Serialize writes to a file to prevent race conditions
const fileQueues = new Map();
function runExclusive(filename, fn) {
  const key = path.join(PRIVATE_DIR, filename);
  const prev = fileQueues.get(key) || Promise.resolve();
  const next = prev.then(() => fn());
  // Keep chain alive even if fn throws
  fileQueues.set(
    key,
    next.catch(() => {})
  );
  return next;
}

module.exports = {
  readJson,
  writeJson,
  runExclusive,
  PRIVATE_DIR,
};
