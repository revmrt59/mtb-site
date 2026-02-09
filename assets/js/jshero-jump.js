(function () {

  // =========================
  // MTB CONTENT MANIFEST
  // =========================
  const MTB_CONTENT = [
    // { name: "Titus", slug: "titus", chapters: [1, 2, 3] },
    { name: "3 John", slug: "3-john", chapters: [1] },
    { name: "Obadiah", slug: "obadiah", chapters: [1] },
    { name: "Romans", slug: "romans", chapters: [1] }
  ];

  function el(id) {
    return document.getElementById(id);
  }

  // Always land on Chapter Scripture
  function buildUrl(bookSlug, chapter) {
    return "/book.html" +
      "?book=" + encodeURIComponent(bookSlug) +
      "&chapter=" + encodeURIComponent(String(chapter)) +
      "&tab=chapter_scripture";
  }

  function populateBooks(select) {
    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select Book";
    select.appendChild(placeholder);

    MTB_CONTENT.forEach(book => {
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

      const chapter = chapterSelect.value
        ? Number(chapterSelect.value)
        : book.chapters[0];

      window.location.href = buildUrl(book.slug, chapter);
    });
  });

})();
