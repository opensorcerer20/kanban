let columnsData = [];
let cardsData = [];

function renderColumn(section) {
  const content = section.querySelector(".column-content");
  content.innerHTML = "";
  const columnId = section.dataset.columnId;
  // Sort: Ready asc by updatedAt, others desc
  const title = (section.dataset.title || "").toLowerCase();
  const isReady =
    title === "ready" ||
    (section.dataset.columnId || "").toLowerCase().includes("ready");
  const colCards = cardsData
    .filter((c) => c.columnId === columnId)
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.updatedAt || 0).getTime();
      const tb = new Date(b.updatedAt || 0).getTime();
      return isReady ? ta - tb : tb - ta;
    });
  for (const card of colCards) {
    const el = document.createElement("div");
    el.className = "card";
    // Prevent dragging if card is locked
    el.setAttribute("draggable", String(!card.locked));
    el.dataset.id = card.id;

    // Title: [ticketId]: title (bold)
    const titleEl = document.createElement("div");
    titleEl.className = "card-title";
    const strong = document.createElement("strong");
    const ticketDisplay = card.ticketId ? `[${card.ticketId}]: ` : "";
    strong.textContent = `${ticketDisplay}${card.title || ""}`;
    titleEl.appendChild(strong);

    // Description: first 50 chars followed by ... if truncated
    const descEl = document.createElement("div");
    descEl.className = "card-desc";
    const desc = card.description || "";
    const snippet = desc.length > 50 ? desc.slice(0, 50) + "..." : desc;
    descEl.textContent = snippet;

    // Tags: comma-separated
    const tagsEl = document.createElement("div");
    tagsEl.className = "card-tags";
    const tagsLabel = document.createElement("span");
    tagsLabel.textContent = "Tags: ";
    const tags = Array.isArray(card.tags) ? card.tags : [];
    const tagsValues = document.createElement("span");
    tagsValues.textContent = tags.join(", ");
    tagsEl.appendChild(tagsLabel);
    tagsEl.appendChild(tagsValues);

    el.appendChild(titleEl);
    el.appendChild(descEl);
    el.appendChild(tagsEl);

    // Staleness dots: 4 grey dots, turn orange if older than 1..4 weeks
    const staleEl = document.createElement("div");
    staleEl.className = "card-staleness";
    let weeksOld = 0;
    if (card.updatedAt) {
      const updated = new Date(card.updatedAt).getTime();
      const diffMs = Date.now() - updated;
      weeksOld = diffMs / (1000 * 60 * 60 * 24 * 7);
    }
    for (let i = 1; i <= 4; i++) {
      const dot = document.createElement("span");
      dot.className = "stale-dot" + (weeksOld > i ? " active" : "");
      staleEl.appendChild(dot);
    }
    el.appendChild(staleEl);

    // Lock icon bottom-right: indicates locked/unlocked and toggles via API
    const lockEl = document.createElement("div");
    lockEl.className = "card-lock";
    lockEl.title = card.locked ? "Locked" : "Unlocked";
    lockEl.textContent = card.locked ? "🔒" : "🔓";
    if (card.locked) {
      lockEl.classList.add("locked");
    }
    lockEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const desired = !card.locked;
      fetch("/api/cards/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.id, locked: desired }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to update lock");
          return res.json();
        })
        .then((data) => {
          if (data && data.card) {
            Object.assign(card, data.card);
            renderBoard();
          }
        })
        .catch((err) => console.error(err));
    });
    el.appendChild(lockEl);
    el.addEventListener("dragstart", (e) => {
      if (card.locked) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("text/plain", card.id);
      el.classList.add("dragging");
    });
    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
    });
    content.appendChild(el);
  }
}

function renderBoard() {
  const sections = document.querySelectorAll(".column");
  sections.forEach((section) => renderColumn(section));
}

function setupDnD() {
  const sections = document.querySelectorAll(".column");
  sections.forEach((section) => {
    section.addEventListener("dragover", (e) => {
      e.preventDefault();
      section.classList.add("drag-over");
    });
    section.addEventListener("dragleave", () => {
      section.classList.remove("drag-over");
    });
    section.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      const columnId = section.dataset.columnId;
      const card = cardsData.find((c) => c.id === id);
      if (card && columnId) {
        // Do not move if locked
        if (card.locked) {
          section.classList.remove("drag-over");
          return;
        }
        // Optimistic UI update
        const prevColumnId = card.columnId;
        const prevUpdatedAt = card.updatedAt;
        card.columnId = columnId;
        card.updatedAt = new Date().toISOString();
        section.classList.remove("drag-over");
        renderBoard();

        // Persist the move
        fetch("/api/cards/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: card.id, columnId }),
        })
          .then((res) => {
            if (!res.ok) throw new Error("Failed to save");
            return res.json();
          })
          .then((data) => {
            if (data && data.card) {
              // Sync with server values (e.g., updatedAt)
              Object.assign(card, data.card);
              renderBoard();
            }
          })
          .catch((err) => {
            console.error(err);
            // Revert on failure
            card.columnId = prevColumnId;
            card.updatedAt = prevUpdatedAt;
            renderBoard();
          });
      }
    });
  });
}

async function init() {
  try {
    const res = await fetch("/api/board");
    if (!res.ok) throw new Error("Failed to fetch board");
    const data = await res.json();
    columnsData = data.columns || [];
    cardsData = data.cards || [];

    const board = document.getElementById("board");
    board.innerHTML = "";
    for (const col of columnsData) {
      const section = document.createElement("section");
      section.className = "column";
      section.id = col.id;
      section.dataset.columnId = col.id;
      section.dataset.title = col.title || "";

      const h2 = document.createElement("h2");
      h2.textContent = col.title;
      const content = document.createElement("div");
      content.className = "column-content";

      section.appendChild(h2);
      section.appendChild(content);
      board.appendChild(section);
    }

    renderBoard();
    setupDnD();
  } catch (e) {
    console.error(e);
  }
}

document.addEventListener("DOMContentLoaded", init);
