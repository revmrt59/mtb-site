(function () {
  "use strict";

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

  function applyMode(mode) {
    const table = getTable();
    if (!table) return;

    normalizeTable(table);
    table.setAttribute("data-mode", mode);

    const rows = Array.from(table.querySelectorAll("tr"));
    rows.forEach((r) => {
      const cells = Array.from(r.querySelectorAll("th, td"));
      if (cells.length < 3) return;

      const nkjv = cells[1];
      const nlt  = cells[2];

      // Reset
      nkjv.style.display = "";
      nlt.style.display  = "";
      nkjv.colSpan = 1;
      nlt.colSpan  = 1;

      if (mode === "nkjv") {
        nlt.style.display = "none";
        nkjv.colSpan = 2; // take both translation columns
      } else if (mode === "nlt") {
        nkjv.style.display = "none";
        nlt.colSpan = 2;  // take both translation columns
      }
    });
  }

  function ensureControls() {
    const target = document.getElementById("doc-target");
    if (!target) return false;

    const table = getTable();
    if (!table) return false;

    // Only run if it looks like the scripture parallel table (3+ columns)
    const firstRow = table.querySelector("tr");
    const firstCells = firstRow ? firstRow.querySelectorAll("th,td") : null;
    if (!firstCells || firstCells.length < 3) return false;

    // Add controls bar if missing
    let bar = document.querySelector(".scripture-controls");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "scripture-controls";

      const makeBtn = (label, mode) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sc-btn";
        b.textContent = label;
        b.addEventListener("click", (e) => {
          e.preventDefault();
          setActive(mode);
          applyMode(mode);
        });
        return b;
      };

      const btnBoth = makeBtn("Both", "both");
      const btnNKJV = makeBtn("NKJV Only", "nkjv");
      const btnNLT  = makeBtn("NLT Only", "nlt");

      function setActive(mode) {
        [btnBoth, btnNKJV, btnNLT].forEach(x => x.classList.remove("is-active"));
        if (mode === "both") btnBoth.classList.add("is-active");
        if (mode === "nkjv") btnNKJV.classList.add("is-active");
        if (mode === "nlt")  btnNLT.classList.add("is-active");
      }

      bar.append(btnBoth, btnNKJV, btnNLT);
      target.parentNode.insertBefore(bar, target);

      // Default state
      setActive("both");
      applyMode("both");
    } else {
      // If controls exist, just ensure table is tagged and mode applied
      if (!table.getAttribute("data-mode")) {
        applyMode("both");
      } else {
        applyMode(table.getAttribute("data-mode"));
      }
    }

    // Signal for CSS scoping
    document.body.classList.add("mtb-has-scripture-controls");

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
    // debounce-ish
    clearTimeout(window.__mtb_sc_t);
    window.__mtb_sc_t = setTimeout(boot, 30);
  });

  function tryObserve() {
    const target = document.getElementById("doc-target");
    if (!target) return;
    obs.observe(target, { childList: true, subtree: true });
  }

  window.addEventListener("DOMContentLoaded", tryObserve);

  // marker
  window.__mtbScriptureControlsLoaded = true;
})();