/* Chapter page: read the chapter by its outline sections; tap any verse to open its layers. */
(function () {
  "use strict";
  var MTB = window.MTB, esc = MTB.esc;
  var q = new URLSearchParams(location.search);
  var SLUG = q.get("book") || "", CH = parseInt(q.get("c") || "0", 10);
  var head = document.getElementById("ch-head"), main = document.getElementById("ch-main"), pop = document.getElementById("ws-pop");
  var bar = document.getElementById("readbar");
  var FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var TRANSLATIONS = [["nkjv", "NKJV"], ["nlt", "NLT"], ["esv", "ESV"], ["niv", "NIV"], ["nasb", "NASB"], ["amp", "AMP"], ["kjv", "KJV"], ["tlv", "TLV"], ["ylt", "YLT"]];
  var LAYERS = [
    ["meaning", "Meaning"], ["explain", "Explanation"], ["hear", "Hearing God’s Voice"],
    ["refl", "Reflections"], ["notes", "Study Notes"], ["culture", "Culture"]
  ];
  var DEFAULTS = { meaning: 1, explain: 0, hear: 1, refl: 1, notes: 0, culture: 1, ws: 1, tr: "nkjv" };

  var settings = (function () {
    var s = Object.assign({}, DEFAULTS);
    try { Object.assign(s, JSON.parse(localStorage.getItem("mtb-settings") || "{}")); } catch (e) { /* ignore */ }
    return s;
  })();
  function save() { try { localStorage.setItem("mtb-settings", JSON.stringify(settings)); } catch (e) { /* ignore */ } }

  var D = null, BIBLE = {}, WORDS = null, open = {}, hearAll = {}, reflOpen = {}, reflFilter = {}, groupOpen = {}, refocus = null;

  function bookTitle(name) { return name === "Psalms" ? "Psalm" : name; }
  function ref(a, b) { return a === b ? String(a) : a + "–" + b; }

  /* ---------- Scripture text ---------- */
  // Translations served live from API.Bible (licensed). The others still come from the stored JSON files.
  var API_TR = { niv: 1, nlt: 1, amp: 1, kjv: 1 };
  // Notices for the stored JSON copies (prototype only; confirm each against its license before launch).
  var NOTICES = {
    nkjv: "Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved.",
    esv: "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.",
    nlt: "Scripture quotations are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.",
    niv: "Scripture quotations taken from The Holy Bible, New International Version® NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™ Used by permission. All rights reserved worldwide.",
    nasb: "Scripture quotations taken from the (NASB®) New American Standard Bible®, Copyright © 1960, 1971, 1977, 1995, 2020 by The Lockman Foundation. Used by permission. All rights reserved. lockman.org",
    amp: "Scripture quotations taken from the Amplified® Bible (AMP), Copyright © 2015 by The Lockman Foundation. Used by permission. lockman.org",
    tlv: "Scripture taken from the Holy Scriptures, Tree of Life Version. Copyright © 2014, 2016 by the Tree of Life Bible Society. Used by permission of the Tree of Life Bible Society.",
    kjv: "King James Version (public domain).",
    ylt: "Young’s Literal Translation (public domain)."
  };
  var COPY = {}, SOURCE = {};

  function loadStored(tr) {
    return fetch(MTB.root + "assets/js/bibles-json/" + tr + "/" + SLUG + ".json").then(function (r) {
      if (!r.ok) throw new Error(tr);
      return r.json();
    }).then(function (j) { COPY[tr] = NOTICES[tr] || ""; return (j.chapters || {})[String(CH)] || {}; });
  }

  function loadApi(tr) {
    return fetch("/.netlify/functions/bible?tr=" + tr + "&book=" + encodeURIComponent(SLUG) + "&c=" + CH).then(function (r) {
      return r.json().then(function (j) { if (!r.ok || !j.verses) throw new Error(j.error || "API " + r.status); return j; });
    }).then(function (j) {
      COPY[tr] = j.copyright || NOTICES[tr] || "";
      SOURCE[tr] = "api";
      if (j.fumsToken && window.fums) window.fums("trackView", j.fumsToken);
      return j.verses;
    });
  }

  function loadBible(tr) {
    if (!BIBLE[tr]) {
      BIBLE[tr] = API_TR[tr]
        ? loadApi(tr).catch(function (e) {
            if (window.console) console.warn("API.Bible:", e.message, "- using stored copy");
            SOURCE[tr] = "stored";
            return loadStored(tr);
          })
        : loadStored(tr);
    }
    return BIBLE[tr];
  }

  function copyNotice() {
    var t = COPY[settings.tr];
    if (!t) return "";
    var note = API_TR[settings.tr] && SOURCE[settings.tr] === "stored" ? " <span class=\"sc-warn\">(Live text unavailable; showing the stored copy.)</span>" : "";
    return '<p class="sc-copy">' + esc(t) + note + "</p>";
  }

  function verseHtml(text, n) {
    if (!text) return '<span class="ln">—</span>';
    var t = String(text);
    var words = settings.tr === "nkjv" && D.verses[n] ? (D.verses[n].words || []) : [];
    // Mark word-study words with placeholder characters (in order), then escape, then turn them into spans.
    if (words.length) {
      var pos = 0;
      words.forEach(function (w) {
        var re = new RegExp("(^|[^A-Za-z’'])(" + w[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![A-Za-z])", "g");
        re.lastIndex = pos;
        var m = re.exec(t);
        if (m) {
          var start = m.index + m[1].length;
          var mark = "\u0001" + w[1] + "\u0002" + m[2] + "\u0003";
          t = t.slice(0, start) + mark + t.slice(start + m[2].length);
          pos = start + mark.length;
        }
      });
    }
    var lines;
    if (/\S\s{2,}\S/.test(t)) lines = t.split(/\s{2,}/);
    else if (/[;:,.!?”][A-Za-z“]/.test(t)) lines = t.split(/(?<=[;:,.!?”])(?=[A-Za-z“])/);
    else lines = [t];
    return lines.map(function (ln) {
      var h = esc(ln.trim())
        .replace(/\{([^}]*)\}/g, "<em>$1</em>")
        .replace(/\u0001([a-z]\d+)\u0002([^\u0003]*)\u0003/gi, function (_, s, w) {
          return '<span class="ws" data-s="' + s.toLowerCase() + '">' + w + "</span>";
        });
      return '<span class="ln">' + h + "</span>";
    }).join("");
  }

  /* ---------- Reflections list ---------- */
  function reflList(items, key) {
    if (!items || !items.length) return "";
    var f = reflFilter[key] || "All", cats = ["All"];
    items.forEach(function (r) { if (cats.indexOf(r.cat) < 0) cats.push(r.cat); });
    var html = "";
    if (cats.length > 2 && items.length > 3) {
      html += '<div class="filters" role="group" aria-label="Show reflections">' + cats.map(function (c) {
        return '<button type="button" class="filt" data-filter="' + esc(key) + '" data-cat="' + esc(c) + '" aria-pressed="' + (c === f) + '">' + esc(c) + "</button>";
      }).join("") + "</div>";
    }
    items.forEach(function (r, i) {
      if (f !== "All" && r.cat !== f) return;
      var id = key + "-" + i, o = !!reflOpen[id];
      html += '<div class="refl' + (o ? " open" : "") + '">' +
        '<button type="button" data-refl="' + esc(id) + '" aria-expanded="' + o + '"><span class="r-main"><span class="r-top">' +
        (r.cat ? '<span class="tag">' + esc(r.cat) + "</span>" : "") + '<span class="r-title">' + esc(r.title) + "</span></span>" +
        '<span class="r-q">' + esc(r.q || "") + "</span></span>" +
        '<span class="r-cue">' + (o ? "Close ▴" : "Read ▾") + "</span></button>" +
        '<div class="r-body prose"' + (o ? "" : " hidden") + ">" + r.html + "</div></div>";
    });
    return html;
  }

  /* ---------- One verse's layers ---------- */
  function layersCard(n) {
    var v = D.verses[n] || {}, html = "";
    if (settings.meaning && v.brief) html += '<div class="lc meaning"><h3>The Meaning</h3><p>' + esc(v.brief) + "</p></div>";
    if (settings.explain && v.explain) html += '<div class="lc"><h3>Verse Explanation</h3><div class="prose">' + v.explain + "</div></div>";
    if (settings.hear && v.hearing && v.hearing.length) {
      var all = !!hearAll[n], shown = all ? v.hearing : v.hearing.slice(0, 1), more = v.hearing.length - 1;
      html += '<div class="lc hear"><h3>Hearing God’s Voice</h3>' + shown.map(function (p) {
        return '<div class="pair">' + (p.observe ? '<div class="obs">' + p.observe + "</div>" : "") + (p.hear ? '<div class="hr">' + p.hear + "</div>" : "") + "</div>";
      }).join("") + (more > 0 ? '<button type="button" class="more" data-hear="' + n + '">' + (all ? "Show less" : "Keep listening (" + more + " more)") + "</button>" : "") + "</div>";
    }
    if (settings.refl && v.reflections && v.reflections.length) {
      html += '<div class="lc"><h3>Reflections · ' + v.reflections.length + "</h3>" + reflList(v.reflections, "v" + n) + "</div>";
    }
    if (settings.notes && v.notes) html += '<div class="lc notes"><h3>Study Notes</h3><div class="prose">' + v.notes + "</div></div>";
    if (!html) {
      var any = v.brief || v.explain || (v.hearing && v.hearing.length) || (v.reflections && v.reflections.length) || v.notes;
      html = '<div class="lc"><p class="set-hint">' + (any ? "All the layers for this verse are turned off. Turn some on in Reading settings above." : "No study notes for this verse yet.") + "</p></div>";
    }
    return '<div class="layers-card" id="lc-' + n + '">' + html + "</div>";
  }

  /* ---------- Page ---------- */
  function renderHead(lib) {
    var title = bookTitle(D.book) + " " + CH;
    document.title = title + " · Mastering the Bible";
    var flat = [];
    MTB.books(lib).forEach(function (b) { b.ready.forEach(function (r) { flat.push({ slug: b.slug, name: b.name, n: r.n }); }); });
    var idx = -1;
    flat.forEach(function (x, i) { if (x.slug === SLUG && x.n === CH) idx = i; });
    var prev = flat[idx - 1], next = flat[idx + 1];
    var ov = D.overview || { glance: [], cards: [] }, g = {};
    ov.glance.forEach(function (x) { g[x.label.toLowerCase()] = x.html; });
    var html = '<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html#library">Library</a><span aria-hidden="true">›</span>' +
      '<a href="' + MTB.bookUrl(SLUG) + '">' + esc(D.book) + '</a><span aria-hidden="true">›</span><span>Chapter ' + CH + "</span></nav>" +
      '<div class="ch-titlebar"><h1 id="ch-title">' + esc(title) + '</h1><div class="ch-step">' +
      (prev ? '<a href="' + MTB.chapterUrl(prev.slug, prev.n) + '" aria-label="Previous: ' + esc(bookTitle(prev.name) + " " + prev.n) + '">‹ Prev</a>' : "<span>‹ Prev</span>") +
      (next ? '<a href="' + MTB.chapterUrl(next.slug, next.n) + '" aria-label="Next: ' + esc(bookTitle(next.name) + " " + next.n) + '">Next ›</a>' : "<span>Next ›</span>") +
      "</div></div>";
    if (g["main idea"]) html += '<div class="ch-main-idea">' + g["main idea"].replace(/<\/?p>/g, "") + "</div>";
    var glance = "";
    if (g["setting"]) glance += "<div><b>Setting</b><div>" + g["setting"] + "</div></div>";
    if (g["key verse"]) glance += '<div class="key"><b>Key verse</b>' + g["key verse"] + "</div>";
    if (glance) html += '<div class="ch-glance">' + glance + "</div>";
    if (D.sections.length > 1) {
      html += '<nav class="outline" aria-label="Chapter outline">' + D.sections.map(function (s) {
        return '<a href="#s' + s.start + '"><span>' + ref(s.start, s.end) + "</span>" + esc(s.title) + "</a>";
      }).join("") + "</nav>";
    }
    var cards = ov.cards.filter(function (c) { return c.title !== "Chapter Sections"; });
    if (cards.length) {
      html += '<button type="button" class="deeper-btn" aria-expanded="false" aria-controls="deeper">Go deeper into ' + esc(title) + " ▾</button>" +
        '<div class="deeper" id="deeper" hidden>' + cards.map(function (c) {
          return '<article><h2>' + esc(c.title) + '</h2><div class="prose">' + c.html + "</div></article>";
        }).join("") + "</div>";
    }
    head.innerHTML = html;
    var db = head.querySelector(".deeper-btn");
    if (db) db.addEventListener("click", function () {
      var d = document.getElementById("deeper"), o = d.hidden;
      d.hidden = !o;
      db.setAttribute("aria-expanded", String(o));
      db.textContent = (o ? "Hide details for " : "Go deeper into ") + title + (o ? " ▴" : " ▾");
    });
    return { prev: prev, next: next };
  }

  function has(layer) {
    if (layer === "culture") return !!(D.culture && D.culture.length);
    var key = { meaning: "brief", explain: "explain", hear: "hearing", refl: "reflections", notes: "notes" }[layer];
    for (var k in D.verses) { var v = D.verses[k][key]; if (v && (!Array.isArray(v) || v.length)) return true; }
    return false;
  }

  var ICON_LAYERS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="m2 16 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>';

  function renderBar() {
    var avail = LAYERS.filter(function (l) { return has(l[0]); });
    var on = avail.filter(function (l) { return settings[l[0]]; }).length;  // shown as "on / all six layers"
    var nk = settings.tr === "nkjv", panelOpen = !!(bar.querySelector(".rb-panel") && !bar.querySelector(".rb-panel").hidden);
    bar.hidden = false;
    bar.innerHTML = '<div class="wrap rb-inner">' +
      '<button type="button" class="rb-btn" id="rb-layers" aria-expanded="' + panelOpen + '" aria-controls="rb-panel">' + ICON_LAYERS +
        '<span>Layers</span><span class="rb-count" title="' + on + " of " + LAYERS.length + ' layers showing">' + on + "/" + LAYERS.length + "</span></button>" +
      '<label class="sr-only" for="tr-sel">Translation</label><select class="rb-sel" id="tr-sel">' +
        TRANSLATIONS.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === settings.tr ? " selected" : "") + ">" + t[1] + "</option>"; }).join("") + "</select>" +
      '<button type="button" class="rb-btn rb-ws" data-layer="ws" aria-pressed="' + (!!settings.ws && nk) + '"' + (nk ? "" : ' disabled title="Word-study underlines are available in the NKJV"') +
        ' aria-label="Word-study underlines"><span class="rb-u" aria-hidden="true">ab</span><span class="rb-long">Word studies</span></button>' +
      '<span class="rb-grow"></span>' +
      '<button type="button" class="rb-btn" id="open-all">' + (allOpen() ? "Close all" : "Open all") + "</button>" +
      "</div>" +
      '<div class="rb-panel" id="rb-panel" role="group" aria-label="Layers"' + (panelOpen ? "" : " hidden") + '><div class="rb-panel-in">' +
        '<p class="rb-panel-title">When I open a verse, show</p>' +
        LAYERS.map(function (l) {
          if (avail.indexOf(l) < 0) return '<button type="button" class="tog tog-none" disabled title="Not yet written for this chapter">' + l[1] + '<span class="sr-only"> (not yet written for this chapter)</span></button>';
          return '<button type="button" class="tog" data-layer="' + l[0] + '" aria-pressed="' + !!settings[l[0]] + '">' + l[1] + "</button>";
        }).join("") +
        '<button type="button" class="rb-done" id="rb-done">Done</button>' +
      "</div></div>";
  }

  function render() {
    loadBible(settings.tr).catch(function () { return {}; }).then(function (text) {
      var html = "";
      D.sections.forEach(function (s) {
        html += '<section class="sec" id="s' + s.start + '" aria-labelledby="sh' + s.start + '">';
        if (s.title || D.sections.length > 1) {
          html += '<div class="sec-head"><div class="eyebrow">' + esc(bookTitle(D.book)) + " " + CH + ":" + ref(s.start, s.end) + "</div>" +
            (s.title ? '<h2 id="sh' + s.start + '">' + esc(s.title) + "</h2>" : '<h2 id="sh' + s.start + '" class="sr-only">Verses</h2>') + "</div>";
        } else {
          html += '<h2 id="sh' + s.start + '" class="sr-only">' + esc(bookTitle(D.book) + " " + CH) + "</h2>";
        }
        for (var n = s.start; n <= s.end; n++) {
          var o = !!open[n];
          html += '<div class="verse' + (o ? " open" : "") + '" id="v' + n + '">' +
            '<button type="button" class="v-row" data-v="' + n + '" aria-expanded="' + o + '" aria-controls="lc-' + n + '">' +
            '<span class="v-num">' + n + '</span><span class="v-text">' + verseHtml(text[String(n)], String(n)) + "</span>" +
            '<span class="v-cue">' + (o ? "Close ▴" : "Study ▾") + "</span></button>" +
            (o ? layersCard(String(n)) : "") + "</div>";
        }
        if (settings.refl) {
          (s.groups || []).forEach(function (gr, gi) {
            var gk = "s" + s.start + "-" + gi, go = !!groupOpen[gk];
            html += '<div class="sec-refl' + (go ? " open" : "") + '"><button type="button" class="grp-btn" data-group="' + gk + '" aria-expanded="' + go + '">' +
              '<span class="grp-title">Reflect on ' + esc(bookTitle(D.book)) + " " + CH + ":" + esc(gr.range) + '</span> <span class="grp-count">· ' + gr.items.length + (gr.items.length === 1 ? " reflection" : " reflections") + "</span> " +
              '<span class="grp-cue">' + (go ? "Close ▴" : "Open ▾") + "</span></button>" +
              (go ? '<div class="grp-body">' + reflList(gr.items, gk) + "</div>" : "") + "</div>";
          });
        }
        html += "</section>";
      });
      if (settings.refl && D.whole && D.whole.length) {
        var wo = !!groupOpen.whole;
        html += '<section class="whole' + (wo ? " open" : "") + '" aria-labelledby="whole-h"><button type="button" class="grp-btn" data-group="whole" aria-expanded="' + wo + '">' +
          '<span class="grp-main"><span class="eyebrow">' + esc(bookTitle(D.book)) + " " + CH + ":1–" + D.verseCount + " · " + D.whole.length + ' reflections</span><span class="grp-h2" id="whole-h">' + (D.book === "Psalms" ? "Reflect on the Whole Psalm" : "Reflect on the Whole Chapter") + "</span></span>" +
          '<span class="grp-cue">' + (wo ? "Close ▴" : "Open ▾") + "</span></button>" +
          (wo ? '<div class="grp-body">' + reflList(D.whole, "whole") + "</div>" : "") + "</section>";
      }
      if (settings.culture && D.culture && D.culture.length) {
        html += '<section aria-labelledby="cult-h" class="culture"><div><div class="eyebrow">Culture</div><h2 class="h2" id="cult-h">Living ' + esc(bookTitle(D.book) + " " + CH) + "</h2></div>" +
          D.culture.map(function (c) {
            return '<article class="culture-card"><h3>' + esc(c.title) + "</h3>" + (c.statement ? '<div class="stmt prose">' + c.statement + "</div>" : "") +
              (c.label ? "<h4>" + esc(c.label) + "</h4>" : "") + '<div class="prose">' + c.html + "</div></article>";
          }).join("") + "</section>";
      }
      html += copyNotice();
      var nav = PAGE.nav;
      html += '<nav class="ch-foot" aria-label="Chapters">' +
        (nav.prev ? '<a class="btn btn-outline" href="' + MTB.chapterUrl(nav.prev.slug, nav.prev.n) + '">‹ ' + esc(bookTitle(nav.prev.name) + " " + nav.prev.n) + "</a>" : "<span></span>") +
        (nav.next ? '<a class="btn btn-outline" href="' + MTB.chapterUrl(nav.next.slug, nav.next.n) + '">' + esc(bookTitle(nav.next.name) + " " + nav.next.n) + " ›</a>" : "") + "</nav>";
      var y = window.scrollY;
      main.innerHTML = html;
      main.classList.toggle("ws-on", !!settings.ws && settings.tr === "nkjv");
      renderBar();
      if (refocus) { var f = bar.querySelector(refocus); if (f) f.focus(); refocus = null; }
      window.scrollTo(0, y);
    });
  }

  function allOpen() {
    for (var n = 1; n <= D.verseCount; n++) if (!open[n]) return false;
    return true;
  }

  var PAGE = { nav: {} };

  /* ---------- Events ---------- */
  main.addEventListener("click", function (e) {
    var t = e.target;
    var ws = t.closest(".ws");
    if (ws && main.classList.contains("ws-on")) { e.stopPropagation(); e.preventDefault(); onWordClick(ws); return; }
    var b = t.closest("button");
    if (!b) return;
    if (b.dataset.v) {
      var n = b.dataset.v;
      open[n] = !open[n];
      if (history.replaceState) history.replaceState(null, "", open[n] ? "#v" + n : location.pathname + location.search);
      render();
    } else if (b.dataset.hear) {
      hearAll[b.dataset.hear] = !hearAll[b.dataset.hear]; render();
    } else if (b.dataset.refl) {
      reflOpen[b.dataset.refl] = !reflOpen[b.dataset.refl]; render();
    } else if (b.dataset.filter) {
      reflFilter[b.dataset.filter] = b.dataset.cat; render();
    } else if (b.dataset.group) {
      groupOpen[b.dataset.group] = !groupOpen[b.dataset.group]; render();
    }
  });

  bar.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var panel = bar.querySelector(".rb-panel");
    if (b.id === "rb-layers") {
      panel.hidden = !panel.hidden;
      b.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) panel.querySelector(".tog").focus();
    } else if (b.id === "rb-done") {
      panel.hidden = true; bar.querySelector("#rb-layers").setAttribute("aria-expanded", "false"); bar.querySelector("#rb-layers").focus();
    } else if (b.dataset.layer) {
      settings[b.dataset.layer] = settings[b.dataset.layer] ? 0 : 1; save();
      refocus = '[data-layer="' + b.dataset.layer + '"]';
      render();
    } else if (b.id === "open-all") {
      var to = !allOpen();
      for (var i = 1; i <= D.verseCount; i++) open[i] = to;
      render();
    }
  });
  bar.addEventListener("change", function (e) {
    if (e.target.id === "tr-sel") { settings.tr = e.target.value; save(); render(); }
  });
  document.addEventListener("click", function (e) {
    var panel = bar.querySelector(".rb-panel");
    if (panel && !panel.hidden && e.composedPath().indexOf(bar) < 0) { panel.hidden = true; bar.querySelector("#rb-layers").setAttribute("aria-expanded", "false"); }
  });

  /* ---------- Word-study pop-up ----------
     Computer with a mouse: hover a dotted word for the summary, click it for the full study.
     Phone or tablet: tap a dotted word for the summary card, then tap through for the full study. */
  var hoverT = null, hideT = null, popFor = null;
  function words() { return WORDS || (WORDS = fetch("data/words.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).catch(function () { return {}; })); }
  function wordUrl(s) { return "word.html?s=" + encodeURIComponent(s); }
  function showWord(el, byHover) {
    var s = el.dataset.s;
    words().then(function (w) {
      var info = w[s] || {};
      popFor = el;
      pop.innerHTML = (byHover ? "" : '<button type="button" class="wp-x" aria-label="Close">×</button>') +
        '<div class="wp-top"><span class="wp-word">' + esc(info.w || el.textContent) + '</span><span class="wp-strong">' + esc(s.toUpperCase()) + "</span></div>" +
        '<div class="wp-tr">' + esc(info.t || "") + (info.l ? " · " + esc(info.l) : "") + "</div>" +
        (info.sum ? '<p class="wp-sum">' + esc(trim(info.sum, byHover ? 240 : 420)) + "</p>" : (info.g ? '<p class="wp-sum">Translated: ' + esc(shortGloss(info.g)) + "</p>" : "")) +
        (info.p !== false ? '<a href="' + wordUrl(s) + '">' + (byHover ? "Click the word for the full study" : "Read the full word study →") + "</a>" : "");
      pop.classList.toggle("hovering", !!byHover);
      pop.hidden = false;
      var r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
      var left = Math.max(12, Math.min(window.innerWidth - pw - 12, r.left + r.width / 2 - pw / 2));
      var top = r.bottom + 8 + ph < window.innerHeight ? r.bottom + 8 : Math.max(12, r.top - ph - 8);
      pop.style.left = left + "px"; pop.style.top = top + "px";
      var x = pop.querySelector(".wp-x");
      if (x) { x.addEventListener("click", hideWord); var a = pop.querySelector("a"); (a || x).focus(); }
    });
  }
  function trim(t, n) { if (t.length <= n) return t; var c = t.slice(0, n); return c.slice(0, c.lastIndexOf(" ")).replace(/[,;:]$/, "") + "…"; }
  function shortGloss(g) {
    var seen = {}, out = [];
    String(g).split(/,\s*/).forEach(function (w) { var k = w.toLowerCase().replace(/[’']s$/, ""); if (!seen[k]) { seen[k] = 1; out.push(w); } });
    return out.slice(0, 8).join(", ") + (out.length > 8 ? ", …" : "");
  }
  function hideWord() { pop.hidden = true; popFor = null; }
  function onWordClick(ws) {
    if (FINE) { location.href = wordUrl(ws.dataset.s); return; }
    if (popFor === ws && !pop.hidden) { hideWord(); return; }
    showWord(ws, false);
  }
  if (FINE) {
    main.addEventListener("mouseover", function (e) {
      var ws = e.target.closest && e.target.closest(".ws");
      if (!ws || !main.classList.contains("ws-on")) return;
      clearTimeout(hideT); clearTimeout(hoverT);
      hoverT = setTimeout(function () { showWord(ws, true); }, 220);
    });
    main.addEventListener("mouseout", function (e) {
      var ws = e.target.closest && e.target.closest(".ws");
      if (!ws) return;
      clearTimeout(hoverT);
      hideT = setTimeout(function () { if (pop.classList.contains("hovering")) hideWord(); }, 200);
    });
  }
  document.addEventListener("click", function (e) { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest(".ws")) hideWord(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { hideWord(); var p = bar.querySelector(".rb-panel"); if (p && !p.hidden) { p.hidden = true; bar.querySelector("#rb-layers").focus(); } }
  });
  window.addEventListener("scroll", function () { if (!pop.hidden) hideWord(); }, { passive: true });

  /* ---------- Start ---------- */
  if (!SLUG || !CH) { main.innerHTML = '<p class="notice">Choose a book and chapter to begin.</p>'; head.innerHTML = '<h1 id="ch-title">Choose a passage</h1>'; return; }
  Promise.all([
    MTB.library(),
    fetch("data/chapters/" + SLUG + "-" + CH + ".json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("missing"); return r.json(); })
  ]).then(function (res) {
    D = res[1];
    PAGE.nav = renderHead(res[0]);
    var m = /^#v(\d+)$/.exec(location.hash);
    if (m) open[m[1]] = true;
    render();
    if (m) setTimeout(function () { var el = document.getElementById("v" + m[1]); if (el) el.scrollIntoView(); }, 150);
  }).catch(function () {
    head.innerHTML = '<h1 id="ch-title">Not available yet</h1>';
    main.innerHTML = '<p class="notice">This chapter’s study isn’t on the site yet. <a href="index.html#library">Back to the Library</a> or <button type="button" class="btn btn-outline" data-open-picker>choose another passage</button>.</p>';
  });
})();
