const path = require("path");
const {
  readJson,
  writeJson,
  runExclusive,
  ensureDataFiles,
} = require("./helpers");
const { applyColumnOrder } = require("./processing");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const WEB_DIR = path.join(ROOT, "web");

// Static site
app.use(express.static(WEB_DIR));
app.use(express.json());

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

// Persist card order for a column (and move cards into that column)
// Payload: { cardIds: string[] }
app.put("/api/columns/:columnId/order", async (req, res) => {
  const { columnId } = req.params;
  const { cardIds, movedCardId } = req.body || {};
  if (!Array.isArray(cardIds)) {
    return res.status(400).json({ error: "cardIds must be an array" });
  }
  if (movedCardId === undefined || movedCardId === null) {
    return res.status(400).json({ error: "movedCardId is required" });
  }

  try {
    const result = await applyColumnOrder({ columnId, cardIds, movedCardId });
    res.json({ ok: true, columnId: result.columnId, count: result.count });
  } catch (err) {
    console.error("Error updating column order", err);
    res
      .status(500)
      .json({ error: "Failed to update order", details: err.message });
  }
});

if (require.main === module) {
  // Seed missing data files from samples on server start
  ensureDataFiles().catch((err) => {
    console.error("Failed to ensure data files", err);
  });
  app.listen(PORT, () => {
    console.log(`Kanban v3_react server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
