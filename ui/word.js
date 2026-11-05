/* Word study page: shows one of your word-study files inside the site. */
(function () {
  "use strict";
  var MTB = window.MTB, esc = MTB.esc;
  var S = (new URLSearchParams(location.search).get("s") || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  var head = document.getElementById("ch-head"), main = document.getElementById("ch-main");

  function backLink() {
    var r = document.referrer || "";
    if (r.indexOf(location.origin) === 0 && /chapter\.html/.test(r)) {
      return '<a class="wd-back" href="' + esc(r) + '">← Back to the chapter</a>';
    }
    return '<a class="wd-back" href="' + MTB.root + 'word-studies/">← All word studies</a>';
  }

  function fail() {
    head.innerHTML = backLink() + '<h1 id="ch-title">Word study not found</h1>';
    main.innerHTML = '<p class="notice">We couldn’t find this word study.</p>';
  }
  if (!S) { fail(); return; }

  Promise.all([
    fetch(MTB.root + "word-studies/" + S + ".html").then(function (r) { if (!r.ok) throw new Error("404"); return r.text(); }),
    fetch("data/words.json").then(function (r) { return r.json(); }).catch(function () { return {}; }),
    MTB.library().catch(function () { return null; })
  ]).then(function (res) {
    var doc = new DOMParser().parseFromString("<div id='root'>" + res[0] + "</div>", "text/html");
    var root = doc.getElementById("root"), info = res[1][S] || {}, lib = res[2];
    Array.prototype.forEach.call(root.querySelectorAll("style, script, button, .mtb-print-controls"), function (n) { n.remove(); });

    var sumBox = root.querySelector("#ws-summary-text"), first = sumBox && sumBox.querySelector("p");
    var heading = first ? first.textContent : "";
    var word = info.w || (heading.split(" - ")[0] || S.toUpperCase());
    if (first) first.remove();
    if (sumBox) Array.prototype.forEach.call(sumBox.querySelectorAll(".ws-summary-label"), function (n) { n.remove(); });

    document.title = word + " (" + S.toUpperCase() + ") · Word Study · Mastering the Bible";
    head.innerHTML = backLink() +
      '<div class="eyebrow" style="color:var(--gold-soft)">Word Study</div>' +
      '<h1 id="ch-title">' + esc(word) + "</h1>" +
      (info.t ? '<p class="wd-tr">' + esc(info.t) + "</p>" : "") +
      '<div class="wd-meta"><span>Strong’s ' + esc(S.toUpperCase()) + "</span>" + (info.l ? "<span>" + esc(info.l) + "</span>" : "") + "</div>";

    // Numbered section titles ("1. Word Background & Setting") become real headings.
    var body = root.querySelector("#ws-full-body");
    if (body) {
      Array.prototype.forEach.call(body.querySelectorAll("p"), function (p) {
        var st = p.querySelector("strong");
        if (st && p.textContent.trim() === st.textContent.trim() && /^\d+\.\s/.test(st.textContent.trim())) {
          var h = doc.createElement("h3");
          h.textContent = st.textContent.trim().replace(/^\d+\.\s*/, "");
          p.replaceWith(h);
        }
      });
    }

    // Link occurrence references to chapters that are on the site.
    var occ = root.querySelector(".mtb-word-study-occurrence-verses"), count = 0;
    if (occ) {
      var ready = {};
      if (lib) MTB.books(lib).forEach(function (b) { b.ready.forEach(function (r) { ready[b.name + " " + r.n] = MTB.chapterUrl(b.slug, r.n); }); });
      Array.prototype.forEach.call(occ.querySelectorAll(".mtb-word-study-occurrence-verse"), function (p) {
        count++;
        var st = p.querySelector("strong"), m = st && /^(.+) (\d+):(\d+)$/.exec(st.textContent.trim());
        var key = m ? (m[1] === "Psalm" ? "Psalms" : m[1]) + " " + m[2] : "";
        if (m && ready[key]) {
          var a = doc.createElement("a");
          a.href = ready[key] + "#v" + m[3];
          a.textContent = st.textContent;
          st.textContent = "";
          st.appendChild(a);
        }
      });
    }

    var html = "";
    if (sumBox && sumBox.textContent.trim()) html += '<section class="wd-summary prose"><h2>Summary</h2>' + sumBox.innerHTML + "</section>";
    if (body) html += '<section class="wd-body prose"><h2>Full Study</h2>' + body.innerHTML + "</section>";
    if (occ) html += '<details class="wd-occ"><summary>Every verse where this word appears' + (count ? " (" + count + ")" : "") + '</summary><div class="occ-body">' + occ.innerHTML + "</div></details>";
    if (!html) html = '<section class="wd-body prose">' + root.innerHTML + "</section>";
    main.innerHTML = html;
  }).catch(fail);
})();
