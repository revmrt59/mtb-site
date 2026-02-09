(function () {

  // ==========================================
  // BOOK → TESTAMENT MAP
  // ==========================================
  const BOOK_TESTAMENT = {
    // New Testament
    "matthew": "new-testament",
    "mark": "new-testament",
    "luke": "new-testament",
    "john": "new-testament",
    "acts": "new-testament",
    "romans": "new-testament",
    "1-corinthians": "new-testament",
    "2-corinthians": "new-testament",
    "galatians": "new-testament",
    "ephesians": "new-testament",
    "philippians": "new-testament",
    "colossians": "new-testament",
    "1-thessalonians": "new-testament",
    "2-thessalonians": "new-testament",
    "1-timothy": "new-testament",
    "2-timothy": "new-testament",
    "titus": "new-testament",
    "philemon": "new-testament",
    "hebrews": "new-testament",
    "james": "new-testament",
    "1-peter": "new-testament",
    "2-peter": "new-testament",
    "1-john": "new-testament",
    "2-john": "new-testament",
    "3-john": "new-testament",
    "jude": "new-testament",
    "revelation": "new-testament",

    // Old Testament
    "genesis": "old-testament",
    "exodus": "old-testament",
    "leviticus": "old-testament",
    "numbers": "old-testament",
    "deuteronomy": "old-testament",
    "joshua": "old-testament",
    "judges": "old-testament",
    "ruth": "old-testament",
    "1-samuel": "old-testament",
    "2-samuel": "old-testament",
    "1-kings": "old-testament",
    "2-kings": "old-testament",
    "1-chronicles": "old-testament",
    "2-chronicles": "old-testament",
    "ezra": "old-testament",
    "nehemiah": "old-testament",
    "esther": "old-testament",
    "job": "old-testament",
    "psalms": "old-testament",
    "proverbs": "old-testament",
    "ecclesiastes": "old-testament",
    "song-of-solomon": "old-testament",
    "isaiah": "old-testament",
    "jeremiah": "old-testament",
    "lamentations": "old-testament",
    "ezekiel": "old-testament",
    "daniel": "old-testament",
    "hosea": "old-testament",
    "joel": "old-testament",
    "amos": "old-testament",
    "obadiah": "old-testament",
    "jonah": "old-testament",
    "micah": "old-testament",
    "nahum": "old-testament",
    "habakkuk": "old-testament",
    "zephaniah": "old-testament",
    "haggai": "old-testament",
    "zechariah": "old-testament",
    "malachi": "old-testament"
  };

  // ==========================================
  // DOC PARSING
  // ==========================================
  function parseDocName(docName) {

    const intro = docName.match(/^([a-z0-9-]+)-0-book-introduction\.html$/);
    if (intro) return { book: intro[1], chapter: 0, type: "book-introduction" };

    const chap = docName.match(
      /^([a-z0-9-]+)-(\d+)-chapter-(scripture|orientation|explanation|insights)\.html$/
    );
    if (chap) return { book: chap[1], chapter: Number(chap[2]), type: "chapter-" + chap[3] };

    const eg = docName.match(/^([a-z0-9-]+)-(\d+)-eg-culture\.html$/);
    if (eg) return { book: eg[1], chapter: Number(eg[2]), type: "eg-culture" };

    const res = docName.match(/^([a-z0-9-]+)-(\d+)-resources\.html$/);
    if (res) return { book: res[1], chapter: Number(res[2]), type: "resources" };

    return { book: "", chapter: null, type: "" };
  }

  function setBodyDocMeta(meta) {
    document.body.dataset.docType = meta.type || "";
    document.body.dataset.book = meta.book || "";
    document.body.dataset.chapter = meta.chapter ? String(meta.chapter) : "";
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

  function safeDocName(name) {
    return /^[a-z0-9\-]+-(0|\d+)-[a-z0-9\-]+\.html$/i.test(name) ? name : "";
  }

  // ==========================================
  // MOJIBAKE FIX
  // ==========================================
  function fixMojibake(html) {
    const map = [
      ["ΓÇ£", "“"], ["ΓÇØ", "”"], ["ΓÇ¥", "”"],
      ["ΓÇÿ", "‘"], ["ΓÇÖ", "’"], ["ΓÇª", "…"],
      ["ΓÇô", "—"], ["ΓÇû", "–"],
      ["Â ", " "], ["Â", ""]
    ];
    let out = html;
    map.forEach(([bad, good]) => {
      out = out.split(bad).join(good);
    });
    return out;
  }

  // ==========================================
  // WORD STUDY MARKERS (CHAPTER EXPLANATION)
  // Turns: pride (H2087) into <span class="ws" data-ws="H2087">pride</span>
  // ==========================================
function enhanceStrongMarkersToWordStudies(rootEl, meta, docPath) {
  if (!rootEl) return;

  // Matches: word (G####) or word (H####)
  const re = /(\b[\w’'-]+\b)\s*\((G\d{3,5}|H\d{3,5})\)/g;

  const baseDir = docPath ? docPath.slice(0, docPath.lastIndexOf("/") + 1) : "";

  function slugify(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[’']/g, "")          // remove apostrophes
      .replace(/[^a-z0-9]+/g, "-")   // non-alphanum -> dash
      .replace(/^-+|-+$/g, "");      // trim dashes
  }

  function buildWsDocPath(word, strong) {
    if (!meta || !meta.book || !meta.chapter || !baseDir) return null;

    // Match your generated file: obadiah-1-h1347-pride.html
    const strongLower = String(strong).toLowerCase();     // H1347 -> h1347
    const wordSlug = slugify(word);

    // If wordSlug is empty, don’t emit a doc pointer
    if (!wordSlug) return null;

    return `${baseDir}${meta.book}-${meta.chapter}-${strongLower}-${wordSlug}.html`;
  }

  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((node) => {
    const text = node.nodeValue;
    if (!text) return;

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
      span.setAttribute("data-ws", strong);
      span.textContent = word;

      // NEW: attach HTML doc pointer (canonical source)
      const wsDoc = buildWsDocPath(word, strong);
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
  // SCRIPTURE CONTROLS (UPDATED: ACTIVE BUTTON + DIRECT COLUMN TOGGLE)
  // ==========================================
  function clearScriptureColumnHiding() {
    const table = document.querySelector("#doc-target table");
    if (!table) return;

    table.querySelectorAll("tr").forEach(row => {
      const cells = row.querySelectorAll("th, td");
      if (cells.length < 3) return; // expected: Verse | NKJV | NLT
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

        // 3 columns: Verse | NKJV | NLT
        if (mode === "nkjv") cells[2].style.display = "none";
        if (mode === "nlt")  cells[1].style.display = "none";
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

    // Default
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

        target.innerHTML = fixMojibake(content);
        // ----------------------------------------------------------
// Re-bind Word Study hover + popup AFTER content injection
// ----------------------------------------------------------
try {
  if (window.MTBWordStudyHover && typeof window.MTBWordStudyHover.bind === "function") {
    window.MTBWordStudyHover.bind(target);
  }
} catch (e) {
  console.warn("MTBWordStudyHover bind failed:", e);
}



        // ----------------------------------------------------------
        // Chapter Explanation: convert "word (G####/H####)" markers + set JSON path
        // ----------------------------------------------------------
        const isExplanation =
          meta.type === "chapter-explanation" ||
          meta.key === "chapter_explanation" ||
          /chapter[-_]?explanation\.html$/i.test(docName);

        if (isExplanation) {
          // Convert: pride (H2087) -> <span class="ws" data-ws="H2087">pride</span>
          enhanceStrongMarkersToWordStudies(target, meta, docPath);


          // Build JSON path in the SAME folder as the loaded doc
          const wsJsonName = docName
            .replace(/chapter[-_]?explanation\.html$/i, "wordstudies.json");

          const baseDir = docPath.slice(0, docPath.lastIndexOf("/") + 1);
          const wsJsonPath = baseDir + wsJsonName;

          document.body.setAttribute("data-doc-type", "chapter-explanation");
          document.body.setAttribute("data-ws-json", wsJsonPath);
        } else {
          document.body.removeAttribute("data-ws-json");
          document.body.removeAttribute("data-doc-type");
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

  loadCurrentDoc();
  window.addEventListener("popstate", loadCurrentDoc);

})();
