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

  function parseDocName(docName) {
    const intro = docName.match(/^([a-z0-9-]+)-0-book-introduction\.html$/);
    if (intro) {
      return { book: intro[1], chapter: 0, type: "book-introduction" };
    }

    const chap = docName.match(/^([a-z0-9-]+)-(\d+)-chapter-(orientation|teaching|scripture)\.html$/);
    if (chap) {
      return { book: chap[1], chapter: Number(chap[2]), type: "chapter-" + chap[3] };
    }

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

  function markTeachingScriptureBlocks(targetEl) {
    const h5s = Array.from(targetEl.querySelectorAll("h5"));
    const headingSelector = "h1,h2,h3,h4,h5";

    h5s.forEach(h5 => {
      h5.classList.add("mtb-scripture");
      let node = h5.nextElementSibling;
      while (node && !node.matches(headingSelector)) {
        node.classList.add("mtb-scripture");
        node = node.nextElementSibling;
      }
    });
  }

  const params = new URLSearchParams(window.location.search);
  const docName = params.get("doc") || "titus-0-book-introduction.html";
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
      target.innerHTML = content;

      if (meta.type === "chapter-teaching") {
        markTeachingScriptureBlocks(target);
      }
    })
    .catch(err => {
      document.getElementById("doc-target").innerHTML =
        `<p>Content failed to load.</p><pre>${err.message}</pre>`;
    });

})();
