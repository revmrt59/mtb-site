/* Home page: the Library, built from data/library.json */
(function () {
  "use strict";
  var MTB = window.MTB, esc = MTB.esc;
  var panel = document.getElementById("lib-panel");
  var summary = document.getElementById("lib-summary");
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var current = "old-testament";

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  function render(lib) {
    var t = lib.testaments.filter(function (x) { return x.key === current; })[0];
    var html = "", later = 0;
    t.groups.forEach(function (g) {
      var books = g.books.filter(function (b) { return b.ready.length; });
      later += g.books.length - books.length;
      if (!books.length) return;
      html += '<div class="lib-group"><div class="lib-group-head"><h3>' + esc(g.name) + "</h3>" +
        '<a href="doc.html?p=' + encodeURIComponent(g.context + "index.html") + '">Bible Context: ' + esc(g.name) + " →</a></div>" +
        '<div class="book-grid">' + books.map(card).join("") + "</div></div>";
    });
    if (!html) html = '<p class="lede">Studies for these books are coming.</p>';
    if (later) html += '<p class="lib-more">' + plural(later, "more book", "more books") + ' in the ' + esc(t.name) + ' coming later. <button type="button" data-open-picker>See all 66 books</button></p>';
    panel.innerHTML = html;
  }

  function card(b) {
    var full = b.ready.filter(function (r) { return r.complete; }).length;
    var note = plural(b.ready.length, "chapter", "chapters") + " ready";
    if (full) note += " · " + full + " with all layers";
    var link = b.overview
      ? '<a class="bc-link" href="' + MTB.bookUrl(b.slug) + '">Book Overview</a>'
      : '<span class="bc-link bc-missing">Book Overview coming</span>';
    return '<article class="book-card">' +
      '<div class="bc-top"><h4>' + esc(b.name) + "</h4>" + link + "</div>" +
      '<div class="bc-note">' + note + "</div>" +
      '<div class="chips">' + b.ready.map(function (r) {
        return '<a class="chip' + (r.complete ? " full" : "") + '" href="' + MTB.chapterUrl(b.slug, r.n) + '" aria-label="' +
          esc(b.name) + " " + r.n + (r.complete ? ", all layers" : ", study ready") + '">' + r.n + "</a>";
      }).join("") + "</div></article>";
  }

  MTB.library().then(function (lib) {
    var books = MTB.books(lib).filter(function (b) { return b.ready.length; });
    var chapters = books.reduce(function (n, b) { return n + b.ready.length; }, 0);
    summary.textContent = plural(chapters, "chapter", "chapters") + " ready in " + plural(books.length, "book", "books") + ", in Bible order. More are added regularly.";
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        current = tab.getAttribute("data-t");
        tabs.forEach(function (x) { x.setAttribute("aria-selected", String(x === tab)); });
        panel.setAttribute("aria-labelledby", tab.id);
        render(lib);
      });
    });
    render(lib);
  }).catch(function () {
    summary.textContent = "The library could not be loaded. Please refresh the page.";
  });
})();
