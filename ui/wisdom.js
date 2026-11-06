/* The King’s Wisdom: browse every saying in Proverbs by theme, character, keyword, teaching form or chapter.
   Data comes from data/wisdom.json, exported from the Proverbs Project by scripts/build_site.py. */
(function () {
  "use strict";
  var MTB = window.MTB, esc = MTB.esc;
  var head = document.getElementById("ch-head"), main = document.getElementById("ch-main");
  var W = null, NKJV = {}, BY_ID = {}, PAGE = 40, shown = PAGE, openCard = {};
  var FILTERS = [
    ["theme", "Theme", "themes"], ["char", "Character", "characters"], ["kw", "Keyword", "keywords"],
    ["c", "Chapter", null]
  ];
  var state = { theme: "", char: "", kw: "", form: "", c: "", q: "", focus: "" };

  /* ---------- state in the address (so a filtered view can be shared or bookmarked) ---------- */
  function readHash() {
    var h = new URLSearchParams(location.hash.slice(1));
    Object.keys(state).forEach(function (k) { state[k] = h.get(k) || ""; });
  }
  function writeHash() {
    var h = new URLSearchParams();
    Object.keys(state).forEach(function (k) { if (state[k]) h.set(k, state[k]); });
    var s = h.toString();
    history.replaceState(null, "", s ? "#" + s : location.pathname + location.search);
  }

  /* ---------- helpers ---------- */
  function themesOf(u) { return [u.theme].concat(u.themes2 || []).filter(Boolean); }
  function valuesOf(u, key) {
    if (key === "theme") return themesOf(u);
    if (key === "char") return u.chars || [];
    if (key === "kw") return u.kw || [];
    if (key === "form") return u.forms || [];
    if (key === "c") return [String(u.c)];
    return [];
  }
  function verseText(u) {
    var ch = NKJV[String(u.c)] || {}, out = [];
    for (var v = u.s; v <= u.e; v++) {
      var t = String(ch[String(v)] || "").trim();
      if (!t) continue;
      // Poetry lines: double spaces where the file has them; otherwise a new line starts at a capital after punctuation.
      var parts = /\S\s{2,}\S/.test(t) ? t.split(/\s{2,}/) : t.split(/(?<=[,;:.!?’”])\s+(?=[A-Z“‘])/);
      var lines = parts.map(function (l) { return '<span class="wu-ln">' + esc(l.trim()) + "</span>"; }).join("");
      out.push((u.s !== u.e ? '<sup class="wu-vn">' + v + "</sup>" : "") + lines);
    }
    return out.join("");
  }
  function haystack(u) {
    if (!u._hay) {
      var ch = NKJV[String(u.c)] || {}, vt = [];
      for (var v = u.s; v <= u.e; v++) vt.push(ch[String(v)] || "");
      u._hay = [u.ref, u.summary, u.principle, u.insight, u.application, u.notes, themesOf(u).join(" "),
        (u.chars || []).join(" "), (u.kw || []).join(" "), vt.join(" ")].join(" ").toLowerCase();
    }
    return u._hay;
  }
  // "Pro 20:3" or "Pro 3:5-6" -> the unit that holds that verse
  function unitFor(ref) {
    var m = /(\d+):(\d+)/.exec(ref || "");
    if (!m) return null;
    var c = +m[1], v = +m[2];
    for (var i = 0; i < W.units.length; i++) { var u = W.units[i]; if (u.c === c && u.s <= v && v <= u.e) return u; }
    return null;
  }
  function shortRef(u) { return "Proverbs " + u.c + ":" + (u.s === u.e ? u.s : u.s + "–" + u.e); }

  /* ---------- filtering ---------- */
  function matches(u, skip) {
    for (var i = 0; i < FILTERS.length; i++) {
      var k = FILTERS[i][0];
      if (k !== skip && state[k] && valuesOf(u, k).indexOf(state[k]) < 0) return false;
    }
    if (state.q) {
      var words = state.q.toLowerCase().split(/\s+/).filter(Boolean), hay = haystack(u);
      for (var j = 0; j < words.length; j++) if (hay.indexOf(words[j]) < 0) return false;
    }
    return true;
  }
  function results() {
    if (state.focus && BY_ID[state.focus]) {
      var f = BY_ID[state.focus], list = [f], seen = {};
      seen[f.id] = 1;
      (f.rel || []).forEach(function (r) { var u = unitFor(r.ref); if (u && !seen[u.id]) { seen[u.id] = 1; list.push(u); } });
      W.units.forEach(function (u) {   // sayings that point back to this one
        if (seen[u.id]) return;
        (u.rel || []).forEach(function (r) { if (!seen[u.id] && unitFor(r.ref) === f) { seen[u.id] = 1; list.push(u); } });
      });
      return list;
    }
    return W.units.filter(function (u) { return matches(u); });
  }
  // Option counts reflect the other filters already chosen.
  function options(key) {
    var counts = {};
    W.units.forEach(function (u) {
      if (!matches(u, key)) return;
      valuesOf(u, key).forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    });
    var keys = Object.keys(counts);
    if (key === "c") keys.sort(function (a, b) { return a - b; });
    else keys.sort(function (a, b) { return a.localeCompare(b); });
    if (state[key] && keys.indexOf(state[key]) < 0) keys.unshift(state[key]);
    return keys.map(function (k) { return [k, counts[k] || 0]; });
  }

  /* ---------- rendering ---------- */
  function filterBar() {
    var html = '<div class="wis-bar" role="search"><div class="wis-filters">';
    FILTERS.forEach(function (f) {
      var opts = options(f[0]);
      html += '<label class="wis-f' + (state[f[0]] ? " on" : "") + '"><span>' + f[1] + "</span>" +
        '<select data-f="' + f[0] + '"><option value="">All</option>' +
        opts.map(function (o) {
          var label = f[0] === "c" ? "Proverbs " + o[0] : o[0];
          return '<option value="' + esc(o[0]) + '"' + (o[0] === state[f[0]] ? " selected" : "") + ">" + esc(label) + " (" + o[1] + ")</option>";
        }).join("") + "</select></label>";
    });
    var any = FILTERS.some(function (f) { return state[f[0]]; }) || state.q;
    html += '<label class="wis-f wis-q"><span>Words</span><input type="search" id="wis-q" value="' + esc(state.q) + '" placeholder="Optional" autocomplete="off"></label>';
    html += '<div class="wis-f wis-clear"><span aria-hidden="true">&nbsp;</span><button type="button" class="btn btn-outline" data-clear' + (any ? "" : " disabled") + ">Clear filters</button></div>";
    html += "</div></div>";
    return html;
  }

  function defs() {
    var out = [];
    FILTERS.forEach(function (f) {
      if (f[2] && state[f[0]]) {
        var d = (W.vocab[f[2]] || {})[state[f[0]]];
        if (d) out.push("<b>" + esc(state[f[0]]) + ":</b> " + esc(d));
      }
    });
    return out.length ? '<p class="wis-defs">' + out.join("<br>") + "</p>" : "";
  }

  function tagChips(u) {
    var groups = [["theme", "Theme", themesOf(u)], ["char", "Character", u.chars], ["kw", "Keywords", u.kw]];
    return '<div class="lc wu-find"><h3>Find more like this</h3>' + groups.map(function (g) {
      if (!g[2] || !g[2].length) return "";
      return '<div class="wu-tg"><span class="wu-tgl">' + g[1] + '</span><span class="wu-tgc">' + g[2].map(function (t) {
        var on = state[g[0]] === t;
        return '<button type="button" class="wu-tag' + (on ? " on" : "") + '" data-set="' + g[0] + '" data-val="' + esc(t) + '"' +
          (on ? ' aria-pressed="true" title="Already filtering by this"' : ' title="Show every saying tagged ' + esc(t) + '"') + ">" + esc(t) + "</button>";
      }).join("") + "</span></div>";
    }).join("") + "</div>";
  }

  function card(u) {
    var o = !!openCard[u.id];
    var study = MTB.chapterUrl("proverbs", u.c) + "#v" + u.s;
    var html = '<article class="wu' + (o ? " open" : "") + (state.focus === u.id ? " wu-focus" : "") + '" id="' + esc(u.id) + '">' +
      '<button type="button" class="wu-row" data-open="' + esc(u.id) + '" aria-expanded="' + o + '">' +
        '<span class="wu-top"><span class="wu-ref">' + esc(shortRef(u)) + "</span>" +
          (u.draft ? '<span class="wu-draft" title="This chapter has not been approved yet">Draft</span>' : "") +
          '<span class="wu-theme">' + esc(u.theme) + "</span></span>" +
        '<span class="wu-text">' + verseText(u) + "</span>" +
        (u.summary ? '<span class="wu-sum"><span class="wu-sumlab">In short</span>' + esc(u.summary) + "</span>" : "") +
        '<span class="wu-cue">' + (o ? "Close ▴" : "Study ▾") + "</span>" +
      "</button>";
    if (o) {
      html += '<div class="layers-card wu-card">' +
        (u.principle ? '<div class="lc wu-principle"><h3>Key Principle</h3><p>' + esc(u.principle) + "</p></div>" : "") +
        (u.insight ? '<div class="lc hear"><h3>Pastoral Insight</h3><p>' + esc(u.insight) + "</p></div>" : "") +
        (u.application ? '<div class="lc"><h3>Practical Application</h3><p>' + esc(u.application) + "</p></div>" : "") +
        (u.notes ? '<div class="lc notes"><h3>Notes</h3><p>' + esc(u.notes) + "</p></div>" : "");
      if (u.rel && u.rel.length) {
        html += '<div class="lc"><div class="wu-relhead"><h3>Related Proverbs · ' + u.rel.length + "</h3>" +
          (state.focus === u.id ? "" : '<button type="button" class="wu-thread" data-focus="' + esc(u.id) + '">Read them together →</button>') + "</div>" +
          '<ul class="wu-rel">' + u.rel.map(function (r) {
            var t = unitFor(r.ref), label = esc(r.ref.replace(/^Pro\b/, "Proverbs"));
            return '<li><span class="wu-rl">' + (t ? '<button type="button" class="wu-rref" data-focus="' + esc(t.id) + '">' + label + "</button>" : "<b>" + label + "</b>") +
              '<span class="wu-rtype">' + esc(r.type) + '</span></span><span class="wu-rn">' + esc(r.note) + "</span></li>";
          }).join("") + "</ul></div>";
      }
      html += tagChips(u) +
        '<div class="lc wu-foot"><a href="' + study + '">Read the full study of Proverbs ' + u.c + " →</a></div></div>";
    }
    return html + "</article>";
  }

  function render() {
    var list = results(), any = FILTERS.some(function (f) { return state[f[0]]; }) || state.q;
    var html = "";
    if (state.focus && BY_ID[state.focus]) {
      html += '<div class="wis-status"><span>' + esc(shortRef(BY_ID[state.focus])) + " and " + (list.length - 1) + " related " + (list.length === 2 ? "saying" : "sayings") + "</span>" +
        '<button type="button" class="btn btn-outline" data-back>← Back to the list</button></div>';
    } else {
      html += filterBar() + defs() +
        '<div class="wis-status"><span><b>' + list.length + "</b> " + (list.length === 1 ? "saying" : "sayings") + (any ? "" : " in Proverbs") + "</span></div>";
    }
    if (!list.length) html += '<p class="notice">No sayings match. Try removing a filter.</p>';
    html += '<div class="wu-list">' + list.slice(0, state.focus ? list.length : shown).map(card).join("") + "</div>";
    if (!state.focus && list.length > shown) {
      html += '<div class="wis-more"><button type="button" class="btn btn-outline" data-more>Show more (' + (list.length - shown) + " left)</button></div>";
    }
    html += '<p class="sc-copy">Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved.</p>';
    var active = document.activeElement && document.activeElement.id === "wis-q", caret = active ? document.activeElement.selectionStart : 0;
    main.innerHTML = html;
    if (active) { var q = document.getElementById("wis-q"); q.focus(); try { q.setSelectionRange(caret, caret); } catch (e) { /* ignore */ } }
    writeHash();
  }

  /* ---------- events ---------- */
  main.addEventListener("change", function (e) {
    var f = e.target.getAttribute("data-f");
    if (f) { state[f] = e.target.value; shown = PAGE; render(); }
  });
  var qTimer = null;
  main.addEventListener("input", function (e) {
    if (e.target.id !== "wis-q") return;
    clearTimeout(qTimer);
    var v = e.target.value;
    qTimer = setTimeout(function () { state.q = v.trim(); shown = PAGE; render(); }, 250);
  });
  main.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-open")) { var id = b.getAttribute("data-open"); openCard[id] = !openCard[id]; render(); return; }
    if (b.hasAttribute("data-more")) { shown += PAGE; render(); return; }
    if (b.hasAttribute("data-clear")) { FILTERS.forEach(function (f) { state[f[0]] = ""; }); state.q = ""; shown = PAGE; render(); return; }
    if (b.hasAttribute("data-back")) { var back = state.focus; state.focus = ""; render(); var el = document.getElementById(back); if (el) el.scrollIntoView({ block: "center" }); return; }
    if (b.hasAttribute("data-focus")) { state.focus = b.getAttribute("data-focus"); openCard[state.focus] = true; render(); window.scrollTo(0, main.offsetTop - 70); return; }
    if (b.hasAttribute("data-set")) {
      state.focus = ""; state[b.getAttribute("data-set")] = b.getAttribute("data-val"); shown = PAGE; render();
      window.scrollTo(0, main.offsetTop - 70);
    }
  });
  window.addEventListener("hashchange", function () { readHash(); render(); });

  /* ---------- load ---------- */
  Promise.all([
    fetch("data/wisdom.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("missing"); return r.json(); }),
    fetch(MTB.root + "assets/js/bibles-json/nkjv/proverbs.json").then(function (r) { return r.json(); }).catch(function () { return {}; })
  ]).then(function (res) {
    W = res[0]; NKJV = res[1].chapters || {};
    W.units.forEach(function (u) { BY_ID[u.id] = u; });
    var nCh = Object.keys(W.chapters).length, nDraft = Object.keys(W.chapters).filter(function (k) { return W.chapters[k] === "draft"; }).length;
    var stat = document.createElement("p");
    stat.className = "wis-stat";
    stat.textContent = W.units.length + " sayings from " + nCh + " chapters" + (nDraft ? " · pilot: " + nDraft + " chapters are drafts not yet approved" : "");
    head.appendChild(stat);
    readHash();
    render();
  }).catch(function () {
    main.innerHTML = '<p class="notice">The King’s Wisdom isn’t available right now.</p>';
  });
})();
