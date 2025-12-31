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

async function ensureDataFiles() {
  const cardsPath = path.join(PRIVATE_DIR, "cards.json");
  const columnsPath = path.join(PRIVATE_DIR, "columns.json");
  const cardsSamplePath = path.join(ROOT, "private", "cards_sample.json");
  const columnsSamplePath = path.join(ROOT, "private", "columns_sample.json");

  // Helper to check existence
  async function exists(p) {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  // If cards.json is missing, seed from sample
  if (!(await exists(cardsPath))) {
    const buf = await fs.readFile(cardsSamplePath);
    const data = JSON.parse(buf.toString());
    await writeJson("cards.json", data);
  }

  // If columns.json is missing, seed from sample
  if (!(await exists(columnsPath))) {
    const buf = await fs.readFile(columnsSamplePath);
    const data = JSON.parse(buf.toString());
    await writeJson("columns.json", data);
  }
}

module.exports = {
  readJson,
  writeJson,
  runExclusive,
  PRIVATE_DIR,
  ensureDataFiles,
};
