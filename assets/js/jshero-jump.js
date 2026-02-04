(function () {

  // =========================
  // MTB CONTENT MANIFEST (EDIT THIS AS YOU ADD MATERIAL)
  // =========================
  // Only list books/chapters you actually have in /generated/
  // Book intro is always chapter 0 doc: <slug>-0-book-introduction.html
  const MTB_CONTENT = [
    {
      name: "Titus",
      slug: "titus",
      chapters: [1, 2, 3]
    }
  ];

  // Hero navigation always lands on Chapter Orientation
 const CONTENT_TYPE = "chapter-scripture";

  function el(id) {
    return document.getElementById(id);
  }

  // =========================
  // LOCKED FILENAME BUILDER
  // =========================
  function buildDocName(bookSlug, chapter) {
    return bookSlug + "-" + chapter + "-" + CONTENT_TYPE + ".html";
  }

  function buildUrl(bookSlug, chapter) {
    const doc = buildDocName(bookSlug, chapter);
    return "/book.html?doc=" + encodeURIComponent(doc);
  }

  function populateBooks(select) {
    select.innerHTML = "";

    // Default option
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select Book";
    select.appendChild(placeholder);

    MTB_CONTENT.forEach(book => {
      // Only show book if it has at least one chapter listed
      if (!book.chapters || book.chapters.length === 0) return;

      const opt = document.createElement("option");
      opt.value = book.slug;
      opt.textContent = book.name;
      select.appendChild(opt);
    });

    select.value = "";
  }

  function resetChapters(select) {
    select.innerHTML = "";
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "";
    select.appendChild(blank);
    select.value = "";
    select.disabled = true;
  }

  function populateChapters(select, chapterNums) {
    resetChapters(select);

    if (!chapterNums || chapterNums.length === 0) return;

    chapterNums.forEach(n => {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      select.appendChild(opt);
    });

    // Keep it blank per your requirement; enable dropdown
    select.value = "";
    select.disabled = false;
  }

  function selectedBook(bookSelect) {
    return MTB_CONTENT.find(b => b.slug === bookSelect.value) || null;
  }

  // =========================
  // INIT
  // =========================
  document.addEventListener("DOMContentLoaded", function () {

    const bookSelect = el("bookSelect");
    const chapterSelect = el("chapterSelect");
    const goBtn = el("goBtn");

    // Fail silently if controls are absent
    if (!bookSelect || !chapterSelect || !goBtn) return;

    populateBooks(bookSelect);
    resetChapters(chapterSelect);

    bookSelect.addEventListener("change", function () {
      const book = selectedBook(bookSelect);
      if (!book) {
        resetChapters(chapterSelect);
        return;
      }
      populateChapters(chapterSelect, book.chapters);
    });

    goBtn.addEventListener("click", function () {
      const book = selectedBook(bookSelect);
      if (!book) return;

      // If chapter blank, default to first available chapter
      const chapter = chapterSelect.value
        ? Number(chapterSelect.value)
        : (book.chapters && book.chapters.length ? book.chapters[0] : null);

      if (!chapter) return;

      window.location.href = buildUrl(book.slug, chapter);
    });

    chapterSelect.addEventListener("keydown", function (e) {
      if (e.key === "Enter") goBtn.click();
    });
  });

})();
