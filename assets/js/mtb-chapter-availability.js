(function () {
  "use strict";

  const BOOK_TESTAMENT = {
    genesis: "old-testament",
    exodus: "old-testament",
    leviticus: "old-testament",
    numbers: "old-testament",
    deuteronomy: "old-testament",
    joshua: "old-testament",
    judges: "old-testament",
    ruth: "old-testament",
    "1-samuel": "old-testament",
    "2-samuel": "old-testament",
    "1-kings": "old-testament",
    "2-kings": "old-testament",
    "1-chronicles": "old-testament",
    "2-chronicles": "old-testament",
    ezra: "old-testament",
    nehemiah: "old-testament",
    esther: "old-testament",
    job: "old-testament",
    psalms: "old-testament",
    proverbs: "old-testament",
    ecclesiastes: "old-testament",
    "song-of-solomon": "old-testament",
    isaiah: "old-testament",
    jeremiah: "old-testament",
    lamentations: "old-testament",
    ezekiel: "old-testament",
    daniel: "old-testament",
    hosea: "old-testament",
    joel: "old-testament",
    amos: "old-testament",
    obadiah: "old-testament",
    jonah: "old-testament",
    micah: "old-testament",
    nahum: "old-testament",
    habakkuk: "old-testament",
    zephaniah: "old-testament",
    haggai: "old-testament",
    zechariah: "old-testament",
    malachi: "old-testament",

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
    revelation: "new-testament"
  };

  function isBookHome() {
    const p = new URLSearchParams(window.location.search);
    return p.get("chapter") === "0" && p.get("tab") === "book_home";
  }

  function getCurrentBook() {
    const p = new URLSearchParams(window.location.search);
    return (p.get("book") || "").trim().toLowerCase();
  }

  function buildChapterUrl(book, chapter) {
    return "/book.html?book=" +
      encodeURIComponent(book) +
      "&chapter=" +
      encodeURIComponent(String(chapter)) +
      "&tab=chapter_scripture";
  }

  function getBookInfo(bookSlug) {
    const books = window.MTB_CONTENT || [];
    if (!Array.isArray(books)) return null;

    return books.find(function (book) {
      return book && book.slug === bookSlug;
    }) || null;
  }

  async function loadHtml(path) {
    if (!path) return null;

    try {
      const response = await fetch(path, {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) return null;
      return await response.text();
    } catch (error) {
      console.warn("MTB availability check failed:", path, error);
      return null;
    }
  }

  function getBookOverviewPath(book) {
    const testament = BOOK_TESTAMENT[book] || "new-testament";

    return "/books/" +
      testament +
      "/" +
      book +
      "/000-book/book-overview-" +
      book +
      ".html";
  }

  async function realBookOverviewExists(book) {
    const html = await loadHtml(getBookOverviewPath(book));
    if (!html) return false;

    return (
      /data-doc-type=["']book-overview["']/i.test(html) ||
      /mtb-doc--book-overview/i.test(html) ||
      /mtb-book-overview-dashboard/i.test(html)
    );
  }

  function findBookOverviewHeroButton() {
    const explicit = document.querySelector(
      "#book-overview-btn, " +
      "[data-book-overview], " +
      "[data-action='book-overview']"
    );

    if (explicit) return explicit;

    const candidates = Array.from(
      document.querySelectorAll("button, a")
    );

    return candidates.find(function (item) {
      if (item.closest("#tabs")) return false;

      const text = (item.textContent || "")
        .trim()
        .toLowerCase();

      return text === "book overview";
    }) || null;
  }

  async function updateBookOverviewButton() {
    if (!isBookHome()) return;

    const book = getCurrentBook();
    if (!book) return;

    const button = findBookOverviewHeroButton();
    if (!button) return;

    button.style.display = "none";
    button.setAttribute("aria-hidden", "true");

    const exists = await realBookOverviewExists(book);

    if (exists) {
      button.style.display = "";
      button.removeAttribute("aria-hidden");
    }
  }

  function renderCanonicalChapters() {
    if (!isBookHome()) return;

    const book = getCurrentBook();
    const wrap = document.getElementById("book-hero-chapters");

    if (!book || !wrap) return;

    const bookInfo = getBookInfo(book);
    const chapterCount = bookInfo
      ? parseInt(bookInfo.chapters, 10)
      : 0;

    if (
      wrap.dataset.mtbBook === book &&
      Number(wrap.dataset.mtbChapterCount || "0") === chapterCount &&
      wrap.querySelectorAll("button").length === chapterCount
    ) {
      return;
    }

    wrap.innerHTML = "";
    wrap.dataset.mtbBook = book;
    wrap.dataset.mtbChapterCount = String(chapterCount);

    if (!Number.isFinite(chapterCount) || chapterCount < 1) {
      const message = document.createElement("div");
      message.className = "book-hero-no-chapters";
      message.textContent = "Chapter information is not available.";
      wrap.appendChild(message);
      return;
    }

    for (let chapter = 1; chapter <= chapterCount; chapter++) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(chapter);

      button.setAttribute(
        "aria-label",
        "Open " + (bookInfo.name || book) + " chapter " + chapter
      );

      button.addEventListener("click", function () {
        window.location.href = buildChapterUrl(book, chapter);
      });

      wrap.appendChild(button);
    }
  }

  function renderBookHomeAvailability() {
    if (!isBookHome()) return;

    renderCanonicalChapters();
    updateBookOverviewButton();
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderBookHomeAvailability();

    const observer = new MutationObserver(function () {
      if (!isBookHome()) return;

      const button = findBookOverviewHeroButton();
      if (button) updateBookOverviewButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(function () {
      observer.disconnect();
    }, 3000);
  });

  window.addEventListener(
    "popstate",
    renderBookHomeAvailability
  );
})();
