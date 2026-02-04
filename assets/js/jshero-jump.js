(function () {

  // =========================
  // LOCKED MTB CONFIGURATION
  // =========================

  // Hero navigation always lands on Chapter Orientation
  const CONTENT_TYPE = "chapter-orientation";

  const BOOKS = [
    { name: "Genesis", slug: "genesis", chapters: 50 },
    { name: "Exodus", slug: "exodus", chapters: 40 },
    { name: "Leviticus", slug: "leviticus", chapters: 27 },
    { name: "Numbers", slug: "numbers", chapters: 36 },
    { name: "Deuteronomy", slug: "deuteronomy", chapters: 34 },
    { name: "Titus", slug: "titus", chapters: 3 }
  ];

  function el(id) {
    return document.getElementById(id);
  }

  // =========================
  // LOCKED FILENAME BUILDER
  // =========================
  function buildDocName(bookSlug, chapter) {
    return (
      bookSlug +
      "-" +
      chapter +
      "-" +
      CONTENT_TYPE +
      ".html"
    );
  }

  function buildUrl(bookSlug, chapter) {
    const doc = buildDocName(bookSlug, chapter);
    return "/book.html?doc=" + encodeURIComponent(doc);
  }

  function populateBooks(select) {
    select.innerHTML = "";
    BOOKS.forEach(book => {
      const opt = document.createElement("option");
      opt.value = book.slug;
      opt.textContent = book.name;
      select.appendChild(opt);
    });
  }

  function populateChapters(select, count) {
    select.innerHTML = "";
    for (let i = 1; i <= count; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = i;
      select.appendChild(opt);
    }
  }

  function selectedBook(select) {
    return BOOKS.find(b => b.slug === select.value) || BOOKS[0];
  }

  // =========================
  // INIT
  // =========================
  document.addEventListener("DOMContentLoaded", function () {

    const bookSelect = el("bookSelect");
    const chapterSelect = el("chapterSelect");
    const goBtn = el("goBtn");

    // Hero script should fail silently if controls are absent
    if (!bookSelect || !chapterSelect || !goBtn) return;

    populateBooks(bookSelect);
    populateChapters(chapterSelect, BOOKS[0].chapters);

    bookSelect.addEventListener("change", function () {
      populateChapters(
        chapterSelect,
        selectedBook(bookSelect).chapters
      );
    });

    goBtn.addEventListener("click", function () {
      const book = selectedBook(bookSelect);
      const chapter = chapterSelect.value || 1;
      window.location.href = buildUrl(book.slug, chapter);
    });

    chapterSelect.addEventListener("keydown", function (e) {
      if (e.key === "Enter") goBtn.click();
    });
  });

})();
