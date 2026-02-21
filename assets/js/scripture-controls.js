(function () {
  "use strict";

  function getTarget() {
    return document.getElementById("doc-target");
  }

  function getTable() {
    return document.querySelector("#doc-target table");
  }

  function normalizeTable(table) {
    if (!table) return;

    // Remove fixed-width colgroups (common reason widths won't expand)
    table.querySelectorAll("colgroup").forEach(cg => cg.remove());

    table.classList.add("mtb-scripture-table");
    table.style.width = "100%";
    table.style.tableLayout = "auto";
    table.style.borderCollapse = "separate";
  }

  // Applies display mode ONLY for 3-column tables: Verse | NKJV | NLT
  function applyMode(mode) {
    const table = getTable();
    if (!table) return;

    normalizeTable(table);
    table.setAttribute("data-mode", mode);

    const rows = Array.from(table.querySelectorAll("tr"));
    rows.forEach((r) => {
      const cells = Array.from(r.querySelectorAll("th, td"));
      if (cells.length < 3) return; // only meaningful when 2 translations exist

      const nkjv = cells[1];
      const nlt  = cells[2];

      // Reset
      nkjv.style.display = "";
      nlt.style.display  = "";
      nkjv.colSpan = 1;
      nlt.colSpan  = 1;

      if (mode === "nkjv") {
        nlt.style.display = "none";
        nkjv.colSpan = 2;
      } else if (mode === "nlt") {
        nkjv.style.display = "none";
        nlt.style.display = "";
        nlt.colSpan = 2;
      }
      // mode === "both" => leave as-is
    });
  }

  function forceWhite(table) {
    if (!table) return;
    table.style.background = "#ffffff";
    table.querySelectorAll("th, td").forEach(cell => {
      cell.style.background = "#ffffff";
    });
  }
function forceWide(target) {
  // Marker to prove THIS file/version is the one running
  document.documentElement.setAttribute("data-sc-version", "2026-02-21A");

  // IMPORTANT: no inline widths. CSS must control shrink/grow.
  const nodesToTag = new Set([
    target,                    // #doc-target
    target.closest("article"),  // article.doc-main
    target.closest("main"),     // main.doc-shell
    document.querySelector("main.doc-shell"),
  ]);

  nodesToTag.forEach(node => {
    if (!node) return;
    node.classList.add("wide");
    node.style.maxWidth = "";  // clear any old inline constraints
    node.style.width = "";
  });
}

  function ensureControls() {
    const target = getTarget();
    if (!target) return false;

    const table = getTable();
    if (!table) return false;

    normalizeTable(table);

    // Identify columns: allow Verse + 1 translation (2 cells) or Verse + 2 translations (3 cells)
    const firstRow = table.querySelector("tr");
    const firstCells = firstRow ? firstRow.querySelectorAll("th,td") : null;
    if (!firstCells || firstCells.length < 2) return false;

    // Always apply these when a chapter scripture table is detected
    document.body.classList.add("mtb-has-scripture-controls");
    forceWhite(table);
    forceWide(target);

    const hasTwoTranslations = firstCells.length >= 3;

// Remove obsolete scripture toggle bar (replaced by translation dropdown)
const existingBar = document.querySelector(".scripture-controls");
if (existingBar) existingBar.remove();

    return true;
  }

  // Public hook (keeps compatibility with your load-doc.js)
  window.addScriptureControls = function () {
    ensureControls();
  };

  // Auto-run after DOM is ready and after navigation/content injection
  function boot() {
    ensureControls();
  }

  window.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("popstate", () => setTimeout(boot, 50));

  // Observe #doc-target for injected HTML (load-doc.js replaces content)
  const obs = new MutationObserver(() => {
    clearTimeout(window.__mtb_sc_t);
    window.__mtb_sc_t = setTimeout(boot, 30);
  });

  function tryObserve() {
    const target = getTarget();
    if (!target) return;
    obs.observe(target, { childList: true, subtree: true });
  }

  window.addEventListener("DOMContentLoaded", tryObserve);

  // marker
  window.__mtbScriptureControlsLoaded = true;
})();