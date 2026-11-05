/* doc.html shows one page piece (?p=path); about.html lists the About pages. */
(function () {
  "use strict";
  var MTB = window.MTB, esc = MTB.esc;
  var head = document.getElementById("dc-head"), main = document.getElementById("dc-main");
  var isAbout = /about\.html$/.test(location.pathname);

  if (isAbout) {
    document.title = "About · Mastering the Bible";
    head.innerHTML = '<h1 id="ch-title">About</h1><p class="ch-main-idea">About Mastering the Bible, and about the Bible itself.</p>';
    fetch("data/pages.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (pages) {
      function list(title, id, items) {
        if (!items || !items.length) return "";
        return '<section id="' + id + '" class="about-col"><h2 class="h2">' + esc(title) + '</h2><div class="doc-list stacked">' +
          items.map(function (p) { return '<a href="' + MTB.docUrl(p.path) + '"><strong>' + esc(p.title) + "</strong>" + (p.note ? "<span>" + esc(p.note) + "</span>" : "") + "</a>"; }).join("") +
          "</div></section>";
      }
      main.innerHTML = '<div class="about-cols">' + list("About Mastering the Bible", "mtb", pages.about) + list("About the Bible", "bible", pages.bible) + "</div>";
      if (location.hash) { var el = document.querySelector(location.hash); if (el) el.scrollIntoView(); }
    }).catch(function () { main.innerHTML = '<p class="notice">The About pages could not be loaded.</p>'; });
    return;
  }

  var path = new URLSearchParams(location.search).get("p") || "";
  MTB.loadDoc(path).then(function (box) {
    if (!box) { head.innerHTML = '<h1 id="ch-title">Page not found</h1>'; main.innerHTML = '<p class="notice">This page isn’t available.</p>'; return; }
    var title = MTB.docTitle(box) || path.replace(/^.*\//, "").replace(/\.html$/, "").replace(/-/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }).replace(/\bMtb\b/, "MTB").replace(/\bOf\b/, "of");
    document.title = title + " · Mastering the Bible";
    var back = /^about|^aboutthebible/.test(path) ? '<a class="wd-back" href="about.html">← About</a>' : '<a class="wd-back" href="javascript:history.back()">← Back</a>';
    head.innerHTML = back + '<h1 id="ch-title">' + esc(title) + "</h1>";
    box.className = "doc hide-h1";
    main.innerHTML = "";
    main.appendChild(box);
  });
})();
