const path = require("path");
const fs = require("fs").promises;
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PRIVATE_DIR = path.join(ROOT, "private");
const WEB_DIR = path.join(ROOT, "web");

// Static site
app.use(express.static(WEB_DIR));

async function readJson(filename) {
  const filePath = path.join(PRIVATE_DIR, filename);
  const buf = await fs.readFile(filePath);
  return JSON.parse(buf.toString());
}

app.get("/api/columns", async (req, res) => {
  try {
    const data = await readJson("columns.json");
    res.json(data);
  } catch (err) {
    console.error("Error reading columns.json", err);
    res.status(500).json({ error: "Failed to load columns" });
  }
});

app.get("/api/cards", async (req, res) => {
  try {
    const data = await readJson("cards.json");
    res.json(data);
  } catch (err) {
    console.error("Error reading cards.json", err);
    res.status(500).json({ error: "Failed to load cards" });
  }
});

app.listen(PORT, () => {
  console.log(`Kanban v3_react server running at http://localhost:${PORT}`);
});
