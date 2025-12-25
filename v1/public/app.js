let columnsData = [];
let cardsData = [];

function renderColumn(section) {
  const content = section.querySelector(".column-content");
  content.innerHTML = "";
  const columnId = section.dataset.columnId;
  for (const card of cardsData.filter((c) => c.columnId === columnId)) {
    const el = document.createElement("div");
    el.className = "card";
    el.setAttribute("draggable", "true");
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
    el.addEventListener("dragstart", (e) => {
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
        // Optimistic UI update
        const prevColumnId = card.columnId;
        card.columnId = columnId;
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
          .catch((err) => {
            console.error(err);
            // Revert on failure
            card.columnId = prevColumnId;
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
