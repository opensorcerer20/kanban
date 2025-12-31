const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const os = require("os");
const request = require("supertest");

// Copy fixtures into a temp PRIVATE_DIR for each test run
async function setupTempPrivateDir() {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "kanban-v3-"));
  const privateDir = tmpRoot; // use tmpRoot directly as PRIVATE_DIR
  // Ensure files exist in tmp dir
  const sourcePrivate = path.join(__dirname, "..", "private");
  const files = ["columns.json", "cards.json"];
  for (const file of files) {
    const src = path.join(sourcePrivate, file);
    const dest = path.join(privateDir, file);
    const buf = await fsp.readFile(src);
    await fsp.writeFile(dest, buf);
  }
  return {
    privateDir,
    cleanup: async () => {
      /* leave tmp for debugging */
    },
  };
}

let app;
let fixtures;

beforeAll(async () => {
  fixtures = await setupTempPrivateDir();
  process.env.PRIVATE_DIR = fixtures.privateDir;
  app = require("../server");
});

afterAll(async () => {
  if (fixtures && fixtures.cleanup) await fixtures.cleanup();
});

function readJson(filename) {
  const p = path.join(process.env.PRIVATE_DIR, filename);
  const content = fs.readFileSync(p, "utf8");
  return JSON.parse(content);
}

describe("API endpoints", () => {
  test("GET /api/columns returns array with known ids", async () => {
    const res = await request(app).get("/api/columns");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((c) => c.id);
    expect(ids).toContain("col-ready");
    expect(ids.length).toBeGreaterThan(0);
  });

  test("GET /api/cards returns array with columnId", async () => {
    const res = await request(app).get("/api/cards");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty("columnId");
  });

  test("PUT /api/columns/:columnId/order updates card order and moves cards", async () => {
    // Pick some ready cards and move to feedback
    const before = readJson("cards.json");
    const readyCards = before
      .filter((c) => c.columnId === "col-ready")
      .map((c) => c.id);
    const moveIds = readyCards.slice(0, 2); // move first two

    const res = await request(app)
      .put("/api/columns/col-feedback/order")
      .send({ cardIds: moveIds, movedCardId: moveIds[0] })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, columnId: "col-feedback" });

    const after = readJson("cards.json");
    // Confirm moved cards columnId and sort order
    moveIds.forEach((id, idx) => {
      const card = after.find((c) => String(c.id) === String(id));
      expect(card.columnId).toBe("col-feedback");
      expect(card.columnSortOrder).toBe(idx + 1);
    });

    // Only the moved card's updatedAt changes
    const beforeMoved = before.find((c) => String(c.id) === String(moveIds[0]));
    const afterMoved = after.find((c) => String(c.id) === String(moveIds[0]));
    expect(afterMoved.updatedAt).not.toBe(beforeMoved.updatedAt);
    const beforeUnmoved = before.find(
      (c) => String(c.id) === String(moveIds[1])
    );
    const afterUnmoved = after.find((c) => String(c.id) === String(moveIds[1]));
    expect(afterUnmoved.updatedAt).toBe(beforeUnmoved.updatedAt);

    // Confirm remaining ready cards still in col-ready
    const stillReady = after.filter((c) => c.columnId === "col-ready");
    expect(stillReady.length).toBeGreaterThan(0);
  });

  test("PUT order rejects missing movedCardId", async () => {
    const before = readJson("cards.json");
    const readyCards = before
      .filter((c) => c.columnId === "col-ready")
      .map((c) => c.id);
    const moveIds = readyCards.slice(0, 1);

    const res = await request(app)
      .put("/api/columns/col-feedback/order")
      .send({ cardIds: moveIds })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("serializes concurrent writes to cards.json", async () => {
    const before = readJson("cards.json");
    const readyIds = before
      .filter((c) => c.columnId === "col-ready")
      .map((c) => c.id);
    expect(readyIds.length).toBeGreaterThan(2);

    const a = readyIds[0];
    const b = readyIds[1];

    // Concurrently move A to feedback and B to complete
    const [res1, res2] = await Promise.all([
      request(app)
        .put("/api/columns/col-feedback/order")
        .send({ cardIds: [a], movedCardId: a })
        .set("Content-Type", "application/json"),
      request(app)
        .put("/api/columns/col-complete/order")
        .send({ cardIds: [b], movedCardId: b })
        .set("Content-Type", "application/json"),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const after = readJson("cards.json");
    const cardA = after.find((c) => String(c.id) === String(a));
    const cardB = after.find((c) => String(c.id) === String(b));
    expect(cardA.columnId).toBe("col-feedback");
    expect(cardA.columnSortOrder).toBe(1);
    expect(cardB.columnId).toBe("col-complete");
    expect(cardB.columnSortOrder).toBe(1);
  });
});
