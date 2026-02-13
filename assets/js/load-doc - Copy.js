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

      // Derive book and chapter from the file name if possible.
      const inferred = parseDocName(file);

      const url = new URL(window.location.href);

      // CRITICAL: keep chapter identity in the URL so the top buttons never lose context
      const currentBook = url.searchParams.get("book") || document.body.dataset.book || "";
      const currentChapter = url.searchParams.get("chapter") || document.body.dataset.chapter || "";

      const book = inferred.book || currentBook;
      const chapter = (inferred.chapter != null ? String(inferred.chapter) : String(currentChapter || ""));

      if (book) url.searchParams.set("book", book);
      if (chapter) url.searchParams.set("chapter", chapter);

      // We ARE pinning doc here because this is a resource topic page
      url.searchParams.set("tab", "resources");
      url.searchParams.set("doc", file);

      window.history.pushState({}, "", url.toString());

      // Always load through the canonical loader so state stays unified
      loadCurrentDoc();
    });
  });
}




  // ==========================================
  // TAB -> DOC SUFFIX
  // ==========================================
  function tabToDocSuffix(tab) {
    const t = String(tab || "").toLowerCase();

    switch (t) {
      case "scripture":
      case "chapter_scripture":
      case "chapter-scripture":
        return "chapter-scripture";

      case "explanation":
      case "chapter_explanation":
      case "chapter-explanation":
        return "chapter-explanation";

      case "orientation":
      case "chapter_orientation":
      case "chapter-orientation":
        return "chapter-orientation";

      case "insights":
      case "chapter_insights":
      case "chapter-insights":
        return "chapter-insights";

      case "eg_culture":
      case "eg-culture":
      case "egculture":
        return "chapter-eg-culture";

      case "resources":
      case "chapter_resources":
      case "chapter-resources":
        return "chapter-resources";

      default:
        return "chapter-scripture";
    }
  }

  function buildDocNameFromParams(book, chapter, tab) {
    const b = String(book || "").toLowerCase();
    const ch = String(chapter || "1").replace(/[^\d]/g, "") || "1";
    const t = String(tab || "chapter_scripture");
    if (!b) return "titus-0-book-introduction.html";
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
    wireDocLinks(target);

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

  let tabParam = tabParamRaw || (docLooksLikeResources ? "chapter_resources" : "chapter_scripture");
  const tabLower = String(tabParam).toLowerCase();

  // Honor doc= when Resources is active OR when the doc itself is a resources page.
  const shouldUseDoc =
    docLooksLikeResources ||
    tabLower === "resources" ||
    tabLower === "chapter_resources" ||
    tabLower === "chapter-resources";

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
      url.searchParams.set("tab", "chapter_resources");
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



  // Boot
  loadCurrentDocFromUrl();
  window.addEventListener("popstate", loadCurrentDocFromUrl);

  // Expose for debugging / other scripts
  window.MTBLoadDoc = {
    loadCurrentDoc: loadCurrentDocFromUrl,
    loadDoc,
  };
})();