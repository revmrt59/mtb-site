(function () {
  "use strict";

  // =========================================================
  // Helpers
  // =========================================================
  // =========================================================
// MTB: scripture-controls.js is for the OLD 3-column HTML tables.
// Your chapter scripture view is JSON-driven and already styled.
// Running this script causes post-load reflow ("jump").
// So we SKIP it on chapter scripture pages.
// =========================================================
if (document.body.classList.contains("mtb-has-scripture-controls")) {
  // Optional: uncomment for verification
  // console.log("scripture-controls.js skipped on mtb-has-scripture-controls page");
  throw new Error("skip scripture-controls on mtb-has-scripture-controls");
}
  function getTarget() {
    return document.getElementById("doc-target");
  }

  function getTable() {
    // Chapter Scripture renderer should inject a table somewhere inside #doc-target
    return document.querySelector("#doc-target table");
  }

  function isChapterScriptureView() {
    // Chapter Scripture JSON renderer uses one or more of these
    return !!(
      document.querySelector("#doc-target .mtb-scripture-root") ||
      document.querySelector("#doc-target .mtb-chapter-scripture-wrap") ||
      document.querySelector("#doc-target table.mtb-chapter-scripture") ||
      document.querySelector("#doc-target table.mtb-scripture-table") ||
      // fallback: any table inside doc-target AND the chapter scripture section marker
      document.querySelector("#doc-target section.mtb-doc.mtb-chapter-scripture")
    );
  }

  // =========================================================
  // Cleanup (CRITICAL): revert normal pages back to normal
  // =========================================================
  function cleanupScriptureMode() {
    document.body.classList.remove("mtb-has-scripture-controls");
    document.documentElement.removeAttribute("data-sc-version");

    // Remove obsolete bar if it exists (old system)
    const bar = document.querySelector(".scripture-controls");
    if (bar) bar.remove();

    // Remove "wide" tags we apply during scripture view
    const target = getTarget();
    const nodesToUntag = new Set([
      target,
      target?.closest("article"),
      target?.closest("main"),
      document.querySelector("main.doc-shell"),
      document.querySelector("article.doc-main"),
    ]);

    nodesToUntag.forEach((node) => {
      if (!node) return;
      node.classList.remove("wide");
      // Clear any past inline sizing that may have been applied in earlier experiments
      node.style.maxWidth = "";
      node.style.width = "";
      node.style.marginLeft = "";
      node.style.marginRight = "";
    });
  }

  // =========================================================
  // Normalize + styling helpers
  // =========================================================
  function normalizeTable(table) {
    if (!table) return;

    // Remove fixed-width colgroups (common reason widths won't expand)
    table.querySelectorAll("colgroup").forEach((cg) => cg.remove());

    table.classList.add("mtb-scripture-table");

    // Let CSS handle layout; these are safe defaults
   
    table.style.tableLayout = "auto";
    table.style.borderCollapse = "collapse";
    table.style.borderSpacing = "0";
  }

  function forceWhite(table) {
    if (!table) return;

    table.style.background = "#ffffff";
    table.querySelectorAll("th, td").forEach((cell) => {
      cell.style.background = "#ffffff";
    });
  }

  function tagWideNodes(target) {
    // Marker to prove THIS file/version is running
    document.documentElement.setAttribute("data-sc-version", "2026-02-21B");

    const nodesToTag = new Set([
      target,                       // #doc-target
      target?.closest("article"),    // article.doc-main
      target?.closest("main"),       // main.doc-shell
      document.querySelector("main.doc-shell"),
      document.querySelector("article.doc-main"),
    ]);

    nodesToTag.forEach((node) => {
      if (!node) return;
      node.classList.add("wide");
      // Do NOT set inline widths; CSS should control final width
      node.style.maxWidth = "";
      node.style.width = "";
    });
  }

  // =========================================================
  // Main entry
  // =========================================================
  function ensureControls() {
    // If we are NOT on chapter scripture, make sure we fully revert any scripture-only state.
    if (!isChapterScriptureView()) {
      cleanupScriptureMode();
      return false;
    }

    const target = getTarget();
    if (!target) return false;

    const table = getTable();
    if (!table) return false;

    // Turn on scripture-only mode
    document.body.classList.add("mtb-has-scripture-controls");

    // Apply table fixes
    normalizeTable(table);
    forceWhite(table);

    // Apply width tags (CSS will control the final width)
    tagWideNodes(target);

    // Remove obsolete toggle bar if any old HTML remains
    const existingBar = document.querySelector(".scripture-controls");
    if (existingBar) existingBar.remove();

    return true;
  }

  // Public hook (keeps compatibility with load-doc.js)
  window.addScriptureControls = function () {
    ensureControls();
  };

  // Boot on load and whenever #doc-target gets replaced
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