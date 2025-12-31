document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("addForm");
  const titlesEl = document.getElementById("titles");
  const statusEl = document.getElementById("status");
  const clearBtn = document.getElementById("clearBtn");

  clearBtn.addEventListener("click", () => {
    titlesEl.value = "";
    statusEl.textContent = "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.textContent = "";

    const lines = titlesEl.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      statusEl.textContent = "Please enter at least one title.";
      return;
    }

    try {
      const res = await fetch("/api/cards/addTitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: lines }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add cards");
      }
      const data = await res.json();
      statusEl.textContent = `Added ${data.added} cards.`;
      titlesEl.value = "";
    } catch (err) {
      statusEl.textContent = String(err.message || err);
    }
  });
});
