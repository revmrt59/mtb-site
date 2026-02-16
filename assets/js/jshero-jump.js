(function () {

  // =========================
  // MTB CONTENT MANIFEST
  // =========================

  const MTB_CONTENT = [
  { name: "3 John", slug: "3-john", chapters: 1 },
  { name: "Obadiah", slug: "obadiah", chapters: 1 },
  { name: "Second Timothy", slug: "2-timothy", chapters: 4 },
   { name: "Titus", slug: "titus", chapters: 3 }
];

// Make available to book.html too (so you don’t maintain two lists)
window.MTB_CONTENT = MTB_CONTENT;


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
  if (!bookSelect) return;

  populateBooks(bookSelect);

  // Navigate immediately when a book is selected
  bookSelect.addEventListener("change", function () {
    if (!bookSelect.value) return;
    window.location.href = buildBookUrl(bookSelect.value);
  });

});


})();
