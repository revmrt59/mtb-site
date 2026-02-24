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
    "titus-disabled": "new-testament",
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

  function parseBookChapterFromDoc(doc) {
    const d = String(doc || "");
    const m = d.match(/^([a-z0-9-]+)-(\d+)-/i);
    if (!m) return { book: "", chapter: "" };
    return { book: m[1].toLowerCase(), chapter: m[2] };
  }

  // This is the critical robustness change:
  // If book/chapter are missing (often after deep resource topic navigation),
  // fall back to inferring them from doc=... (e.g., titus-1-resources-xyz.html).
  function getEffectiveBookChapter() {
    const params = getParams();
    const book = normalizeBookSlug(params.book);
    const chapter = (params.chapter || "1").trim();

    if (book) return { book, chapter };

    if (params.doc) {
      const inferred = parseBookChapterFromDoc(params.doc);
      if (inferred.book) return { book: inferred.book, chapter: inferred.chapter || "1" };
    }

    // Final fallback: try body data attributes (set by load-doc.js)
    const bodyBook = (document.body.dataset.book || "").trim();
    const bodyChapter = (document.body.dataset.chapter || "").trim();
    if (bodyBook) return { book: normalizeBookSlug(bodyBook), chapter: bodyChapter || "1" };

    return { book: "", chapter: "1" };
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
    return `/books/${testament}/${book}/${docName}`;
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
    const activeTab = params.tab || "chapter_scripture";
    document.body.setAttribute("data-active-tab", activeTab);

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
        // Always compute effective book/chapter at click time (do NOT rely on captured values).
        const eff = getEffectiveBookChapter();

        // Clearing doc avoids stale resource-topic doc values overriding tab intent.
        setParams({
          book: eff.book,
          chapter: eff.chapter,
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
    document.body.setAttribute("data-active-tab", activeTab);
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
    // If book/doc changes, rerender so click handlers always use current context
    renderTabs();
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



// --------------------------------------------------
// MTB patch: hide Book Introduction tab on chapter pages (chapter >= 1)
// Keeps book-level hero modal buttons intact.
// --------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
  try {
    const params = new URLSearchParams(window.location.search);
    const chapterNum = parseInt(params.get("chapter") || "0", 10);
    if (chapterNum >= 1) {
      // Try common selectors used across MTB tab renderers
      const candidates = [
        '#tabs [data-tab="book_introduction"]',
        '#tabs [data-tab="book_intro"]',
        '#tabs [data-tab="book_introduction"]',
        '[data-tab="book_introduction"]',
        '[data-tab="book_intro"]'
      ];
      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el) { el.remove(); break; }
      }
      // Also remove by visible text if needed
      document.querySelectorAll("#tabs button, #tabs a").forEach((btn) => {
        const t = (btn.textContent || "").trim().toLowerCase();
        if (t === "book introduction" || t === "book intro") {
          btn.remove();
        }
      });
    }
  } catch (_) {}
});
// =========================================================
// MTB: Always hide "Book Introduction" tab on chapter pages
// Works even when tabs re-render dynamically.
// =========================================================
(function () {
  function chapterNumFromUrl() {
    try {
      const p = new URLSearchParams(window.location.search);
      return parseInt(p.get("chapter") || "0", 10);
    } catch {
      return 0;
    }
  }

  function removeBookIntroTabIfNeeded() {
    const ch = chapterNumFromUrl();
    if (ch < 1) return; // only hide on chapter pages

    // Remove by data-tab if present
    const selectors = [
      '#tabs [data-tab="book_introduction"]',
      '#tabs [data-tab="book_intro"]',
      '[data-tab="book_introduction"]',
      '[data-tab="book_intro"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) el.remove();
    }

    // Fallback: remove by visible text
    document.querySelectorAll("#tabs button, #tabs a").forEach((btn) => {
      const t = (btn.textContent || "").trim().toLowerCase();
      if (t === "book introduction" || t === "book intro") {
        btn.remove();
      }
    });
  }

  function startWatchingTabs() {
    // Run once now
    removeBookIntroTabIfNeeded();

    const tabs = document.getElementById("tabs");
    if (!tabs) return;

    // Watch for re-renders
    const obs = new MutationObserver(() => {
      removeBookIntroTabIfNeeded();
    });
    obs.observe(tabs, { childList: true, subtree: true });
  }

  document.addEventListener("DOMContentLoaded", startWatchingTabs);

  // In case your app changes URL via history without reload
  window.addEventListener("popstate", removeBookIntroTabIfNeeded);
})();
// =========================================================
// Chapter Prev/Next buttons (wrap across books)
// - Prev on chapter 1 => last chapter of previous book
// - Next on last chapter => chapter 1 of next book
// Requires window.MTB_CONTENT (loaded via jshero-jump.js)
// =========================================================
(function () {
  function getParams() {
    const p = new URLSearchParams(window.location.search);
    return {
      book: p.get("book") || "",
      chapter: parseInt(p.get("chapter") || "0", 10),
      tab: p.get("tab") || "chapter_scripture"
    };
  }

  function buildUrl(bookSlug, chapterNum) {
    const u = new URL(window.location.href);
    u.searchParams.set("book", bookSlug);
    u.searchParams.set("chapter", String(chapterNum));

    let tab = u.searchParams.get("tab") || "chapter_scripture";
    if (tab === "book_home") tab = "chapter_scripture";
    u.searchParams.set("tab", tab);

    // close any modal state
    u.searchParams.delete("modal");

    return u.pathname + "?" + u.searchParams.toString();
  }
function prettyBook(slug) {
  if (!slug) return "";
  return slug
    .split("-")
    .map(w => w ? (w[0].toUpperCase() + w.slice(1)) : w)
    .join(" ");
}

  function computePrevNext(bookSlug, chapterNum) {
    const list = window.MTB_CONTENT || [];
    const idx = list.findIndex(b => b.slug === bookSlug);
    if (idx < 0) return null;

    const currentChCount = parseInt(list[idx].chapters || 1, 10);

    // prev
    let prevBook = bookSlug;
    let prevCh = chapterNum - 1;
    if (chapterNum <= 1) {
      const pidx = (idx - 1 + list.length) % list.length;
      prevBook = list[pidx].slug;
      prevCh = parseInt(list[pidx].chapters || 1, 10);
    }

    // next
    let nextBook = bookSlug;
    let nextCh = chapterNum + 1;
    if (chapterNum >= currentChCount) {
      const nidx = (idx + 1) % list.length;
      nextBook = list[nidx].slug;
      nextCh = 1;
    }

    return { prev: { book: prevBook, ch: prevCh }, next: { book: nextBook, ch: nextCh } };
  }

  function disableChapterNav(navEl) {
    if (!navEl) return;
    navEl.classList.add("is-loading");
    navEl.querySelectorAll("button").forEach(b => { b.disabled = true; });
  }

  function ensureChapterNav() {
    const { book, chapter } = getParams();

    // Only show on real chapter pages
    if (!book || !Number.isFinite(chapter) || chapter < 1) return;

    const tabs = document.getElementById("tabs");
    if (!tabs) return;

    // already present
    if (tabs.querySelector(".chapter-nav")) return;

    // Must have MTB_CONTENT for cross-book wrap
    if (!window.MTB_CONTENT || !Array.isArray(window.MTB_CONTENT) || window.MTB_CONTENT.length === 0) return;

    const plan = computePrevNext(book, chapter);
    if (!plan) return;

    const nav = document.createElement("div");
    nav.className = "chapter-nav";
    nav.innerHTML = `
      <button type="button" class="chapter-nav-btn" id="chapter-prev" aria-label="Previous chapter">
        <span aria-hidden="true">◀</span>
      </button>
      <button type="button" class="chapter-nav-btn" id="chapter-next" aria-label="Next chapter">
        <span aria-hidden="true">▶</span>
      </button>
    `;

    tabs.appendChild(nav);
// Hover tooltips (show destination)
const prevBtn = nav.querySelector("#chapter-prev");
const nextBtn = nav.querySelector("#chapter-next");

if (prevBtn) {
  prevBtn.title = `${prettyBook(plan.prev.book)} ${plan.prev.ch}`;
  prevBtn.setAttribute("aria-label", `Previous: ${prettyBook(plan.prev.book)} chapter ${plan.prev.ch}`);
}

if (nextBtn) {
  nextBtn.title = `${prettyBook(plan.next.book)} ${plan.next.ch}`;
  nextBtn.setAttribute("aria-label", `Next: ${prettyBook(plan.next.book)} chapter ${plan.next.ch}`);
}

    nav.querySelector("#chapter-prev").addEventListener("click", function () {
      disableChapterNav(nav);
      window.location.href = buildUrl(plan.prev.book, plan.prev.ch);
    });

    nav.querySelector("#chapter-next").addEventListener("click", function () {
      disableChapterNav(nav);
      window.location.href = buildUrl(plan.next.book, plan.next.ch);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    ensureChapterNav();

    // If tabs are re-rendered dynamically, re-attach
    const tabs = document.getElementById("tabs");
    if (tabs) {
      const obs = new MutationObserver(() => ensureChapterNav());
      obs.observe(tabs, { childList: true, subtree: true });
    }

    window.addEventListener("popstate", ensureChapterNav);
  });
})();
