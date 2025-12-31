import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Serve board data from private JSON files (not statically exposed)
app.get("/api/board", async (req, res) => {
  try {
    const privateDir = path.join(__dirname, "private");
    const [columnsRaw, cardsRaw] = await Promise.all([
      fs.readFile(path.join(privateDir, "columns.json"), "utf-8"),
      fs.readFile(path.join(privateDir, "cards.json"), "utf-8"),
    ]);
    const columns = JSON.parse(columnsRaw);
    const cards = JSON.parse(cardsRaw);
    res.json({ columns, cards });
  } catch (err) {
    console.error("Failed to read board data:", err);
    res.status(500).json({ error: "Failed to load board data" });
  }
});

// Persist card movement: update cards.json with new columnId
app.post("/api/cards/move", async (req, res) => {
  try {
    const { id, columnId } = req.body || {};
    if (!id || !columnId) {
      return res.status(400).json({ error: "Missing id or columnId" });
    }
    // Validate columnId exists
    const columnsPath = path.join(__dirname, "private", "columns.json");
    const columnsRaw = await fs.readFile(columnsPath, "utf-8");
    const columns = JSON.parse(columnsRaw);
    const columnExists =
      Array.isArray(columns) &&
      columns.some((col) => String(col.id) === String(columnId));
    if (!columnExists) {
      return res.status(400).json({ error: "Invalid columnId" });
    }

    const cardsPath = path.join(__dirname, "private", "cards.json");
    const raw = await fs.readFile(cardsPath, "utf-8");
    const cards = JSON.parse(raw);
    const idx = cards.findIndex((c) => String(c.id) === String(id));
    if (idx === -1) {
      return res.status(404).json({ error: "Card not found" });
    }

    cards[idx].columnId = columnId;
    await fs.writeFile(cardsPath, JSON.stringify(cards, null, 2));
    res.json({ ok: true, card: cards[idx] });
  } catch (err) {
    console.error("Failed to persist card move:", err);
    res.status(500).json({ error: "Failed to save card move" });
  }
});

// Fallback: serve index.html for all non-API GET routes (SPA support)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});
