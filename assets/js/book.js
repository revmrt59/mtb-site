(function () {
  // ==========================================
  // CONFIG (LOCKED TAB ORDER)
  // ==========================================
  const TABS = [
    { key: "chapter_scripture", label: "Chapter Scripture" },
    { key: "book_introduction", label: "Book Introduction" },
    { key: "chapter_orientation", label: "Chapter Orientation" },
    { key: "chapter_explanation", label: "Chapter Explanation" },
    { key: "chapter_insights", label: "Chapter Insights" },
    { key: "key_words_and_concepts", label: "Word Studies" },
    { key: "eg_culture", label: "EG Culture" },
    { key: "deeper_dive", label: "Deeper Dive" } // single button only
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
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

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
      key_words_and_concepts: "key-words-and-concepts",
      eg_culture: "eg-culture",
      deeper_dive: "deeper-dive"
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

  function buildDocPath(docName) {
    const m = docName.match(/^([a-z0-9-]+)-/);
    const book = m ? m[1] : "";
    const testament = BOOK_TESTAMENT[book] || "new-testament";
    return `/books/${testament}/${book}/generated/${docName}`;
  }

  function prettyTitleFromSlug(slug) {
    if (!slug) return "";
    return slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function setHeader(book, chapter) {
    const titleEl = document.getElementById("book-title");
    const subtitleEl = document.getElementById("book-subtitle");

    if (titleEl) titleEl.textContent = prettyTitleFromSlug(book);
    if (subtitleEl) subtitleEl.textContent = chapter ? `Chapter ${chapter}` : "";
  }

  // ==========================================
  // DEEPER DIVE DROPDOWN (single button)
  // ==========================================
  let deeperDiveLoadedFor = ""; // cache key: book|chapter
  let deeperDiveLinksCache = []; // [{href, text}]

  function ensureDeeperDiveMenuContainer() {
    let shell = $(".tabs-shell");
    if (!shell) return null;

    let menu = $("#deeper-dive-menu", shell);
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "deeper-dive-menu";
      menu.className = "deeper-dive-menu";
      menu.style.display = "none";
      shell.appendChild(menu);
    }
    return menu;
  }

  function hideDeeperDiveMenu() {
    const menu = ensureDeeperDiveMenuContainer();
    if (menu) menu.style.display = "none";
  }

  function toggleDeeperDiveMenu() {
    const menu = ensureDeeperDiveMenuContainer();
    if (!menu) return;

    const params = getParams();
    const book = normalizeBookSlug(params.book);
    const chapter = params.chapter || "1";
    if (!book) return;

    const key = `${book}|${chapter}`;

    // If opening and not loaded, load first
    const isHidden = (menu.style.display === "none" || menu.style.display === "");
    if (isHidden) {
      if (deeperDiveLoadedFor !== key) {
        menu.innerHTML = "<div class=\"muted\">Loading Deeper Dive topics...</div>";
        loadDeeperDiveIndex(book, chapter)
          .then(links => {
            deeperDiveLoadedFor = key;
            deeperDiveLinksCache = links;
            renderDeeperDiveMenu(menu, book, chapter, links);
            menu.style.display = "block";
          })
          .catch(() => {
            menu.innerHTML = "<div class=\"muted\">No Deeper Dive topics found for this chapter.</div>";
            menu.style.display = "block";
          });
      } else {
        renderDeeperDiveMenu(menu, book, chapter, deeperDiveLinksCache);
        menu.style.display = "block";
      }
    } else {
      menu.style.display = "none";
    }
  }

  function loadDeeperDiveIndex(book, chapter) {
    // Index doc is the source of truth:
    // <book>-<chapter>-deeper-dive.html
    const docName = `${book}-${chapter}-deeper-dive.html`;
    const path = buildDocPath(docName);

    return fetch(path, { cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error("No deeper dive index");
        return r.text();
      })
      .then(html => {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const root = parsed.querySelector("#doc-root") || parsed.body;

        // Capture only deeper-dive topic links for this chapter
        const anchors = Array.from(root.querySelectorAll("a[href]"));

        const links = anchors
          .map(a => {
            const hrefRaw = (a.getAttribute("href") || "").trim();
            const textRaw = (a.textContent || "").trim();

            // We expect topic files like:
            // <book>-<chapter>-deeper-dive-<topic>.html
            const rx = new RegExp(`^${book}-${chapter}-deeper-dive-[a-z0-9-]+\\.html$`, "i");

            // Accept either direct filename or relative with path segments
            const hrefFile = hrefRaw.split("/").pop();

            if (!rx.test(hrefFile)) return null;

            return {
              href: hrefFile,
              text: textRaw || hrefFile.replace(/\.html$/i, "").replace(/-/g, " ")
            };
          })
          .filter(Boolean);

        // If index exists but no links, treat as empty
        return links;
      });
  }

  function renderDeeperDiveMenu(menu, book, chapter, links) {
    // Always include the index as the first item
    // Clicking "Deeper Dive Overview" loads the index page
    const items = [];

    items.push({
      href: `${book}-${chapter}-deeper-dive.html`,
      text: "Deeper Dive Overview"
    });

    links.forEach(l => items.push(l));

    // De-duplicate by href
    const seen = new Set();
    const unique = items.filter(it => {
      if (seen.has(it.href)) return false;
      seen.add(it.href);
      return true;
    });

    if (!unique.length) {
      menu.innerHTML = "<div class=\"muted\">No Deeper Dive topics found for this chapter.</div>";
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "deeper-dive-list";

    unique.forEach(it => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#";
      a.textContent = it.text;

      a.addEventListener("click", (e) => {
        e.preventDefault();

        // Load by doc param so it can load a topic file directly
        setParams({
          doc: it.href,
          // keep book/chapter for consistent header + future use
          book: book,
          chapter: chapter,
          tab: "deeper_dive"
        });

        // Auto-close after selection
        hideDeeperDiveMenu();
      });

      li.appendChild(a);
      ul.appendChild(li);
    });

    menu.innerHTML = "";
    menu.appendChild(ul);
  }

  // Close the dropdown if you click elsewhere
  function wireGlobalClose() {
    document.addEventListener("click", (e) => {
      const menu = $("#deeper-dive-menu");
      if (!menu) return;

      const tabs = $("#tabs");
      const deepBtn = $("#tabs [data-tab=\"deeper_dive\"]");

      const clickedInsideMenu = menu.contains(e.target);
      const clickedDeepBtn = deepBtn && deepBtn.contains(e.target);
      const clickedTabs = tabs && tabs.contains(e.target);

      if (clickedInsideMenu || clickedDeepBtn) return;

      // If click is outside tabs/menu, close it
      if (!clickedTabs) hideDeeperDiveMenu();
    });
  }

  // ==========================================
  // TABS RENDERING
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

      if (t.key === activeTab) btn.classList.add("active");

      btn.addEventListener("click", () => {
        // Single Deeper Dive button behavior
        if (t.key === "deeper_dive") {
          // Also set the tab active in the URL, but do not force-load content
          // unless user picks "Deeper Dive Overview" or a topic.
          setParams({
            book: book,
            chapter: chapter,
            tab: "deeper_dive",
            doc: "" // clear doc so the tab state is clean
          });
          toggleDeeperDiveMenu();
          return;
        }

        // Any other tab closes dropdown
        hideDeeperDiveMenu();

        // Load via tab params (let load-doc.js build docName)
        setParams({
          book: book,
          chapter: chapter,
          tab: t.key,
          doc: "" // clear doc to avoid conflicts
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
      if (b.dataset.tab === activeTab) b.classList.add("active");
      else b.classList.remove("is-active");
    });
  }

  // ==========================================
  // INIT
  // ==========================================
  function init() {
    const params = getParams();

    // Prefer explicit book/chapter if present; otherwise allow doc-only loads
    if (params.book) {
      setHeader(params.book, params.chapter || "1");
    } else if (params.doc) {
      // Best effort header from doc name
      const m = params.doc.match(/^([a-z0-9-]+)-(\d+)-/i);
      if (m) setHeader(m[1], m[2]);
    }

    renderTabs();
    wireGlobalClose();
  }

  init();

  // Re-sync tabs when URL changes via back/forward or internal pushState
  window.addEventListener("popstate", () => {
    syncActiveTab();

    const params = getParams();
    if (params.book) {
      setHeader(params.book, params.chapter || "1");
    } else if (params.doc) {
      const m = params.doc.match(/^([a-z0-9-]+)-(\d+)-/i);
      if (m) setHeader(m[1], m[2]);
    }

    // If user navigates away from deeper dive, close the menu
    if ((params.tab || "") !== "deeper_dive") hideDeeperDiveMenu();
  });

})();
