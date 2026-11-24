/* Book page: Book Overview, Bible Context, Chapters, Key Questions, Resources, and any special tab. */
(function () {
  "use strict";
  var MTB = window.MTB, esc = MTB.esc;
  var SLUG = new URLSearchParams(location.search).get("book") || "";
  var head = document.getElementById("bk-head"), tabsEl = document.getElementById("bk-tabs"), panel = document.getElementById("bk-panel");

  function titleCase(s) { return s.replace(/-/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }


  /* Key Questions: keep Scripture links on the site. A chapter that is on the site opens at
     the verse; any other passage opens in a small NKJV popup instead of an outside website. */
  var NKJV = {};
  function nkjvBook(slug) {
    var file = slug === "song-of-solomon" ? "song-of-songs" : slug;
    if (!NKJV[file]) NKJV[file] = fetch(MTB.root + "assets/js/bibles-json/nkjv/" + file + ".json").then(function (r) {
      if (!r.ok) throw new Error("text"); return r.json();
    }).then(function (j) { return j.chapters || {}; });
    return NKJV[file];
  }
  function parseRef(text) {
    var m = /^(.+?)\s+(\d+)(?::(\d+))?(?:\s*[–—-]\s*(\d+)(?::(\d+))?)?\s*$/.exec(text.trim());
    if (!m) return null;
    var r = { name: m[1], c: +m[2], v: m[3] ? +m[3] : 0, c2: +m[2], v2: m[3] ? +m[3] : 0 };
    if (m[5]) { r.c2 = +m[4]; r.v2 = +m[5]; } else if (m[4]) { if (m[3]) r.v2 = +m[4]; else { r.c2 = +m[4]; } }
    return r;
  }
  function linkScripture(box, lib) {
    var byName = {};
    MTB.books(lib).forEach(function (x) { byName[x.name.toLowerCase()] = x; byName[x.slug.replace(/-/g, " ")] = x; });
    byName["psalm"] = byName["psalms"]; byName["song of songs"] = byName["song of songs"] || byName["song of solomon"];
    Array.prototype.forEach.call(box.querySelectorAll('a[href^="http"]'), function (a) {
      var href = a.getAttribute("href") || "";
      if (!/mtb\.bible|masteringthebible|biblegateway\.com|biblehub\.com/i.test(href)) return;
      var r = parseRef(a.textContent), bk = r && byName[r.name.toLowerCase()];
      if (!bk) return;
      a.removeAttribute("target"); a.removeAttribute("rel");
      var onSite = bk.ready.some(function (x) { return x.n === r.c; });
      if (onSite) { a.href = MTB.chapterUrl(bk.slug, r.c) + (r.v ? "#v" + r.v : ""); return; }
      a.href = "#"; a.className = (a.className + " kq-ref").trim();
      a.dataset.slug = bk.slug; a.dataset.ref = JSON.stringify(r);
    });
    box.addEventListener("click", function (e) {
      var a = e.target.closest("a.kq-ref");
      if (!a) return;
      e.preventDefault(); e.stopPropagation();
      var r = JSON.parse(a.dataset.ref);
      showPassage(a.textContent, a.dataset.slug, r);
    });
  }
  function showPassage(label, slug, r) {
    var ov = document.createElement("div");
    ov.className = "kq-pop-overlay";
    ov.innerHTML = '<div class="kq-pop" role="dialog" aria-modal="true" aria-label="' + esc(label) + '"><button type="button" class="kq-pop-close" aria-label="Close">×</button><h3>' + esc(label) + ' <span>NKJV</span></h3><div class="kq-pop-body">Loading…</div><p class="kq-pop-copy">Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved.</p></div>';
    function close() { ov.remove(); document.removeEventListener("keydown", key); }
    function key(e) { if (e.key === "Escape") close(); }
    ov.addEventListener("click", function (e) { if (e.target === ov || e.target.closest(".kq-pop-close")) close(); });
    document.addEventListener("keydown", key);
    document.body.appendChild(ov);
    nkjvBook(slug).then(function (ch) {
      var out = [];
      for (var c = r.c; c <= r.c2; c++) {
        var verses = ch[String(c)] || {}, nums = Object.keys(verses).map(Number).sort(function (a, b) { return a - b; });
        nums.forEach(function (v) {
          var from = c === r.c ? (r.v || 1) : 1, to = c === r.c2 ? (r.v2 || (r.v ? r.v : 999)) : 999;
          if (!r.v && c === r.c2 && r.c2 !== r.c) to = 999;
          if (v >= from && v <= to) out.push('<p><sup>' + (r.c2 !== r.c ? c + ":" : "") + v + "</sup> " + esc(String(verses[v]).replace(/\s+/g, " ").trim()) + "</p>");
        });
      }
      ov.querySelector(".kq-pop-body").innerHTML = out.join("") || "<p>This passage could not be found.</p>";
    }).catch(function () { ov.querySelector(".kq-pop-body").innerHTML = "<p>This passage could not be loaded.</p>"; });
  }

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
    if (b.outline) tabs.push({ id: "outline", label: "Book Outline", path: base + "book-outline-" + b.slug + ".html" });
    (b.special || []).forEach(function (s) {
      if (typeof s === "string") s = { id: s, label: titleCase(s), file: "book-special-" + b.slug + "-" + s + ".html" };
      tabs.push({ id: "extra-" + s.id, label: s.label, path: base + s.file });
    });
    tabs.push({ id: "chapters", label: "Chapters" });
    if (b.keyq) tabs.push({ id: "key-questions", label: "Key Questions", path: base + b.keyq });
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
        if (t.id === "key-questions") linkScripture(box, lib);
        panel.innerHTML = "";
        panel.appendChild(box);
      });
    }

    tabsEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".bk-tab");
      if (btn) show(btn.dataset.tab);
    });
    // Links inside a document (Key Questions "Jump to", "Back to top", "Related") scroll
    // within the page instead of changing the tab.
    panel.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = decodeURIComponent(a.getAttribute("href").slice(1));
      if (!id || tabs.some(function (x) { return x.id === id; })) return;
      var el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      if (!el.offsetParent) el = tabsEl;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 90, behavior: "smooth" });
    });
    window.addEventListener("hashchange", function () {
      var h = location.hash.replace("#", "");
      if (h && tabs.some(function (x) { return x.id === h; })) show(h);
    });
    var start = location.hash.replace("#", "");
    if (!start) start = b.overview ? "overview" : "chapters";
    show(start);
  });
})();
