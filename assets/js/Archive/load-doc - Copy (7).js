// load-doc.js
// Mastering the Bible - document loader + chapter-explanation enhancements
// - Loads the requested generated HTML into #doc-target
// - Fixes mojibake
// - For chapter explanation pages:
//   - Converts "word (G####/H####)" markers into <span class="ws" data-ws="G####" data-ws-doc="...">
//   - Points word studies to canonical files: book-chapter-verse-g###.html
//   - Sets data-ws-json for optional JSON mode (still supported by wordstudy-hover.js)
 const stamp = "LOAD-DOC v2026-08-10-WS-CANONICAL";
  console.log(stamp);
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
    obadiah: "old-testament",
    ruth: "old-testament",
    hosea: "old-testament",
    habakkuk: "old-testament",

  };

  // ==========================================
  // DOC PARSING
  // ==========================================
  function parseDocName(docName) {
    const name = String(docName || "");

    // Canonical Book Overview filename:
    // book-overview-ruth.html
    const intro = name.match(/^book-overview-([a-z0-9-]+)\.html$/i);
    if (intro) return { book: intro[1].toLowerCase(), chapter: 0, type: "book-overview" };

    // Legacy compatibility during transition:
    // ruth-0-book-overview.html
    const legacyIntro = name.match(/^([a-z0-9-]+)-0-book-overview\.html$/i);
    if (legacyIntro) return { book: legacyIntro[1].toLowerCase(), chapter: 0, type: "book-overview" };

    const chap = name.match(/^([a-z0-9-]+)-(\d+)-chapter-(scripture|overview|explanation|reflections|insights)\.html$/i);
    if (chap) {
      const kind = chap[3].toLowerCase() === "insights" ? "reflections" : chap[3].toLowerCase();
      return { book: chap[1].toLowerCase(), chapter: Number(chap[2]), type: "chapter-" + kind };
    }

    const eg = name.match(/^([a-z0-9-]+)-(\d+)-(chapter-)?eg-culture\.html$/i);
    if (eg) return { book: eg[1].toLowerCase(), chapter: Number(eg[2]), type: "chapter-eg-culture" };

    const res = name.match(/^([a-z0-9-]+)-(\d+)-(chapter-)?resources\.html$/i);
    if (res) return { book: res[1].toLowerCase(), chapter: Number(res[2]), type: "chapter-resources" };

    // topic pages: {book}-{ch}-resources-{topic}.html
    const resTopic = name.match(/^([a-z0-9-]+)-(\d+)-resources-[a-z0-9-]+\.html$/i);
    if (resTopic) return { book: resTopic[1].toLowerCase(), chapter: Number(resTopic[2]), type: "chapter-resources" };

    // canonical word study pages: {book}-{chapter}-{verse}-g96.html
    const ws = name.match(/^([a-z0-9-]+)-(\d+)-(\d+)-(g\d{1,5}|h\d{1,5})\.html$/i);
    if (ws) {
      return {
        book: ws[1].toLowerCase(),
        chapter: Number(ws[2]),
        verse: Number(ws[3]),
        strong: ws[4].toUpperCase(),
        type: "word-study"
      };
    }

    return { book: "", chapter: null, type: "" };
  }

  function setBodyDocMeta(meta) {
    document.body.dataset.docType = meta.type || "";
    document.body.dataset.book = meta.book || "";
    document.body.dataset.chapter =
      meta.chapter !== null && meta.chapter !== undefined ? String(meta.chapter) : "";
  }

  // ==========================================
  // PATH BUILDING
  // ==========================================
  function buildDocPath(docName) {
    if (!docName) return "";

    // Remove leading slash if present
    const clean = String(docName).replace(/^\/+/, "");

    // If docName already includes a 3-digit folder or 000-book, use it directly
    if (clean.startsWith("000-book/") || /^\d{3}\//.test(clean)) {
      const parts = clean.split("/");
      const baseName = parts.pop();
      const meta = parseDocName(baseName);
      const testament = BOOK_TESTAMENT[meta.book] || "new-testament";
      return `/books/${testament}/${meta.book}/${clean}`;
    }

    // Otherwise parse normally
    const meta = parseDocName(clean);
    const testament = BOOK_TESTAMENT[meta.book] || "new-testament";
    if (!meta.book) return "";

    if (meta.chapter === 0) {
      return `/books/${testament}/${meta.book}/000-book/${clean}`;
    }

    if (meta.chapter && meta.chapter > 0) {
      const folder = String(meta.chapter).padStart(3, "0");
      return `/books/${testament}/${meta.book}/${folder}/${clean}`;
    }

    return `/books/${testament}/${meta.book}/${clean}`;
  }

  // ==========================================
  // LINK WIRING (resource topic links etc.)
  // ==========================================

  function wireDocLinks(container) {
    if (!container) return;

    container.querySelectorAll('a[data-doc]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();

        const file = a.getAttribute('data-doc');
        if (!file) return;

        const doc = safeDocName(file) || file;
        const inferred = parseDocName(doc);

        const url = new URL(window.location.href);

        const currentBook = url.searchParams.get("book") || document.body.dataset.book || "";
        const currentChapter = url.searchParams.get("chapter") || document.body.dataset.chapter || "";

        const book = inferred.book || currentBook;
        const chapter = (inferred.chapter != null ? String(inferred.chapter) : String(currentChapter || ""));

        if (book) url.searchParams.set("book", book);
        if (chapter) url.searchParams.set("chapter", chapter);

        url.searchParams.set("tab", RESOURCES_TAB);
        url.searchParams.set("doc", doc);

        window.history.pushState({}, "", url.toString());
        loadCurrentDocFromUrl();
      });
    });
  }




  
  // ==========================================
  // TAB NORMALIZATION
  // ==========================================
  const DEFAULT_TAB = "chapter_scripture";
  const RESOURCES_TAB = "chapter_resources";

  function normalizeTab(tab) {
    const t = String(tab || "").toLowerCase().trim();

    if (t === "resources" || t === "chapter_resources" || t === "chapter-resources") return RESOURCES_TAB;
    if (t === "scripture" || t === "chapter_scripture" || t === "chapter-scripture") return "chapter_scripture";
    if (t === "explanation" || t === "chapter_explanation" || t === "chapter-explanation") return "chapter_explanation";
    if (t === "overview" || t === "chapter_overview" || t === "chapter-overview") return "chapter_overview";
    if (t === "reflections" || t === "chapter_reflections" || t === "chapter-reflections" || t === "insights" || t === "chapter_insights" || t === "chapter-insights") return "chapter_reflections";
    if (t === "eg_culture" || t === "eg-culture" || t === "egculture" || t === "chapter_eg_culture" || t === "chapter-eg-culture") return "eg_culture";
    if (t === "book_intro" || t === "book-intro" || t === "bookintroduction" || t === "book_introduction" || t === "book-overview") return "book_introduction";

    return DEFAULT_TAB;
  }


