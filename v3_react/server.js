const path = require("path");
const { readJson, writeJson, runExclusive } = require("./helpers");
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
  const { cardIds } = req.body || {};
  if (!Array.isArray(cardIds)) {
    return res.status(400).json({ error: "cardIds must be an array" });
  }

  try {
    await runExclusive("cards.json", async () => {
      const cards = await readJson("cards.json");
      const byId = new Map(cards.map((c) => [String(c.id), c]));

      // Move each card in the list to the target column and set ascending sort order
      cardIds.forEach((id, idx) => {
        const card = byId.get(String(id));
        if (card) {
          card.columnId = columnId;
          card.columnSortOrder = idx + 1;
          card.updatedAt = new Date().toISOString();
        }
      });

      // Also re-number any remaining cards still in this column that are not in cardIds
      // ensuring they follow after the provided list (helps if client sends partial list)
      let nextOrder = cardIds.length + 1;
      cards.forEach((card) => {
        if (card.columnId === columnId && !cardIds.includes(String(card.id))) {
          card.columnSortOrder = nextOrder++;
        }
      });

      await writeJson("cards.json", cards);
    });
    res.json({ ok: true, columnId, count: cardIds.length });
  } catch (err) {
    console.error("Error updating column order", err);
    res
      .status(500)
      .json({ error: "Failed to update order", details: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Kanban v3_react server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
