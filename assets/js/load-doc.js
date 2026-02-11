// load-doc.js
// Mastering the Bible - document loader + chapter-explanation enhancements
// - Loads the requested generated HTML into #doc-target
// - Fixes mojibake
// - For chapter explanation pages:
//   - Converts "word (G####/H####)" markers into <span class="ws" data-ws="G####" data-ws-doc="...">
//   - Points word studies to g/h-prefixed files: book-chapter-g###.html (Option A)
//   - Sets data-ws-json for optional JSON mode (still supported by wordstudy-hover.js)

(function () {
  // ------------------------------------------
  // BOOK TESTAMENT LOOKUP (extend as needed)
  // ------------------------------------------
  const BOOK_TESTAMENT = {
    // NT
    matthew: "new-testament",
    mark: "new-testament",
    luke: "new-testament",
    john: "new-testament",
    acts: "new-testament",
    romans: "new-testament",
    "1-corinthians": "new-testament",
    "2-corinthians": "new-testament",
    galatians: "new-testament",
    ephesians: "new-testament",
    philippians: "new-testament",
    colossians: "new-testament",
    "1-thessalonians": "new-testament",
    "2-thessalonians": "new-testament",
    "1-timothy": "new-testament",
    "2-timothy": "new-testament",
    titus: "new-testament",
    philemon: "new-testament",
    hebrews: "new-testament",
    james: "new-testament",
    "1-peter": "new-testament",
    "2-peter": "new-testament",
    "1-john": "new-testament",
    "2-john": "new-testament",
    "3-john": "new-testament",
    jude: "new-testament",
    revelation: "new-testament",

    // OT (examples)
    genesis: "old-testament",
    exodus: "old-testament",
    psalms: "old-testament",
    proverbs: "old-testament",
    obadiah: "old-testament"
  };

  // ==========================================
  // DOC PARSING
  // ==========================================
  function parseDocName(docName) {
    const intro = docName.match(/^([a-z0-9-]+)-0-book-introduction\.html$/i);
    if (intro) return { book: intro[1].toLowerCase(), chapter: 0, type: "book-introduction" };

    const chap = docName.match(/^([a-z0-9-]+)-(\d+)-chapter-(scripture|orientation|explanation|insights)\.html$/i);
    if (chap) return { book: chap[1].toLowerCase(), chapter: Number(chap[2]), type: "chapter-" + chap[3].toLowerCase() };

    const eg = docName.match(/^([a-z0-9-]+)-(\d+)-eg-culture\.html$/i);
    if (eg) return { book: eg[1].toLowerCase(), chapter: Number(eg[2]), type: "eg-culture" };

    const res = docName.match(/^([a-z0-9-]+)-(\d+)-resources\.html$/i);
    if (res) return { book: res[1].toLowerCase(), chapter: Number(res[2]), type: "resources" };

    return { book: "", chapter: null, type: "" };
  }

  function setBodyDocMeta(meta) {
    document.body.dataset.docType = meta.type || "";
    document.body.dataset.book = meta.book || "";
    document.body.dataset.chapter = meta.chapter !== null && meta.chapter !== undefined ? String(meta.chapter) : "";
  }

  // ==========================================
  // PATH BUILDING
  // ==========================================
  function buildDocPath(docName) {
    const meta = parseDocName(docName);
    const testament = BOOK_TESTAMENT[meta.book] || "new-testament";
    return `/books/${testament}/${meta.book}/generated/${docName}`;
  }

  function tabToDocSuffix(tab) {
    const map = {
      chapter_scripture: "chapter-scripture",
      book_introduction: "book-introduction",
      chapter_orientation: "chapter-orientation",
      chapter_explanation: "chapter-explanation",
      chapter_insights: "chapter-insights",
      eg_culture: "eg-culture",
      resources: "resources"
    };
    return map[tab] || "chapter-scripture";
  }

  function buildDocNameFromParams(book, chapter, tab) {
    if (!book) return "titus-0-book-introduction.html";
    if (tab === "book_introduction") return `${book}-0-book-introduction.html`;
    const suffix = tabToDocSuffix(tab);
    return `${book}-${chapter}-${suffix}.html`;
  }

  // Allow things like:
  // - titus-1-chapter-explanation.html
  // - titus-1-g96.html (Option A word study file)
  function safeDocName(name) {
    return /^[a-z0-9\-]+-(0|\d+)-[a-z0-9\-]+\.html$/i.test(name) ? name : "";
  }

  // ==========================================
  // MOJIBAKE FIX
  // ==========================================
function fixMojibake(input) {
  if (input == null) return input;
  let s = String(input);

  // Normalize NBSP (real + common mangled forms)
  s = s.replace(/\u00A0/g, " ");
  s = s.replace(/&nbsp;/g, " ");
  s = s.split("┬á").join(" ");
  s = s.split("Â ").join(" ");
  s = s.split("Â").join("");

  // Common double-encoded "ΓÇ.." family
  const map1 = [
    ["ΓÇ£", "“"], ["ΓÇØ", "”"], ["ΓÇ¥", "”"],
    ["ΓÇÿ", "‘"], ["ΓÇÖ", "’"],
    ["ΓÇª", "…"],
    ["ΓÇô", "—"], ["ΓÇò", "—"],
    ["ΓÇû", "–"],
    ["ΓÇó", "•"],   // ← bullet fix
    ["ΓÂ ", " "], ["ΓÂ", ""]
  ];

  // Common UTF-8-as-Win1252 "â€.." family
  const map2 = [
    ["â€”", "—"], ["â€“", "–"],
    ["â€œ", "“"], ["â€", "”"],
    ["â€˜", "‘"], ["â€™", "’"],
    ["â€¦", "…"]
  ];

  // Common double-encoded "Γâ.." family
  const map3 = [
    ["Γâ€”", "—"], ["Γâ€“", "–"],
    ["Γâ€œ", "“"], ["Γâ€", "”"],
    ["Γâ€˜", "‘"], ["Γâ€™", "’"],
    ["Γâ€¦", "…"]
  ];

  const applyMap = (str, map) => {
    let out = str;
    for (const [bad, good] of map) {
      out = out.split(bad).join(good);
    }
    return out;
  };

  // Two passes catches many "double mangled" strings
  s = applyMap(s, map1);
  s = applyMap(s, map2);
  s = applyMap(s, map3);

  s = applyMap(s, map1);
  s = applyMap(s, map2);
  s = applyMap(s, map3);

  // Tidy spacing
  s = s.replace(/[ \t]{2,}/g, " ");

  return s;
}


  // ==========================================
  // WORD STUDY MARKERS (CHAPTER EXPLANATION)
  // Turns: disqualified (G96) into <span class="ws" data-ws="G96" data-ws-doc="...">disqualified</span>
  // Option A naming:
  //   data-ws-doc points to: {book}-{chapter}-g96.html  (prefix kept, leading zeros removed)
  // ==========================================
  function enhanceStrongMarkersToWordStudies(rootEl, meta, docPath) {
    if (!rootEl) return;

    // Matches: word (G###) or word (H###)
    // IMPORTANT: allow 1–5 digits so G96 works
    const re = /(\b[\w’'-]+\b)\s*\((G\d{1,5}|H\d{1,5})\)/g;

    const baseDir = docPath ? docPath.slice(0, docPath.lastIndexOf("/") + 1) : "";

    function normalizeStrongLower(strong) {
      const s = String(strong || "").trim();
      if (!s) return "";
      const letter = s[0].toLowerCase(); // g or h
      const digits = s.slice(1).replace(/\D/g, "");
      const n = parseInt(digits, 10);
      if (!Number.isFinite(n)) return "";
      return `${letter}${n}`; // removes leading zeros
    }

    function buildWsDocPath(strong) {
      if (!meta || !meta.book || !meta.chapter || !baseDir) return null;
      const strongLower = normalizeStrongLower(strong); // e.g., g96
      if (!strongLower) return null;
      return `${baseDir}${meta.book}-${meta.chapter}-${strongLower}.html`;
    }

    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach((node) => {
      const text = node.nodeValue;
      if (!text) return;

      // Guard: don't process text already inside a .ws span (prevents runaway highlighting)
      const parentEl = node.parentElement;
      if (parentEl && parentEl.closest && parentEl.closest(".ws")) return;

      re.lastIndex = 0;
      if (!re.test(text)) return;
      re.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let last = 0;
      let m;

      while ((m = re.exec(text)) !== null) {
        const full = m[0];
        const word = m[1];
        const strong = m[2];
        const start = m.index;

        if (start > last) frag.appendChild(document.createTextNode(text.slice(last, start)));

        const span = document.createElement("span");
        span.className = "ws";
        span.setAttribute("data-ws", strong); // keep original casing (G96)
        span.textContent = word;

        const wsDoc = buildWsDocPath(strong);
        if (wsDoc) span.setAttribute("data-ws-doc", wsDoc);

        frag.appendChild(span);

        // remove marker from display
        last = start + full.length;
      }

      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));

      node.parentNode.replaceChild(frag, node);
    });
  }

  // ==========================================
  // SCRIPTURE CONTROLS (toggle NKJV/NLT)
  // ==========================================
  function clearScriptureColumnHiding() {
    const table = document.querySelector("#doc-target table");
    if (!table) return;

    table.querySelectorAll("tr").forEach(row => {
      const cells = row.querySelectorAll("th, td");
      if (cells.length < 3) return; // Verse | NKJV | NLT
      cells[1].style.display = "";
      cells[2].style.display = "";
    });
  }

  function removeScriptureControls() {
    const existing = document.querySelector(".scripture-controls");
    if (existing) existing.remove();
    clearScriptureColumnHiding();
  }

  function addScriptureControls() {
    const target = document.getElementById("doc-target");
    if (!target) return;

    removeScriptureControls();

    const table = target.querySelector("table");
    if (!table) return;

    function applyMode(mode) {
      table.querySelectorAll("tr").forEach(row => {
        const cells = row.querySelectorAll("th, td");
        if (cells.length < 3) return;

        // Reset first
        cells[1].style.display = "";
        cells[2].style.display = "";

        if (mode === "nkjv") cells[2].style.display = "none";
        if (mode === "nlt") cells[1].style.display = "none";
      });
    }

    const bar = document.createElement("div");
    bar.className = "scripture-controls";

    function setActive(btn) {
      bar.querySelectorAll("button").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    }

    function makeBtn(label, mode, makeDefaultActive) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sc-btn";
      b.textContent = label;
      b.addEventListener("click", e => {
        e.preventDefault();
        setActive(b);
        applyMode(mode);
      });
      if (makeDefaultActive) setActive(b);
      return b;
    }

    const btnBoth = makeBtn("Both", "both", true);
    const btnNKJV = makeBtn("NKJV Only", "nkjv", false);
    const btnNLT  = makeBtn("NLT Only", "nlt", false);

    bar.appendChild(btnBoth);
    bar.appendChild(btnNKJV);
    bar.appendChild(btnNLT);

    target.parentNode.insertBefore(bar, target);
    applyMode("both");
  }

  // ==========================================
  // MAIN LOAD
  // ==========================================
  function loadCurrentDoc() {
    removeScriptureControls();

    const params = new URLSearchParams(window.location.search);
    const docParam = params.get("doc");
    const bookParam = params.get("book");
    const chapterParam = params.get("chapter") || "1";
    const tabParam = params.get("tab") || "chapter_scripture";

    const docName = docParam
      ? safeDocName(docParam)
      : (bookParam
          ? buildDocNameFromParams(bookParam, chapterParam, tabParam)
          : "titus-0-book-introduction.html");

    const meta = parseDocName(docName);
    setBodyDocMeta(meta);

    const docPath = buildDocPath(docName);

    fetch(docPath, { cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error("Failed to load: " + docPath);
        return r.text();
      })
      .then(html => {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const root = parsed.querySelector("#doc-root");
        const content = root ? root.innerHTML : parsed.body.innerHTML;

        const target = document.getElementById("doc-target");
        if (!target) return;

        // Inject content first
        target.innerHTML = fixMojibake(content);

        // If this is chapter explanation, convert Strong's markers into .ws spans
        const isExplanation =
          meta.type === "chapter-explanation" ||
          /chapter[-_]?explanation\.html$/i.test(docName);

        if (isExplanation) {
          enhanceStrongMarkersToWordStudies(target, meta, docPath);

          // Optional JSON mode support (kept for backward compatibility)
          const wsJsonName = docName.replace(/chapter[-_]?explanation\.html$/i, "wordstudies.json");
          const baseDir = docPath.slice(0, docPath.lastIndexOf("/") + 1);
          const wsJsonPath = baseDir + wsJsonName;

          document.body.setAttribute("data-doc-type", "chapter-explanation");
          document.body.setAttribute("data-ws-json", wsJsonPath);
        } else {
          document.body.removeAttribute("data-ws-json");
          document.body.removeAttribute("data-doc-type");
        }

        // Re-bind hover/popup AFTER .ws spans exist
        try {
          if (window.MTBWordStudyHover && typeof window.MTBWordStudyHover.bind === "function") {
            window.MTBWordStudyHover.bind(target);
          }
        } catch (e) {
          console.warn("MTBWordStudyHover bind failed:", e);
        }

        if (meta.type === "chapter-scripture") {
          addScriptureControls();
        }
      })
      .catch(err => {
        const target = document.getElementById("doc-target");
        if (!target) return;
        target.innerHTML = `<p>Content failed to load.</p><pre>${err.message}</pre>`;
      });
  }

  // Boot
  loadCurrentDoc();
  window.addEventListener("popstate", loadCurrentDoc);

  // Optional: expose for debugging
  window.MTBLoadDoc = { loadCurrentDoc };
})();