// ==========================================
  // TAB -> DOC SUFFIX
  // ==========================================
  
  function tabToDocSuffix(tab) {
    switch (normalizeTab(tab)) {
      case "chapter_scripture": return "chapter-scripture";
      case "chapter_explanation": return "chapter-explanation";
      case "chapter_overview": return "chapter-overview";
      case "chapter_reflections": return "chapter-reflections";
      case "eg_culture": return "chapter-eg-culture";
      case "chapter_resources": return "chapter-resources";
      default: return "chapter-scripture";
    }
  }


  
  function buildDocNameFromParams(book, chapter, tab) {
    const b = String(book || "").toLowerCase();
    const ch = String(chapter ?? "1").replace(/[^\d]/g, "") || "1";
    const t = normalizeTab(tab);

    // Safe default if something is missing
    if (!b) return "book-overview-titus.html";

    // Book-level view (chapter=0) never points at chapter-* docs.
    // The URL may still use chapter=0 internally, while the file itself
    // follows the canonical book-overview-{book}.html naming convention.
    if (ch === "0") return `book-overview-${b}.html`;

    // Explicit Book Overview tab.
    if (t === "book_introduction") return `book-overview-${b}.html`;

    const suffix = tabToDocSuffix(t);
    return `${b}-${ch}-${suffix}.html`;
  }


  // Allow things like:
  // - book-overview-titus.html
  // - titus-1-chapter-explanation.html
  // - titus-1-2-g96.html
  // - titus-1-resources-topic-name.html
  function safeDocName(name) {
    const n = String(name || "").replace(/^\/+/, "");

    // Canonical Book Overview filename.
    if (/^book-overview-[a-z0-9-]+\.html$/i.test(n)) return n;

    // Chapter/resource/word-study filenames.
    if (/^[a-z0-9\-]+-(0|\d+)-[a-z0-9\-]+\.html$/i.test(n)) return n;

    return "";
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
      ["ΓÇ£", "“"],
      ["ΓÇØ", "”"],
      ["ΓÇ¥", "”"],
      ["ΓÇÿ", "‘"],
      ["ΓÇÖ", "’"],
      ["ΓÇª", "…"],
      ["ΓÇô", "—"],
      ["ΓÇò", "—"],
      ["ΓÇû", "–"],
      ["ΓÇó", "•"],
      ["ΓÂ ", " "],
      ["ΓÂ", ""],
    ];

    // Common UTF-8-as-Win1252 "â€.." family
    const map2 = [
      ["â€”", "—"],
      ["â€“", "–"],
      ["â€œ", "“"],
      ["â€", "”"],
      ["â€˜", "‘"],
      ["â€™", "’"],
      ["â€¦", "…"],
    ];

    // Common double-encoded "Γâ.." family
    const map3 = [
      ["Γâ€”", "—"],
      ["Γâ€“", "–"],
      ["Γâ€œ", "“"],
      ["Γâ€", "”"],
      ["Γâ€˜", "‘"],
      ["Γâ€™", "’"],
      ["Γâ€¦", "…"],
    ];

    const applyMap = (str, map) => {
      let out = str;
      for (const [bad, good] of map) out = out.split(bad).join(good);
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
  // Turns: disqualified (G96) into:
  //   <span class="ws" data-ws="G96" data-ws-doc="...">disqualified</span>
  // Option A naming:
  //   data-ws-doc: {book}-{chapter}-{verse}-g96.html (leading zeros removed)
  // ==========================================
  function enhanceStrongMarkersToWordStudies(rootEl, meta, docPath) {
    if (!rootEl) return;

    const re = /(\b[\w’'-]+\b)\s*\(([GH]\d{1,5})\)/gi;
    const baseDir = docPath ? docPath.slice(0, docPath.lastIndexOf("/") + 1) : "";

    function normalizeStrongLower(strong) {
      const s = String(strong || "").trim();
      if (!s) return "";
      const letter = s[0].toLowerCase();
      const digits = s.slice(1).replace(/\D/g, "");
      const n = parseInt(digits, 10);
      if (!Number.isFinite(n)) return "";
      return `${letter}${n}`;
    }

    function verseFromString(value) {
      const s = String(value || "").trim();
      if (!s) return null;

      // Full Bible reference, e.g. "Psalms 19:2".
      let m = s.match(/\b(?:[1-3]\s+)?[A-Za-z][A-Za-z ]*\s+\d+\s*:\s*(\d+)\b/i);
      if (m) return Number(m[1]);

      // Explicit verse labels, e.g. "Verse 2", "v. 2", "v2".
      m = s.match(/\b(?:verse|v\.?)\s*(\d+)\b/i);
      if (m) return Number(m[1]);

      return null;
    }

    function findVerseForNode(node) {
      const el = node && node.parentElement ? node.parentElement : null;
      if (!el) return null;

      // Prefer explicit verse metadata if the generated HTML supplies it.
      const explicit = el.closest("[data-verse],[data-verse-number],[data-verse-ref]");
      if (explicit) {
        for (const attr of ["data-verse", "data-verse-number", "data-verse-ref"]) {
          const raw = explicit.getAttribute(attr);
          const byRef = verseFromString(raw);
          if (byRef) return byRef;

          const digitsOnly = String(raw || "").match(/^\s*(\d+)\s*$/);
          if (digitsOnly) return Number(digitsOnly[1]);
        }
      }

      // Search the nearest logical verse/card/table row.
      const scope = el.closest(
        ".mtb-verse, .verse, .verse-card, .study-verse, .chapter-study-verse, " +
        ".mtb-card, .card, tr, section, article, li"
      );
      if (scope) {
        const v = verseFromString(scope.textContent);
        if (v) return v;
      }

      // Fall back to preceding elements. Chapter Study normally places
      // the verse reference before the content belonging to that verse.
      let cur = el;
      while (cur && cur !== rootEl) {
        let prev = cur.previousElementSibling;
        while (prev) {
          const v = verseFromString(prev.textContent);
          if (v) return v;
          prev = prev.previousElementSibling;
        }
        cur = cur.parentElement;
      }

      return null;
    }

    function buildWsDocPath(strong, verse) {
      if (!meta || !meta.book || !meta.chapter || !baseDir || !verse) return null;
      const strongLower = normalizeStrongLower(strong);
      if (!strongLower) return null;

      // Locked MTB standard:
      // {book}-{chapter}-{verse}-{g|h}{StrongNumber}.html
      return `${baseDir}${meta.book}-${meta.chapter}-${verse}-${strongLower}.html`;
    }

    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach((node) => {
      const value = node.nodeValue;
      if (!value) return;

      const parentEl = node.parentElement;
      if (parentEl && parentEl.closest && parentEl.closest(".ws")) return;

      re.lastIndex = 0;
      if (!re.test(value)) return;
      re.lastIndex = 0;

      const verse = findVerseForNode(node);
      if (!verse) {
        console.warn("MTB Word Study: verse not found for Strong's marker:", value);
        return;
      }

      const frag = document.createDocumentFragment();
      let last = 0;
      let m;

      while ((m = re.exec(value)) !== null) {
        const full = m[0];
        const word = m[1];
        const strong = m[2].toUpperCase();
        const start = m.index;

        if (start > last) {
          frag.appendChild(document.createTextNode(value.slice(last, start)));
        }

        const span = document.createElement("span");
        span.className = "ws";
        span.setAttribute("data-ws", strong);
        span.setAttribute("data-verse", String(verse));
        span.textContent = word;

        const wsDoc = buildWsDocPath(strong, verse);
        if (wsDoc) span.setAttribute("data-ws-doc", wsDoc);

        frag.appendChild(span);
        last = start + full.length;
      }

      if (last < value.length) {
        frag.appendChild(document.createTextNode(value.slice(last)));
      }

      node.parentNode.replaceChild(frag, node);
    });
  }

  // ==========================================
  // SCRIPTURE CONTROLS (toggle NKJV/NLT)
  // ==========================================
  function clearScriptureColumnHiding() {
    const target = document.getElementById("doc-target");
    if (!target) return;

    const table = target.querySelector("table");
    if (!table) return;

    table.querySelectorAll("tr").forEach((row) => {
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
      table.querySelectorAll("tr").forEach((row) => {
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
      bar.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    }

    function makeBtn(label, mode, makeDefaultActive) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sc-btn";
      b.textContent = label;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        setActive(b);
        applyMode(mode);
      });
      if (makeDefaultActive) setActive(b);
      return b;
    }

    const btnBoth = makeBtn("Both", "both", true);
    const btnNKJV = makeBtn("NKJV Only", "nkjv", false);
    const btnNLT = makeBtn("NLT Only", "nlt", false);

    bar.appendChild(btnBoth);
    bar.appendChild(btnNKJV);
    bar.appendChild(btnNLT);

    target.parentNode.insertBefore(bar, target);
    applyMode("both");
  }
// ==========================================
// DWELL GROUPING (one green box per verse)
// Wrap consecutive .MTB-Dwell blocks in .MTB-Dwell-Group
// ==========================================
function groupVerseDwellBlocks(root) {
  if (!root) return;

  const children = Array.from(root.children);
  let currentGroup = null;

  for (const el of children) {
    const isDwell = el.classList && el.classList.contains("MTB-Dwell");

    if (isDwell) {
      if (!currentGroup) {
        currentGroup = document.createElement("div");
        currentGroup.className = "MTB-Dwell-Group";
        root.insertBefore(currentGroup, el);
      }
      currentGroup.appendChild(el);
    } else {
      currentGroup = null;
    }
  }
}
// ==========================================
// CHAPTER STUDY VERSE CARDS
// One-row preview:
// Reference | NKJV | NLT | Main Idea | +/-
// Expansion shows Verse Explanation + Remarks
// ==========================================
function buildChapterStudyVerseCards(root) {
  if (!root) return;

  const detailsList = Array.from(
    root.querySelectorAll("details.mtb-study-verse")
  );

  if (!detailsList.length) return;

  detailsList.forEach((details) => {
    const summary = details.querySelector(":scope > summary");
    const grid = details.querySelector(".mtb-study-verse-grid");

    if (!summary || !grid) return;

    const panels = Array.from(
      grid.querySelectorAll(":scope > .mtb-study-verse-panel")
    );

    // Expected order:
    // 0 NKJV
    // 1 NLT
    // 2 Main Idea
    // 3 Verse Explanation
    // 4 Remark(s)
    if (panels.length < 5) return;

    const card = document.createElement("div");
    card.className = "mtb-study-verse-card";
    card.dataset.verse = details.dataset.verse || "";

    // ---------------------------------------
    // ONE-ROW PREVIEW
    // ---------------------------------------
    const row = document.createElement("div");
    row.className = "mtb-study-row";

    // Verse reference
    const refCell = document.createElement("div");
    refCell.className = "mtb-study-row-reference";
    refCell.textContent = summary.textContent.trim();

    // Helper to extract panel content
    function makePreviewCell(panel, label, extraClass) {
      const cell = document.createElement("div");
      cell.className = `mtb-study-row-cell ${extraClass || ""}`;

      const labelEl = document.createElement("div");
      labelEl.className = "mtb-study-row-label";
      labelEl.textContent = label;

      const content = panel.querySelector(".mtb-study-verse-panel-content");

      const contentEl = document.createElement("div");
      contentEl.className = "mtb-study-row-content";

      if (content) {
        while (content.firstChild) {
          contentEl.appendChild(content.firstChild);
        }
      }

      cell.appendChild(labelEl);
      cell.appendChild(contentEl);

      return cell;
    }

    const nkjvCell = makePreviewCell(
      panels[0],
      "NKJV",
      "mtb-study-row-nkjv"
    );

    const nltCell = makePreviewCell(
      panels[1],
      "NLT",
      "mtb-study-row-nlt"
    );

    const ideaCell = makePreviewCell(
      panels[2],
      "Main Idea",
      "mtb-study-row-mainidea"
    );

    // Toggle button
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "mtb-study-row-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute(
      "aria-label",
      `Expand study for ${summary.textContent.trim()}`
    );
    toggle.textContent = "+";

    row.appendChild(refCell);
    row.appendChild(nkjvCell);
    row.appendChild(nltCell);
    row.appendChild(ideaCell);
    row.appendChild(toggle);

    // ---------------------------------------
    // EXPANDED CONTENT
    // ---------------------------------------
    const deep = document.createElement("div");
    deep.className = "mtb-study-verse-deep";

    const deepGrid = document.createElement("div");
    deepGrid.className = "mtb-study-verse-deep-grid";

    const explanation = panels[3];
    const remarks = panels[4];

    explanation.classList.remove("mtb-study-span-2", "mtb-study-span-4");
    remarks.classList.remove("mtb-study-span-2", "mtb-study-span-4");

    explanation.classList.add("mtb-study-deep-explanation");
    remarks.classList.add("mtb-study-deep-remarks");

    deepGrid.appendChild(explanation);
    deepGrid.appendChild(remarks);
    deep.appendChild(deepGrid);

    // ---------------------------------------
    // OPEN / CLOSE
    // ---------------------------------------
    function setOpen(open) {
      card.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "−" : "+";
    }

    toggle.addEventListener("click", () => {
      setOpen(!card.classList.contains("is-open"));
    });

    // Clicking reference also expands/collapses
    refCell.addEventListener("click", () => {
      setOpen(!card.classList.contains("is-open"));
    });

    card._mtbSetOpen = setOpen;

    card.appendChild(row);
    card.appendChild(deep);

    details.replaceWith(card);
  });

  // ---------------------------------------
  // EXPAND ALL / COLLAPSE ALL
  // ---------------------------------------
  const controls = root.querySelectorAll(".mtb-study-control");

  controls.forEach((button) => {
    const label = (button.textContent || "").trim().toLowerCase();

    button.removeAttribute("onclick");

    if (label === "expand all") {
      button.addEventListener("click", () => {
        root.querySelectorAll(".mtb-study-verse-card").forEach((card) => {
          if (typeof card._mtbSetOpen === "function") {
            card._mtbSetOpen(true);
          }
        });
      });
    }

    if (label === "collapse all") {
      button.addEventListener("click", () => {
        root.querySelectorAll(".mtb-study-verse-card").forEach((card) => {
          if (typeof card._mtbSetOpen === "function") {
            card._mtbSetOpen(false);
          }
        });
      });
    }
  });
// ---------------------------------------
// MOVE PRINT BUTTON BESIDE COLLAPSE ALL
// ---------------------------------------
const printControls = document.querySelector(".mtb-print-controls");
const studyControls = root.querySelector(".mtb-study-controls");

if (printControls && studyControls) {

  // Find the actual Print This Page button/link
  const printButton =
    printControls.querySelector("button") ||
    printControls.querySelector("a");

  if (printButton) {
    // Move it after Collapse All
    studyControls.appendChild(printButton);

    // Remove the now-empty original wrapper
    printControls.remove();
  }
}
}
// ==========================================
// CHAPTER SCRIPTURE — VERSE EXPLANATION POPUP
// Adds small "i" buttons beside verse numbers.
// Pulls content from the existing Chapter Study file.
// ==========================================
function addScriptureExplainButtons(root, meta, scriptureDocPath) {
  if (!root || !meta || meta.type !== "chapter-scripture") return;

  const chapterDir =
    scriptureDocPath.slice(0, scriptureDocPath.lastIndexOf("/") + 1);

  const explanationFile =
    `${meta.book}-${meta.chapter}-chapter-explanation.html`;

  const explanationPath = chapterDir + explanationFile;

  let cachedExplanationDoc = null;

  // ---------------------------------------
  // CREATE MODAL ONCE
  // ---------------------------------------
  function ensureModal() {
    let overlay = document.getElementById("mtb-verse-explain-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "mtb-verse-explain-overlay";
    overlay.className = "mtb-verse-explain-overlay";
    overlay.setAttribute("aria-hidden", "true");

    overlay.innerHTML = `
      <div class="mtb-verse-explain-modal"
           role="dialog"
           aria-modal="true"
           aria-labelledby="mtb-verse-explain-reference">

        <button type="button"
                class="mtb-verse-explain-close"
                aria-label="Close verse explanation">×</button>

        <div class="mtb-verse-explain-header">
          <div id="mtb-verse-explain-reference"
               class="mtb-verse-explain-reference"></div>

          <div class="mtb-verse-explain-scripture"></div>
        </div>

        <div class="mtb-verse-explain-body">

          <section class="mtb-verse-explain-section mtb-verse-explain-mainidea">
            <h3>Main Idea</h3>
            <div class="mtb-verse-explain-section-content"></div>
          </section>

          <section class="mtb-verse-explain-section">
            <h3>Verse Explanation</h3>
            <div class="mtb-verse-explain-section-content"></div>
          </section>

          <section class="mtb-verse-explain-section">
            <h3>Remark(s)</h3>
            <div class="mtb-verse-explain-section-content"></div>
          </section>

        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeButton =
      overlay.querySelector(".mtb-verse-explain-close");

    function closeModal() {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("mtb-verse-explain-open");
    }

    closeButton.addEventListener("click", closeModal);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("is-open")) {
        closeModal();
      }
    });

    return overlay;
  }

  // ---------------------------------------
  // REMOVE DUPLICATED REFERENCE / (NKJV)
  // while preserving Strong's spans
  // ---------------------------------------
  function cleanNkJVClone(container, reference) {
    if (!container) return;

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT
    );

    const textNodes = [];

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    // Remove leading reference from first appropriate text node.
    for (const node of textNodes) {
      const text = node.nodeValue || "";
      const trimmed = text.trimStart();

      if (trimmed.startsWith(reference)) {
        const leadingSpaceLength = text.length - trimmed.length;

        node.nodeValue =
          text.slice(0, leadingSpaceLength) +
          trimmed.slice(reference.length).replace(/^\s+/, "");

        break;
      }
    }

    // Remove trailing "(NKJV)".
    for (let i = textNodes.length - 1; i >= 0; i--) {
      const node = textNodes[i];
      const text = node.nodeValue || "";

      if (/\(NKJV\)\s*$/i.test(text)) {
        node.nodeValue = text.replace(/\s*\(NKJV\)\s*$/i, "");
        break;
      }
    }
  }

  // ---------------------------------------
  // RESOLVE WORD STUDY PATHS
  // so links still work from modal
  // ---------------------------------------
  function prepareWordStudyLinks(container) {
    if (!container) return;

    container.querySelectorAll(".ws[data-ws-doc]").forEach((span) => {
      const current = span.getAttribute("data-ws-doc") || "";

      if (!current) return;

      // Already absolute
      if (current.startsWith("/")) return;

      span.setAttribute(
        "data-ws-doc",
        chapterDir + current.replace(/^\/+/, "")
      );
    });

    container.setAttribute("data-doc-dir", chapterDir);
  }

  // ---------------------------------------
  // FETCH CHAPTER STUDY ON FIRST CLICK
  // ---------------------------------------
  async function getExplanationDoc() {
    if (cachedExplanationDoc) return cachedExplanationDoc;

    const response = await fetch(explanationPath, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Could not load Chapter Study: ${explanationPath}`
      );
    }

    const html = await response.text();

    cachedExplanationDoc =
      new DOMParser().parseFromString(html, "text/html");

    return cachedExplanationDoc;
  }

  // ---------------------------------------
  // OPEN ONE VERSE
  // ---------------------------------------
  async function openVerseExplanation(verse) {
    const overlay = ensureModal();

    const refEl =
      overlay.querySelector(".mtb-verse-explain-reference");

    const scriptureEl =
      overlay.querySelector(".mtb-verse-explain-scripture");

    const sectionContents =
      overlay.querySelectorAll(
        ".mtb-verse-explain-section-content"
      );

    const reference =
      `${prettyBookName(meta.book)} ${meta.chapter}:${verse}`;

    refEl.textContent = reference;

    scriptureEl.innerHTML =
      `<span class="mtb-verse-explain-loading">Loading…</span>`;

    sectionContents.forEach((el) => {
      el.innerHTML = "";
    });

    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("mtb-verse-explain-open");

    try {
      const studyDoc = await getExplanationDoc();

      const verseBlock =
        studyDoc.querySelector(
          `details.mtb-study-verse[data-verse="${verse}"]`
        );

      if (!verseBlock) {
        throw new Error(`Verse ${verse} was not found.`);
      }

      const panels = Array.from(
        verseBlock.querySelectorAll(
          ".mtb-study-verse-grid > .mtb-study-verse-panel"
        )
      );

      if (panels.length < 5) {
        throw new Error(
          `Chapter Study content for verse ${verse} is incomplete.`
        );
      }

      // Existing panel order:
      // 0 NKJV
      // 1 NLT
      // 2 Main Idea
      // 3 Verse Explanation
      // 4 Remark(s)

      const nkjvSource =
        panels[0].querySelector(
          ".mtb-study-verse-panel-content"
        );

      const mainIdeaSource =
        panels[2].querySelector(
          ".mtb-study-verse-panel-content"
        );

      const explanationSource =
        panels[3].querySelector(
          ".mtb-study-verse-panel-content"
        );

      const remarksSource =
        panels[4].querySelector(
          ".mtb-study-verse-panel-content"
        );

      // NKJV beside reference
      scriptureEl.innerHTML =
        nkjvSource ? nkjvSource.innerHTML : "";

      cleanNkJVClone(scriptureEl, reference);
      prepareWordStudyLinks(scriptureEl);

      // Main Idea
      sectionContents[0].innerHTML =
        mainIdeaSource ? mainIdeaSource.innerHTML : "";

      // Verse Explanation
      sectionContents[1].innerHTML =
        explanationSource ? explanationSource.innerHTML : "";

      // Remarks
      sectionContents[2].innerHTML =
        remarksSource ? remarksSource.innerHTML : "";

      // Clean generated leading blank lines.
      sectionContents.forEach((content) => {
        content.querySelectorAll("p").forEach((p) => {
          while (
            p.firstChild &&
            p.firstChild.nodeName === "BR"
          ) {
            p.firstChild.remove();
          }
        });
      });

      // Re-bind existing Word Study behavior.
      try {
        if (
          window.MTBWordStudyHover &&
          typeof window.MTBWordStudyHover.bind === "function"
        ) {
          window.MTBWordStudyHover.bind(scriptureEl);
        }
      } catch (e) {
        console.warn(
          "MTB Word Study binding in verse popup failed:",
          e
        );
      }

    } catch (err) {
      scriptureEl.innerHTML = `
        <span class="mtb-verse-explain-error">
          Verse explanation could not be loaded.
        </span>
      `;

      console.error(err);
    }
  }

  // ---------------------------------------
  // EXPOSE POPUP TO CHAPTER SCRIPTURE
  // ---------------------------------------
  window.MTB = window.MTB || {};

  window.MTB.openVerseExplanation = function (verse) {
    const verseNumber = Number(verse);
    if (!Number.isFinite(verseNumber)) return;
    openVerseExplanation(verseNumber);
  };

  // ---------------------------------------
  // BOOK DISPLAY NAME
  // ---------------------------------------
  function prettyBookName(slug) {
    return String(slug || "")
      .split("-")
      .map((word) => {
        if (!word) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }


}
  // ==========================================
  // LOADING CORE
  // ==========================================
  function applyLoadedHtml(docName, docPath, htmlText) {
    const meta = parseDocName(docName);
    setBodyDocMeta(meta);

    const parsed = new DOMParser().parseFromString(htmlText, "text/html");
    const root = parsed.querySelector("#doc-root");
    const content = root ? root.innerHTML : parsed.body.innerHTML;

    const target = document.getElementById("doc-target");
    if (!target) return;

    target.innerHTML = fixMojibake(content);
    // Store injected document directory for word-study resolution
// Example docPath: "/books/new-testament/titus/002/titus-2-chapter-explanation.html"
// injectedDocDir: "/books/new-testament/titus/002/"

    // Store injected document directory for word-study resolution (critical for book.html SPA loading)
const injectedDocDir = docPath.slice(0, docPath.lastIndexOf("/") + 1); // ends with "/"
target.setAttribute("data-doc-dir", injectedDocDir);
    
    groupDwellBlocks(target);
    wireDocLinks(target);
if (meta.type === "chapter-explanation") {
  buildChapterStudyVerseCards(target);
}

/* ==========================================
   GROUP DWELL BLOCKS INTO ONE BOX PER VERSE
   ========================================== */
      groupVerseDwellBlocks(target);

      document.dispatchEvent(new CustomEvent("mtb:doc-injected"));

   
    const isExplanation =
      meta.type === "chapter-explanation" || /chapter[-_]?explanation\.html$/i.test(docName);

    if (isExplanation) {
      enhanceStrongMarkersToWordStudies(target, meta, docPath);

      // Optional JSON mode support (backward compatibility)
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
  addScriptureExplainButtons(target, meta, docPath);
}
  }

  function fetchAndLoadDoc(docName) {
    removeScriptureControls();

    const meta = parseDocName(docName);
    if (!meta.book) {
      const target = document.getElementById("doc-target");
      if (target) target.innerHTML = `<p>Invalid document name.</p>`;
      return;
    }

    const docPath = buildDocPath(docName);
    if (!docPath) {
      const target = document.getElementById("doc-target");
      if (target) target.innerHTML = `<p>Could not build document path.</p>`;
      return;
    }

    fetch(docPath, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load: " + docPath);
        return r.text();
      })
      .then((html) => {
        applyLoadedHtml(docName, docPath, html);
      })
      .catch((err) => {
        const target = document.getElementById("doc-target");
        if (!target) return;
        target.innerHTML = `<p>Content failed to load.</p><pre>${err.message}</pre>`;
      });
  }

  // Public: load a specific doc by filename (used by resource-topic links)
  function loadDoc(docName) {
    const safe = safeDocName(docName);
    if (!safe) return;
    fetchAndLoadDoc(safe);
  }


  function groupDwellBlocks(docTarget) {
  if (!docTarget) return;
  const kids = Array.from(docTarget.querySelectorAll(":scope > *"));
  

  // A node "counts" as Dwell if:
  // - it is a .MTB-Dwell block
  // - OR it is a UL/OL that contains .MTB-Dwell (common when Word bullets are used)
  function isDwellNode(node) {
    if (!node || node.nodeType !== 1) return false;

    if (node.classList.contains("MTB-Dwell")) return true;

    const tag = node.tagName;
    if (tag === "UL" || tag === "OL") {
      // If any li contains an element with MTB-Dwell, treat the list as dwell content
      if (node.querySelector(".MTB-Dwell")) return true;

      // If the list itself was tagged dwell (some pipelines do this)
      if (node.classList.contains("MTB-Dwell")) return true;
    }

    return false;
  }

  let i = 0;
  while (i < kids.length) {
    const start = kids[i];

    if (!isDwellNode(start)) {
      i++;
      continue;
    }

    // Create a wrapper and collect consecutive dwell nodes
    const wrap = document.createElement("div");
    wrap.className = "MTB-Dwell-Group";

    let j = i;
    while (j < kids.length && isDwellNode(kids[j])) {
      wrap.appendChild(kids[j]);
      j++;
    }

    // Insert wrapper where the first dwell node was
    docTarget.insertBefore(wrap, kids[j] || null);

    // Rebuild kids list because we modified DOM
    const newKids = Array.from(docTarget.children);
    kids.length = 0;
    kids.push(...newKids);

    // Continue after the wrapper
    i = kids.indexOf(wrap) + 1;
  }
}

  // Load from URL params (normal navigation)
// Load from URL params (normal navigation)
function loadCurrentDocFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const docParamRaw = params.get("doc");
  const bookParam = params.get("book");
  const chapterParamRaw = params.get("chapter");
  const tabParamRaw = params.get("tab");

  const safeDoc = docParamRaw ? safeDocName(docParamRaw) : "";
  const inferredFromDoc = safeDoc ? parseDocName(safeDoc) : null;

  // If a resources doc is provided but tab is missing, assume Resources.
  // This prevents falling back to chapter_scripture and then deleting doc=.
  const docLooksLikeResources = safeDoc && safeDoc.includes("-resources-");
  // =====================
// BOOK HERO PAGE (book-level landing)
// If chapter=0 and tab=book_home, do not load a doc.
// =====================
if (String(chapterParamRaw) === "0" && String(tabParamRaw) === "book_home") {
  const target = document.getElementById("doc-target");
  
  if (target) target.innerHTML = "";
  return;
}


  let tabParam = tabParamRaw || (docLooksLikeResources ? RESOURCES_TAB : DEFAULT_TAB);

  tabParam = normalizeTab(tabParam);
  const tabLower = String(tabParam).toLowerCase();

  // Honor doc= when Resources is active OR when the doc itself is a resources page.
  const shouldUseDoc = docLooksLikeResources || normalizeTab(tabParam) === RESOURCES_TAB;

  // Determine the chapter we should use for chapter-based docs.
  // If chapter is missing/0, but the doc implies a real chapter, use that.
  let chapterParam = chapterParamRaw || "1";
  const chNum = parseInt(String(chapterParam).replace(/[^\d]/g, "") || "0", 10);
  if ((!chapterParamRaw || chNum === 0) && inferredFromDoc && inferredFromDoc.chapter && inferredFromDoc.chapter > 0) {
    chapterParam = String(inferredFromDoc.chapter);
  }

  // Determine docName
  const docName =
    (shouldUseDoc && safeDoc)
      ? safeDoc
      : (bookParam
          ? buildDocNameFromParams(bookParam, chapterParam, tabParam)
          : "book-overview-titus.html");

  // Canonicalize URL based on what we now know.
  // - If doc implies book/chapter and they are missing/invalid, add/fix them
  // - If resources doc is present, ensure tab stays on chapter_resources
  // - Only remove doc= when we truly are not in resources context
  {
    const url = new URL(window.location.href);

    if (inferredFromDoc && inferredFromDoc.book && !url.searchParams.get("book")) {
      url.searchParams.set("book", inferredFromDoc.book);
    }

    if (inferredFromDoc && inferredFromDoc.chapter != null) {
      const urlCh = parseInt(url.searchParams.get("chapter") || "0", 10);
      if (!url.searchParams.get("chapter") || urlCh === 0) {
        url.searchParams.set("chapter", String(inferredFromDoc.chapter));
      }
    }

    if (docLooksLikeResources) {
      url.searchParams.set("tab", RESOURCES_TAB);
      // Keep doc= as-is (canonical safeDoc)
      if (safeDoc) url.searchParams.set("doc", safeDoc);
    }

    // If we're not on Resources, remove doc so it cannot pin navigation.
    if (!shouldUseDoc && url.searchParams.get("doc")) {
      url.searchParams.delete("doc");
    }

    window.history.replaceState({}, "", url.toString());
  }

  fetchAndLoadDoc(docName);
}



  // Global delegated handler for doc links.
  // Resource pages are injected dynamically, so direct listeners are fragile.
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a) return;

    // Prefer explicit data-doc
    const dataDoc = a.getAttribute("data-doc");
    if (dataDoc) {
      e.preventDefault();
      const doc = safeDocName(dataDoc) || dataDoc;

      const url = new URL(window.location.href);
      url.searchParams.set("tab", RESOURCES_TAB);
      url.searchParams.set("doc", doc);

      const inferred = parseDocName(doc);
      if (inferred.book) url.searchParams.set("book", inferred.book);
      if (inferred.chapter != null) url.searchParams.set("chapter", String(inferred.chapter));

      window.history.pushState({}, "", url.toString());
      loadCurrentDocFromUrl();
      return;
    }

    // Intercept href links that specify ?doc=...
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

    try {
      const u = new URL(href, window.location.href);
      if (u.origin !== window.location.origin) return;

      const doc = u.searchParams.get("doc");
      if (!doc) return;

      e.preventDefault();

      const safe = safeDocName(doc) || doc;

      const url = new URL(window.location.href);
      url.searchParams.set("tab", RESOURCES_TAB);
      url.searchParams.set("doc", safe);

      const inferred = parseDocName(safe);
      if (inferred.book) url.searchParams.set("book", inferred.book);
      if (inferred.chapter != null) url.searchParams.set("chapter", String(inferred.chapter));

      window.history.pushState({}, "", url.toString());
      loadCurrentDocFromUrl();
    } catch (_) {
      // ignore malformed URLs
    }
  }, true);



  // Boot
  loadCurrentDocFromUrl();
  window.addEventListener("popstate", loadCurrentDocFromUrl);

  // Expose for debugging / other scripts
  window.MTBLoadDoc = {
    loadCurrentDocFromUrl,
    loadDoc,
  };
})();
(function () {
  const MODE_KEY = "mtb_ce_mode"; // remembers last mode

  function isChapterExplanationActive() {
    // 1) URL param check (adjust values if your tab names differ)
    const params = new URLSearchParams(window.location.search);
    const tab = (params.get("tab") || "").toLowerCase();
    if (tab.includes("chapter_explanation") || tab.includes("chapter-explanation")) return true;

    // 2) If your system loads docs by filename in ?doc=
    const doc = (params.get("doc") || "").toLowerCase();
    if (doc.includes("chapter-explanation")) return true;

    // 3) Fallback: active tab button text
    const activeBtn =
      document.querySelector(".tab-button.active") ||
      document.querySelector(".tabs button.active") ||
      document.querySelector("button.active");
    if (activeBtn && /chapter explanation/i.test(activeBtn.textContent || "")) return true;

    // 4) Fallback: the loaded content heading
    const h1 = document.querySelector("#doc-target h1");
    if (h1 && /explanation/i.test(h1.textContent || "")) return true;

    return false;
  }

  function ensureModeBar() {
    let bar = document.getElementById("ce-modebar");
    if (bar) return bar;

    bar = document.createElement("div");
    bar.id = "ce-modebar";

    bar.innerHTML = `
      <button type="button" class="ce-modebtn" data-mode="read">READ</button>
      <button type="button" class="ce-modebtn" data-mode="understand">UNDERSTAND</button>
      <button type="button" class="ce-modebtn" data-mode="dwell">DWELL</button>
    `;

    // Put it right above the doc content
    const target = document.getElementById("doc-target");
    if (target && target.parentNode) {
      target.parentNode.insertBefore(bar, target);
    } else {
      document.body.appendChild(bar);
    }

    bar.addEventListener("click", (e) => {
      const btn = e.target.closest(".ce-modebtn");
      if (!btn) return;
      setMode(btn.getAttribute("data-mode"));
    });

    return bar;
  }

  function setMode(mode) {
    const body = document.body;
    body.classList.remove("ce-mode-read", "ce-mode-understand", "ce-mode-dwell");

    if (mode === "read") body.classList.add("ce-mode-read");
    else if (mode === "understand") body.classList.add("ce-mode-understand");
    else body.classList.add("ce-mode-dwell");

    try { localStorage.setItem(MODE_KEY, mode); } catch {}
    updateModeButtons(mode);
  }

  function updateModeButtons(mode) {
    const bar = document.getElementById("ce-modebar");
    if (!bar) return;
    bar.querySelectorAll(".ce-modebtn").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-mode") === mode);
    });
  }

  function showHideModeBar() {
    const bar = ensureModeBar();
    const on = isChapterExplanationActive();

    bar.style.display = on ? "flex" : "none";

    // If not in chapter explanation, remove mode classes
    if (!on) {
      document.body.classList.remove("ce-mode-read", "ce-mode-understand", "ce-mode-dwell");
      return;
    }

    // Apply last saved mode (default dwell)
    let mode = "dwell";
    try { mode = localStorage.getItem(MODE_KEY) || "dwell"; } catch {}
    setMode(mode);
  }

  // Run on page load
  document.addEventListener("DOMContentLoaded", showHideModeBar);

  // If your page swaps docs/tabs without full reload, call this after a doc is injected:
  // window.mtbAfterDocLoad?.push(showHideModeBar)
  // For now we also watch for changes in #doc-target (safe + simple)
  const target = document.getElementById("doc-target");
  if (target) {
    const obs = new MutationObserver(() => showHideModeBar());
    obs.observe(target, { childList: true, subtree: true });
  }

  // Also watch for tab clicks (covers most setups)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (/chapter explanation/i.test(btn.textContent || "") || btn.id?.toLowerCase().includes("explanation")) {
      setTimeout(showHideModeBar, 0);
    }
  });
})();
