const { readJson, writeJson, runExclusive } = require("./helpers");

/**
 * Apply a new order to a column and persist it.
 * Only the movedCardId gets its updatedAt changed.
 *
 * @param {Object} params
 * @param {string} params.columnId - Target column ID
 * @param {Array<string|number>} params.cardIds - Ordered list of card IDs for the target column
 * @param {string|number} params.movedCardId - The card that was actively moved
 * @returns {Promise<{columnId: string, count: number}>}
 */
async function applyColumnOrder({ columnId, cardIds, movedCardId }) {
  const movedIdStr = movedCardId != null ? String(movedCardId) : null;
  const targetIds = new Set((cardIds || []).map((id) => String(id)));

  await runExclusive("cards.json", async () => {
    const cards = await readJson("cards.json");
    const byId = new Map(cards.map((c) => [String(c.id), c]));

    // Move each card in the list to the target column and set ascending sort order
    Array.from(targetIds).forEach((id, idx) => {
      const card = byId.get(id);
      if (card) {
        card.columnId = columnId;
        card.columnSortOrder = idx + 1;
        if (movedIdStr && id === movedIdStr) {
          card.updatedAt = new Date().toISOString();
        }
      }
    });

    // Also re-number any remaining cards still in this column that are not in cardIds
    // ensuring they follow after the provided list (helps if client sends partial list)
    let nextOrder = targetIds.size + 1;
    cards.forEach((card) => {
      if (card.columnId === columnId && !targetIds.has(String(card.id))) {
        card.columnSortOrder = nextOrder++;
      }
    });

    await writeJson("cards.json", cards);
  });

  return { columnId, count: targetIds.size };
}

module.exports = { applyColumnOrder };
