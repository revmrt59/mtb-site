(function () {
  "use strict";

  // ==========================================
  // CONFIG (LOCKED TAB ORDER)
  // ==========================================
  const TABS = [
    { key: "chapter_scripture", label: "Chapter Scripture" },
    { key: "book_introduction", label: "Book Introduction" },
    { key: "chapter_orientation", label: "Chapter Orientation" },
    { key: "chapter_explanation", label: "Chapter Explanation" },
    { key: "chapter_insights", label: "Chapter Insights" },
    { key: "eg_culture", label: "EG Culture" },
    { key: "resources", label: "Resources" }
  ];

  // ==========================================
  // BOOK → TESTAMENT MAP (same as load-doc.js)
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
  // HELPERS
  // ==========================================
  function getParams() {
    const p = new URLSearchParams(window.location.search);
    return {
      book: (p.get("book") || "").trim(),
      chapter: (p.get("chapter") || "1").trim(),
      tab: (p.get("tab") || "chapter_scripture").trim(),
      doc: (p.get("doc") || "").trim()
    };
  }

  function setParams(next) {
    const p = new URLSearchParams(window.location.search);
    Object.keys(next).forEach(k => {
      if (next[k] === null || next[k] === undefined || next[k] === "") p.delete(k);
      else p.set(k, String(next[k]));
    });

    const url = `${window.location.pathname}?${p.toString()}`;
    history.pushState({}, "", url);

    // Tell load-doc.js to reload content
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function normalizeBookSlug(book) {
    return (book || "").toLowerCase().replace(/\s+/g, "-");
  }

  function tabToSuffix(tabKey) {
    const map = {
      chapter_scripture: "chapter-scripture",
      book_introduction: "book-introduction",
      chapter_orientation: "chapter-orientation",
      chapter_explanation: "chapter-explanation",
      chapter_insights: "chapter-insights",
      eg_culture: "eg-culture",
      resources: "resources"
    };
    return map[tabKey] || "chapter-scripture";
  }

  function docNameForTab(book, chapter, tabKey) {
    if (!book) return "titus-0-book-introduction.html";
    const b = normalizeBookSlug(book);

    if (tabKey === "book_introduction") return `${b}-0-book-introduction.html`;

    const suffix = tabToSuffix(tabKey);
    return `${b}-${chapter}-${suffix}.html`;
  }

  // (Not used directly here, but keeping because you had it and it’s helpful)
  function buildDocPath(docName) {
    const m = docName.match(/^([a-z0-9-]+)-/);
    const book = m ? m[1] : "";
    const testament = BOOK_TESTAMENT[book] || "new-testament";
    return `/books/${testament}/${book}/generated/${docName}`;
  }

  function prettyTitleFromSlug(slug) {
    if (!slug) return "";
    return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function setHeader(book, chapter) {
    const titleEl = document.getElementById("book-title");
    const subtitleEl = document.getElementById("book-subtitle");

    if (titleEl) titleEl.textContent = prettyTitleFromSlug(book);
    if (subtitleEl) subtitleEl.textContent = chapter ? `Chapter ${chapter}` : "";
  }

  // ==========================================
  // TABS
  // ==========================================
  function renderTabs() {
    const tabsEl = document.getElementById("tabs");
    if (!tabsEl) return;

    const params = getParams();
    const book = normalizeBookSlug(params.book);
    const chapter = params.chapter || "1";
    const activeTab = params.tab || "chapter_scripture";

    tabsEl.innerHTML = "";

    TABS.forEach(t => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab-btn";
      btn.dataset.tab = t.key;
      btn.textContent = t.label;

      if (t.key === activeTab) {
        btn.classList.add("active");
        btn.setAttribute("aria-current", "page");
      }

      btn.addEventListener("click", () => {
        // Let load-doc.js decide the doc from book/chapter/tab.
        // Clearing doc avoids stale doc values overriding tab intent.
        setParams({
          book: book,
          chapter: chapter,
          tab: t.key,
          doc: ""
        });
      });

      tabsEl.appendChild(btn);
    });
  }

  function syncActiveTab() {
    const params = getParams();
    const activeTab = params.tab || "chapter_scripture";
    const buttons = Array.from(document.querySelectorAll("#tabs .tab-btn"));

    buttons.forEach(b => {
      b.classList.remove("active");
      b.removeAttribute("aria-current");
    });

    const current = buttons.find(b => b.dataset.tab === activeTab);
    if (current) {
      current.classList.add("active");
      current.setAttribute("aria-current", "page");
    }
  }

  // ==========================================
  // INIT
  // ==========================================
  function init() {
    const params = getParams();

    if (params.book) {
      setHeader(params.book, params.chapter || "1");
    } else if (params.doc) {
      const m = params.doc.match(/^([a-z0-9-]+)-(\d+)-/i);
      if (m) setHeader(m[1], m[2]);
    }

    renderTabs();
  }

  init();

  window.addEventListener("popstate", () => {
    syncActiveTab();

    const params = getParams();
    if (params.book) {
      setHeader(params.book, params.chapter || "1");
    } else if (params.doc) {
      const m = params.doc.match(/^([a-z0-9-]+)-(\d+)-/i);
      if (m) setHeader(m[1], m[2]);
    }
  });

})();
