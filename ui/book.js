/* Book page: Book Overview, Bible Context, Chapters, Resources, and any special tab. */
(function () {
  "use strict";
  var MTB = window.MTB, esc = MTB.esc;
  var SLUG = new URLSearchParams(location.search).get("book") || "";
  var head = document.getElementById("bk-head"), tabsEl = document.getElementById("bk-tabs"), panel = document.getElementById("bk-panel");

  function titleCase(s) { return s.replace(/-/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  MTB.library().then(function (lib) {
    var b = MTB.books(lib).filter(function (x) { return x.slug === SLUG; })[0];
    if (!b) { head.innerHTML = '<h1 id="ch-title">Book not found</h1>'; return; }
    var base = "books/" + b.testament.key + "/" + b.slug + "/000-book/";
    document.title = b.name + " · Mastering the Bible";

    var full = b.ready.filter(function (r) { return r.complete; }).length;
    head.innerHTML = '<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html#library">Library</a><span aria-hidden="true">›</span><span>' + esc(b.name) + "</span></nav>" +
      '<h1 id="ch-title">' + esc(b.name) + "</h1>" +
      '<p class="ch-main-idea">' + esc(b.group.name) + " · " + esc(b.testament.name) + " · " +
      (b.ready.length ? b.ready.length + " of " + b.chapters + (b.chapters === 1 ? " chapter" : " chapters") + " ready" : "chapters coming") + "</p>";

    var tabs = [
      { id: "overview", label: "Book Overview", path: b.overview ? base + "book-overview-" + b.slug + ".html" : "", missing: "The Book Overview for " + b.name + " is still being written." },
      { id: "context", label: "Bible Context", path: b.group.context + "index.html", missing: "Bible Context for this part of Scripture is still being written." }
    ];
    (b.special || []).forEach(function (s) { tabs.push({ id: "special-" + s, label: titleCase(s), path: base + "book-special-" + b.slug + "-" + s + ".html" }); });
    tabs.push({ id: "chapters", label: "Chapters" });
    if (b.resources) tabs.push({ id: "resources", label: "Resources", path: base + b.slug + "-0-book-resources.html" });

    tabsEl.innerHTML = tabs.map(function (t) {
      return '<button type="button" class="bk-tab" role="tab" id="tab-' + t.id + '" data-tab="' + t.id + '" aria-controls="bk-panel">' + esc(t.label) + "</button>";
    }).join("");

    function chapters() {
      var ready = {};
      b.ready.forEach(function (r) { ready[r.n] = r; });
      var html = '<div class="bk-chapters">';
      for (var n = 1; n <= b.chapters; n++) {
        var r = ready[n];
        html += r ? '<a class="chip" href="' + MTB.chapterUrl(b.slug, n) + '">' + n + "</a>" : '<span class="chip off">' + n + "</span>";
      }
      return html + "</div>";
    }

    /* Bible Context: lead with the portion's name and its books instead of "Understanding This Portion". */
    function tidyContext(box) {
      var title = box.querySelector("[class*='canon-title']"), name = title ? title.textContent.trim() : b.group.name;
      Array.prototype.forEach.call(box.querySelectorAll("[class*='-hero'], [class*='section-heading']"), function (n) { n.remove(); });
      var books = b.group.books.map(function (x) {
        return x.ready.length && x.slug !== b.slug ? '<a href="' + MTB.bookUrl(x.slug) + '#context">' + esc(x.name) + "</a>" : (x.slug === b.slug ? "<strong>" + esc(x.name) + "</strong>" : esc(x.name));
      }).join(" · ");
      var intro = document.createElement("div");
      intro.className = "ctx-intro";
      intro.innerHTML = '<h2>' + esc(name) + '</h2><p class="ctx-books">' + books + "</p>";
      box.insertBefore(intro, box.firstChild);
    }

    function show(id) {
      var t = tabs.filter(function (x) { return x.id === id; })[0] || tabs[0];
      Array.prototype.forEach.call(tabsEl.querySelectorAll(".bk-tab"), function (el) { el.setAttribute("aria-selected", String(el.dataset.tab === t.id)); });
      panel.setAttribute("aria-labelledby", "tab-" + t.id);
      if (history.replaceState) history.replaceState(null, "", "#" + t.id);
      if (t.id === "chapters") { panel.innerHTML = chapters(); return; }
      if (!t.path) { panel.innerHTML = '<p class="bk-missing">' + esc(t.missing) + "</p>"; return; }
      panel.innerHTML = '<p class="lede">Loading…</p>';
      MTB.loadDoc(t.path).then(function (box) {
        if (!box) { panel.innerHTML = '<p class="bk-missing">' + esc(t.missing || "This page isn’t available yet.") + "</p>"; return; }
        box.className = "doc hide-h1";
        if (t.id === "context") tidyContext(box);
        panel.innerHTML = "";
        panel.appendChild(box);
      });
    }

    tabsEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".bk-tab");
      if (btn) show(btn.dataset.tab);
    });
    window.addEventListener("hashchange", function () { var h = location.hash.replace("#", ""); if (h) show(h); });
    var start = location.hash.replace("#", "");
    if (!start) start = b.overview ? "overview" : "chapters";
    show(start);
  });
})();
