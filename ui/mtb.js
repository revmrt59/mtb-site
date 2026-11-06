/* Mastering the Bible — shared page code: top bar, footer, passage picker, library data. */
(function () {
  "use strict";

  var meta = document.querySelector('meta[name="mtb-root"]');
  var ROOT = meta ? meta.getAttribute("content") : "./";   // where the shared content folders live (books/, word-studies/, …)

  var BOOK_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 5.5C2 4.7 2.7 4 3.5 4H9a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5h-6A1.5 1.5 0 0 1 2 16z"/><path d="M22 5.5c0-.8-.7-1.5-1.5-1.5H15a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5h6a1.5 1.5 0 0 0 1.5-1.5z"/></svg>';
  var MENU_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function store(key, val) {
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  var NAV = [
    ["Library", "index.html#library"],
    ["Word Studies", ROOT + "word-studies/"],
    ["The King’s Wisdom", "wisdom.html"],
    ["The Life of Jesus", ROOT + "loc/life-of-jesus"],
    ["About", "about.html"]
  ];

  var MTB = {
    root: ROOT,
    esc: esc,
    chapterUrl: function (slug, n) { return "chapter.html?book=" + encodeURIComponent(slug) + "&c=" + n; },
    bookUrl: function (slug) { return "book.html?book=" + encodeURIComponent(slug); },
    _lib: null,
    library: function () {
      if (!MTB._lib) {
        MTB._lib = fetch("data/library.json", { cache: "no-cache" }).then(function (r) {
          if (!r.ok) throw new Error("library " + r.status);
          return r.json();
        });
      }
      return MTB._lib;
    },
    /* A book is worth opening when it has ready chapters or a Book Overview. */
    hasContent: function (b) { return b.ready.length > 0 || !!b.overview; },
    /* Flatten: every book with testament + group info. */
    books: function (lib) {
      var out = [];
      lib.testaments.forEach(function (t) {
        t.groups.forEach(function (g) {
          g.books.forEach(function (b) { out.push(Object.assign({ testament: t, group: g }, b)); });
        });
      });
      return out;
    }
  };
  window.MTB = MTB;

  /* ---------- Top bar & footer ---------- */
  function renderChrome() {
    var top = document.getElementById("mtb-top");
    if (top) {
      top.className = "topbar";
      top.innerHTML =
        '<div class="wrap">' +
          '<a class="brand" href="index.html">Mastering the Bible</a>' +
          '<nav class="topnav" aria-label="Main">' +
            NAV.map(function (n) { return '<a href="' + n[1] + '">' + esc(n[0]) + "</a>"; }).join("") +
          "</nav>" +
          '<button type="button" class="picker-btn" data-open-picker aria-haspopup="dialog">' + BOOK_ICON +
            '<span class="long">Choose a passage</span><span class="short">Books</span></button>' +
          '<button type="button" class="menu-btn" aria-expanded="false" aria-controls="mtb-mobile-nav" aria-label="Menu">' + MENU_ICON + "</button>" +
        "</div>" +
        '<nav id="mtb-mobile-nav" class="mobile-nav" aria-label="Main">' +
          NAV.map(function (n) { return '<a href="' + n[1] + '">' + esc(n[0]) + "</a>"; }).join("") +
        "</nav>";
      var mb = top.querySelector(".menu-btn"), mn = top.querySelector(".mobile-nav");
      mb.addEventListener("click", function () {
        var open = !mn.classList.contains("open");
        mn.classList.toggle("open", open);
        mb.setAttribute("aria-expanded", String(open));
      });
      mn.addEventListener("click", function (e) { if (e.target.tagName === "A") { mn.classList.remove("open"); mb.setAttribute("aria-expanded", "false"); } });
    }
    var foot = document.getElementById("mtb-foot");
    if (foot) {
      foot.className = "footer";
      foot.innerHTML =
        '<div class="wrap">' +
          '<a href="about.html#mtb">About Mastering the Bible</a>' +
          '<a href="about.html#bible">About the Bible</a>' +
          '<a href="' + ROOT + 'loc/life-of-jesus">The Life of Jesus</a>' +
          '<a href="' + ROOT + 'resources/">Resources</a>' +
          '<span class="visits" id="mtb-visits" hidden></span>' +
          '<span class="copy">Mastering the Bible · Helping People Hear God’s Voice</span>' +
        "</div>";
      if (document.body.hasAttribute("data-count-visit")) countVisit();
    }
  }

  /* ---------- Visitor count (home page footer) ----------
     Same GoatCounter total the old home page showed ("Unique Human Visitors"), bot-filtered. */
  function countVisit() {
    fetch("https://mtb.goatcounter.com/counter/TOTAL.json")
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (d) {
        var el = document.getElementById("mtb-visits");
        if (!el || !d || d.count == null) return;
        var n = String(d.count);
        el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
          '<span aria-label="' + esc(n) + ' visitors">' + esc(n) + "</span>";
        el.hidden = false;
      }).catch(function () { /* counter unavailable: show nothing */ });
  }

  /* ---------- Passage picker ---------- */
  var dlg, state = { book: null, readyOnly: store("mtb-ready-only") !== "0" };

  function buildDialog() {
    dlg = document.createElement("dialog");
    dlg.className = "picker";
    dlg.setAttribute("aria-labelledby", "pk-title");
    dlg.innerHTML =
      '<div class="pk-head">' +
        '<button type="button" class="pk-back" hidden>‹ All books</button>' +
        '<h2 class="pk-title" id="pk-title">Choose a passage</h2>' +
        '<button type="button" class="pk-icon" aria-label="Close">×</button>' +
      "</div>" +
      '<div class="pk-body"><p class="pk-empty">Loading…</p></div>';
    document.body.appendChild(dlg);
    dlg.querySelector(".pk-icon").addEventListener("click", function () { dlg.close(); });
    dlg.querySelector(".pk-back").addEventListener("click", function () { state.book = null; draw(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });   // click on backdrop
    dlg.addEventListener("close", function () { state.book = null; });
  }

  function draw() {
    MTB.library().then(function (lib) {
      var body = dlg.querySelector(".pk-body"), back = dlg.querySelector(".pk-back"), title = dlg.querySelector(".pk-title");
      if (state.book) {
        var b = MTB.books(lib).filter(function (x) { return x.slug === state.book; })[0];
        back.hidden = false;
        title.textContent = b.name;
        var ready = {};
        b.ready.forEach(function (r) { ready[r.n] = r; });
        var html = '<div class="pk-booklinks">';
        if (b.overview) html += '<a href="' + MTB.bookUrl(b.slug) + '">Book Overview</a>';
        html += '<a href="' + MTB.bookUrl(b.slug) + '#context">Bible Context: ' + esc(b.group.name) + "</a>";
        html += "</div>";
        var big = b.chapters > 12;
        html += '<div class="pk-toolbar"><span class="lede">' + b.ready.length + " of " + b.chapters + (b.chapters === 1 ? " chapter" : " chapters") + " ready</span>";
        if (big) html += '<button type="button" class="pk-toggle" aria-pressed="' + (!state.readyOnly) + '">' + (state.readyOnly ? "Show all " + b.chapters + " chapters" : "Only show what’s ready") + "</button>";
        html += "</div>";
        html += '<div class="pk-chapters">';
        for (var n = 1; n <= b.chapters; n++) {
          var r = ready[n];
          if (!r && state.readyOnly && big) continue;
          if (r) html += '<a class="chip" href="' + MTB.chapterUrl(b.slug, n) + '" aria-label="' + esc(b.name) + " " + n + '">' + n + "</a>";
          else html += '<span class="chip off" aria-label="' + esc(b.name) + " " + n + ', coming later">' + n + "</span>";
        }
        html += "</div>";
        body.innerHTML = html;
        body.scrollTop = 0;
        var tg = body.querySelector(".pk-toggle");
        if (tg) tg.addEventListener("click", function () {
          state.readyOnly = !state.readyOnly;
          store("mtb-ready-only", state.readyOnly ? "1" : "0");
          draw();
        });
        var first = body.querySelector("a.chip");
        if (first) first.focus();
        return;
      }
      back.hidden = true;
      title.textContent = "Choose a passage";
      var html2 = '<div class="pk-toolbar"><span class="lede">Tap a book, then a chapter.</span>' +
        '<button type="button" class="pk-toggle" aria-pressed="' + (!state.readyOnly) + '">' + (state.readyOnly ? "Show all 66 books" : "Only show what’s ready") + "</button></div>";
      html2 += '<div class="pk-cols">';
      lib.testaments.forEach(function (t) {
        var groups = "";
        t.groups.forEach(function (g) {
          var books = g.books.filter(function (b) { return !state.readyOnly || MTB.hasContent(b); });
          if (!books.length) return;
          groups += '<div class="pk-group"><h3>' + esc(g.name) + '</h3><div class="pk-books">' +
            books.map(function (b) {
              var ok = MTB.hasContent(b);
              return '<button type="button" class="pk-book" data-book="' + esc(b.slug) + '"' + (ok ? "" : " disabled") +
                ' aria-label="' + esc(b.name) + (ok ? (b.ready.length ? ", " + b.ready.length + (b.ready.length === 1 ? " chapter" : " chapters") + " ready" : ", Book Overview") : ", coming later") + '">' + esc(b.name) + "</button>";
            }).join("") + "</div></div>";
        });
        if (groups) html2 += '<section><h3 class="pk-test">' + esc(t.name) + "</h3>" + groups + "</section>";
      });
      html2 += "</div>";
      body.innerHTML = html2;
      body.querySelector(".pk-toggle").addEventListener("click", function () {
        state.readyOnly = !state.readyOnly;
        store("mtb-ready-only", state.readyOnly ? "1" : "0");
        draw();
      });
      Array.prototype.forEach.call(body.querySelectorAll(".pk-book:not([disabled])"), function (btn) {
        btn.addEventListener("click", function () { state.book = btn.getAttribute("data-book"); draw(); });
      });
    }).catch(function () {
      dlg.querySelector(".pk-body").innerHTML = '<p class="pk-empty">The book list could not be loaded. Please refresh the page.</p>';
    });
  }

  MTB.openPicker = function (slug) {
    if (!dlg) buildDialog();
    state.book = slug || null;
    draw();
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  };

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-open-picker]") : null;
    if (t) { e.preventDefault(); MTB.openPicker(t.getAttribute("data-book") || null); }
  });

  renderChrome();
})();
