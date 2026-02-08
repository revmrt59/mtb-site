(function () {

  // ==========================================
  // BOOK → TESTAMENT MAP
  // ==========================================
  const BOOK_TESTAMENT = {
    "matthew": "new-testament", "mark": "new-testament", "luke": "new-testament",
    "john": "new-testament", "acts": "new-testament", "romans": "new-testament",
    "1-corinthians": "new-testament", "2-corinthians": "new-testament",
    "galatians": "new-testament", "ephesians": "new-testament",
    "philippians": "new-testament", "colossians": "new-testament",
    "1-thessalonians": "new-testament", "2-thessalonians": "new-testament",
    "1-timothy": "new-testament", "2-timothy": "new-testament",
    "titus": "new-testament", "philemon": "new-testament",
    "hebrews": "new-testament", "james": "new-testament",
    "1-peter": "new-testament", "2-peter": "new-testament",
    "1-john": "new-testament", "2-john": "new-testament",
    "3-john": "new-testament", "jude": "new-testament",
    "revelation": "new-testament",

    "genesis": "old-testament", "exodus": "old-testament",
    "leviticus": "old-testament", "numbers": "old-testament",
    "deuteronomy": "old-testament", "joshua": "old-testament",
    "judges": "old-testament", "ruth": "old-testament",
    "1-samuel": "old-testament", "2-samuel": "old-testament",
    "1-kings": "old-testament", "2-kings": "old-testament",
    "1-chronicles": "old-testament", "2-chronicles": "old-testament",
    "ezra": "old-testament", "nehemiah": "old-testament",
    "esther": "old-testament", "job": "old-testament",
    "psalms": "old-testament", "proverbs": "old-testament",
    "ecclesiastes": "old-testament", "song-of-solomon": "old-testament",
    "isaiah": "old-testament", "jeremiah": "old-testament",
    "lamentations": "old-testament", "ezekiel": "old-testament",
    "daniel": "old-testament", "hosea": "old-testament",
    "joel": "old-testament", "amos": "old-testament",
    "obadiah": "old-testament", "jonah": "old-testament",
    "micah": "old-testament", "nahum": "old-testament",
    "habakkuk": "old-testament", "zephaniah": "old-testament",
    "haggai": "old-testament", "zechariah": "old-testament",
    "malachi": "old-testament"
  };

  // ==========================================
  // DOC PARSING
  // ==========================================
  function parseDocName(docName) {
    const intro = docName.match(/^([a-z0-9-]+)-0-book-introduction\.html$/);
    if (intro) return { book: intro[1], chapter: 0, type: "book-introduction" };

    const chap = docName.match(/^([a-z0-9-]+)-(\d+)-chapter-(scripture|orientation|explanation|insights)\.html$/);
    if (chap) return { book: chap[1], chapter: Number(chap[2]), type: "chapter-" + chap[3] };

    return { book: "", chapter: null, type: "" };
  }

  function setBodyDocMeta(meta) {
    document.body.dataset.docType = meta.type || "";
    document.body.dataset.book = meta.book || "";
    document.body.dataset.chapter = meta.chapter ? String(meta.chapter) : "";
  }

  function buildDocPath(docName) {
    const meta = parseDocName(docName);
    const testament = BOOK_TESTAMENT[meta.book] || "new-testament";
    return `/books/${testament}/${meta.book}/generated/${docName}`;
  }

  function safeDocName(name) {
    return /^[a-z0-9\-]+-(0|\d+)-[a-z0-9\-]+\.html$/i.test(name) ? name : "";
  }

  // ==========================================
  // SCRIPTURE CONTROLS (FIXED)
  // ==========================================
  function removeScriptureControls() {
    const bar = document.querySelector(".scripture-controls");
    if (bar) bar.remove();

    const table = document.querySelector("#doc-target table");
    if (!table) return;

    table.querySelectorAll("tr").forEach(row => {
      const cells = row.querySelectorAll("th, td");
      if (cells.length >= 3) {
        cells[1].style.display = "";
        cells[2].style.display = "";
      }
    });
  }

  function addScriptureControls() {
    const target = document.getElementById("doc-target");
    const table = target?.querySelector("table");
    if (!target || !table) return;

    removeScriptureControls();

    function applyMode(mode) {
      table.querySelectorAll("tr").forEach(row => {
        const cells = row.querySelectorAll("th, td");
        if (cells.length < 3) return;

        cells[1].style.display = "";
        cells[2].style.display = "";

        if (mode === "nkjv") cells[2].style.display = "none";
        if (mode === "nlt") cells[1].style.display = "none";
      });
    }

    const bar = document.createElement("div");
    bar.className = "scripture-controls";

    const makeBtn = (label, mode) => {
      const b = document.createElement("button");
      b.className = "sc-btn";
      b.textContent = label;
      b.onclick = () => applyMode(mode);
      return b;
    };

    bar.append(
      makeBtn("Both", "both"),
      makeBtn("NKJV Only", "nkjv"),
      makeBtn("NLT Only", "nlt")
    );

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
    const docName = safeDocName(docParam) || "titus-1-chapter-scripture.html";

    const meta = parseDocName(docName);
    setBodyDocMeta(meta);

    fetch(buildDocPath(docName), { cache: "no-store" })
      .then(r => r.text())
      .then(html => {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const root = parsed.querySelector("#doc-root");
        const target = document.getElementById("doc-target");
        if (!target) return;

        target.innerHTML = root ? root.innerHTML : parsed.body.innerHTML;

        if (meta.type === "chapter-scripture") {
          addScriptureControls();
        }
      });
  }

  loadCurrentDoc();
  window.addEventListener("popstate", loadCurrentDoc);

})();
