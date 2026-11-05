/* Shows one of your published page pieces (Book Overview, Bible Context, Resources, About…)
   inside the new site: removes the old styles and print buttons, fixes links, keeps your content. */
(function () {
  "use strict";
  var MTB = window.MTB;
  var ALLOWED = /^(books|about|aboutthebible|resources|sections|loc)\/[A-Za-z0-9 _\/.-]+\.html$/;

  function safePath(p) {
    p = String(p || "").replace(/^\/+/, "");
    return ALLOWED.test(p) && p.indexOf("..") < 0 ? p : "";
  }
  MTB.docUrl = function (path) { return "doc.html?p=" + encodeURIComponent(path); };

  /* Fetch a page piece and return a cleaned DOM container (or null if missing). */
  MTB.loadDoc = function (path) {
    path = safePath(path);
    if (!path) return Promise.resolve(null);
    return fetch(MTB.root + path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) return null;
      return r.text().then(function (txt) {
        var doc = new DOMParser().parseFromString(txt, "text/html");
        var root = doc.querySelector("main.doc-content") || doc.querySelector(".mtb-doc") || doc.body;
        var box = document.createElement("div");
        box.innerHTML = root.innerHTML;
        Array.prototype.forEach.call(box.querySelectorAll("style, script, link, meta, button, .mtb-print-controls, header.site-header, nav.main-nav"), function (n) { n.remove(); });
        // Links: site-absolute links to page pieces open in the doc viewer; others are made relative to the site root.
        Array.prototype.forEach.call(box.querySelectorAll("a[href]"), function (a) {
          var h = a.getAttribute("href");
          if (/^https?:/i.test(h)) { a.target = "_blank"; a.rel = "noopener"; return; }
          if (h.charAt(0) === "#") return;
          var clean = h.replace(/^\/+/, "");
          if (safePath(clean)) a.setAttribute("href", MTB.docUrl(clean));
          else if (h.charAt(0) === "/") a.setAttribute("href", MTB.root + clean);
        });
        Array.prototype.forEach.call(box.querySelectorAll("img[src]"), function (img) {
          var s = img.getAttribute("src");
          if (s.charAt(0) === "/") img.setAttribute("src", MTB.root + s.replace(/^\/+/, ""));
          else if (!/^(https?:|data:)/.test(s)) img.setAttribute("src", MTB.root + path.replace(/[^\/]*$/, "") + s);
          img.loading = "lazy";
        });
        Array.prototype.forEach.call(box.querySelectorAll("[style]"), function (n) { n.removeAttribute("style"); });
        // Go-deeper sections open by default on their own page.
        Array.prototype.forEach.call(box.querySelectorAll("details"), function (d) { if (!/verse/.test(d.className)) d.open = true; });
        return box;
      });
    }).catch(function () { return null; });
  };

  /* First heading text, for page titles. */
  MTB.docTitle = function (box) {
    var h = box && (box.querySelector("h1") || box.querySelector("h2"));
    return h ? h.textContent.trim() : "";
  };
})();
