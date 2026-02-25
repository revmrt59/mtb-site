// load-doc.js
// Mastering the Bible - document loader + chapter-explanation enhancements
// - Loads the requested generated HTML into #doc-target
// - Fixes mojibake
// - For chapter explanation pages:
//   - Converts "word (G####/H####)" markers into <span class="ws" data-ws="G####" data-ws-doc="...">
//   - Points word studies to g/h-prefixed files: book-chapter-g###.html (Option A)
//   - Sets data-ws-json for optional JSON mode (still supported by wordstudy-hover.js)
 const stamp = "LOAD-DOC v2026-02-13-01";
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
  };

  // ==========================================
  // DOC PARSING
  // ==========================================
  function parseDocName(docName) {
    const name = String(docName || "");

    const intro = name.match(/^([a-z0-9-]+)-0-book-introduction\.html$/i);
    if (intro) return { book: intro[1].toLowerCase(), chapter: 0, type: "book-introduction" };

    const chap = name.match(/^([a-z0-9-]+)-(\d+)-chapter-(scripture|orientation|explanation|insights)\.html$/i);
    if (chap) return { book: chap[1].toLowerCase(), chapter: Number(chap[2]), type: "chapter-" + chap[3].toLowerCase() };

    const eg = name.match(/^([a-z0-9-]+)-(\d+)-(chapter-)?eg-culture\.html$/i);
    if (eg) return { book: eg[1].toLowerCase(), chapter: Number(eg[2]), type: "chapter-eg-culture" };

    const res = name.match(/^([a-z0-9-]+)-(\d+)-(chapter-)?resources\.html$/i);
    if (res) return { book: res[1].toLowerCase(), chapter: Number(res[2]), type: "chapter-resources" };

    // topic pages: {book}-{ch}-resources-{topic}.html
    const resTopic = name.match(/^([a-z0-9-]+)-(\d+)-resources-[a-z0-9-]+\.html$/i);
    if (resTopic) return { book: resTopic[1].toLowerCase(), chapter: Number(resTopic[2]), type: "chapter-resources" };

    // word study pages: {book}-{ch}-g96.html or {book}-{ch}-h1234.html
    const ws = name.match(/^([a-z0-9-]+)-(\d+)-(g\d{1,5}|h\d{1,5})\.html$/i);
    if (ws) return { book: ws[1].toLowerCase(), chapter: Number(ws[2]), type: "word-study" };

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
    if (t === "orientation" || t === "chapter_orientation" || t === "chapter-orientation") return "chapter_orientation";
    if (t === "insights" || t === "chapter_insights" || t === "chapter-insights") return "chapter_insights";
    if (t === "eg_culture" || t === "eg-culture" || t === "egculture" || t === "chapter_eg_culture" || t === "chapter-eg-culture") return "eg_culture";
    if (t === "book_intro" || t === "book-intro" || t === "bookintroduction" || t === "book_introduction" || t === "book-introduction") return "book_introduction";

    return DEFAULT_TAB;
  }


// ==========================================
  // TAB -> DOC SUFFIX
  // ==========================================
  
  function tabToDocSuffix(tab) {
    switch (normalizeTab(tab)) {
      case "chapter_scripture": return "chapter-scripture";
      case "chapter_explanation": return "chapter-explanation";
      case "chapter_orientation": return "chapter-orientation";
      case "chapter_insights": return "chapter-insights";
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
    if (!b) return "titus-0-book-introduction.html";

    // Book-level view (chapter=0) never points at chapter-* docs.
    // If tab is missing/unrecognized, we still treat it as book introduction.
    if (ch === "0") return `${b}-0-book-introduction.html`;

    // Explicit book intro tab (also used as a safe fallback)
    if (t === "book_introduction") return `${b}-0-book-introduction.html`;

    const suffix = tabToDocSuffix(t);
    return `${b}-${ch}-${suffix}.html`;
  }


  // Allow things like:
  // - titus-1-chapter-explanation.html
  // - titus-1-g96.html
  // - titus-1-resources-topic-name.html
  function safeDocName(name) {
    const n = String(name || "").replace(/^\/+/, "");
    return /^[a-z0-9\-]+-(0|\d+)-[a-z0-9\-]+\.html$/i.test(n) ? n : "";
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
  //   data-ws-doc: {book}-{chapter}-g96.html  (prefix kept, leading zeros removed)
  // ==========================================
  function enhanceStrongMarkersToWordStudies(rootEl, meta, docPath) {
    if (!rootEl) return;

    // Matches: word (G###) or word (H###) ; allow 1–5 digits (so G96 works)
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

      // Guard: don't process text already inside a .ws span
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
        span.setAttribute("data-ws", strong); // keep original casing (G96/H####)
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
    // Store injected document directory for word-study resolution (critical for book.html SPA loading)
const injectedDocDir = docPath.slice(0, docPath.lastIndexOf("/") + 1); // ends with "/"
target.setAttribute("data-doc-dir", injectedDocDir);
    
    groupDwellBlocks(target);
    wireDocLinks(target);


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

    if (meta.type === "chapter-scripture") addScriptureControls();
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
          : "titus-0-book-introduction.html");

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
