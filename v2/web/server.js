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

    // Reject moves for locked cards
    if (cards[idx].locked === true) {
      return res.status(400).json({ error: "Card is locked" });
    }

    cards[idx].columnId = columnId;
    cards[idx].updatedAt = new Date().toISOString();
    // If moved to Posted column, set locked = true
    const postedColumn = Array.isArray(columns)
      ? columns.find((c) => c.title === "Posted")
      : null;
    if (postedColumn && String(postedColumn.id) === String(columnId)) {
      cards[idx].locked = true;
    }
    await fs.writeFile(cardsPath, JSON.stringify(cards, null, 2));
    res.json({ ok: true, card: cards[idx] });
  } catch (err) {
    console.error("Failed to persist card move:", err);
    res.status(500).json({ error: "Failed to save card move" });
  }
});

// Update card lock state: { id: string, locked: boolean }
app.post("/api/cards/lock", async (req, res) => {
  try {
    const { id, locked } = req.body || {};
    if (!id || typeof locked !== "boolean") {
      return res.status(400).json({ error: "Missing id or locked (boolean)" });
    }

    const cardsPath = path.join(__dirname, "private", "cards.json");
    const raw = await fs.readFile(cardsPath, "utf-8");
    const cards = JSON.parse(raw);
    const idx = cards.findIndex((c) => String(c.id) === String(id));
    if (idx === -1) {
      return res.status(404).json({ error: "Card not found" });
    }

    cards[idx].locked = locked;
    await fs.writeFile(cardsPath, JSON.stringify(cards, null, 2));
    res.json({ ok: true, card: cards[idx] });
  } catch (err) {
    console.error("Failed to update lock state:", err);
    res.status(500).json({ error: "Failed to update lock state" });
  }
});

// Bulk add cards by titles: { titles: ["Title A", "Title B", ...] }
app.post("/api/cards/addTitles", async (req, res) => {
  try {
    const { titles } = req.body || {};
    if (!Array.isArray(titles) || titles.length === 0) {
      return res
        .status(400)
        .json({ error: "Provide non-empty array of titles" });
    }

    const privateDir = path.join(__dirname, "private");
    const cardsPath = path.join(privateDir, "cards.json");
    const columnsPath = path.join(privateDir, "columns.json");

    const [cardsRaw, columnsRaw] = await Promise.all([
      fs.readFile(cardsPath, "utf-8"),
      fs.readFile(columnsPath, "utf-8"),
    ]);
    const cards = JSON.parse(cardsRaw);
    const columns = JSON.parse(columnsRaw);

    // Default to "Ready" column explicitly; error if not present
    const readyColumn =
      Array.isArray(columns) && columns.find((c) => c.title === "Ready");
    if (!readyColumn) {
      return res.status(400).json({ error: "Ready column not found" });
    }
    const defaultColumnId = readyColumn.id;

    // Compute next numeric id and ticket suffix
    const currentIds = cards
      .map((c) => Number(String(c.id).replace(/\D/g, "")))
      .filter((n) => !Number.isNaN(n));
    const currentTicketNums = cards
      .map((c) => {
        const m = String(c.ticketId || "").match(/(\d+)$/);
        return m ? Number(m[1]) : NaN;
      })
      .filter((n) => !Number.isNaN(n));
    let nextId = currentIds.length ? Math.max(...currentIds) + 1 : 1;
    let nextTicket = currentTicketNums.length
      ? Math.max(...currentTicketNums) + 1
      : 1;

    const newCards = [];
    for (const rawTitle of titles) {
      const title = String(rawTitle).trim();
      if (!title) continue;
      const idStr = String(nextId);
      const ticketId = `PROJ-${String(nextTicket).padStart(3, "0")}`;
      newCards.push({
        id: idStr,
        title,
        columnId: defaultColumnId,
        ticketId,
        description: "",
        tags: [],
        updatedAt: new Date().toISOString(),
        locked: false,
      });
      nextId += 1;
      nextTicket += 1;
    }

    if (newCards.length === 0) {
      return res.status(400).json({ error: "No valid titles to add" });
    }

    const updated = [...cards, ...newCards];
    await fs.writeFile(cardsPath, JSON.stringify(updated, null, 2));
    res.json({ ok: true, added: newCards.length, cards: newCards });
  } catch (err) {
    console.error("Failed to add titles:", err);
    res.status(500).json({ error: "Failed to add titles" });
  }
});

// Fallback: serve index.html for all non-API GET routes (SPA support)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});
