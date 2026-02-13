(function () {

  // =========================
  // MTB CONTENT MANIFEST
  // =========================
  const MTB_CONTENT = [
    { name: "3 John", slug: "3-john" },
    { name: "Obadiah", slug: "obadiah" },
    { name: "Titus", slug: "titus" }
  ];

  function el(id) {
    return document.getElementById(id);
  }
function buildBookUrl(bookSlug) {
  return "/book.html" +
    "?book=" + encodeURIComponent(bookSlug) +
    "&chapter=0" +
    "&tab=book_home";
}


  function populateBooks(select) {
    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select Book";
    select.appendChild(placeholder);

    MTB_CONTENT.forEach(book => {
      const opt = document.createElement("option");
      opt.value = book.slug;
      opt.textContent = book.name;
      select.appendChild(opt);
    });

    select.value = "";
  }

  // =========================
  // INIT
  // =========================
  document.addEventListener("DOMContentLoaded", function () {

    const bookSelect = el("bookSelect");
    const goBtn = el("goBtn");

    if (!bookSelect || !goBtn) return;

    populateBooks(bookSelect);

    goBtn.addEventListener("click", function () {
      if (!bookSelect.value) return;
      window.location.href = buildBookUrl(bookSelect.value);
    });

  });

})();
