/* Mastering the Bible — The Life of Jesus.
   One page (loc/life-of-jesus.html), several views chosen by the address:
     #/                 home: timeline, ways in, threads, filters
     #/m/6              one movement and its events
     #/e/121            one event, with its seven layers
     #/differences      Seeming Differences
     #/seasons          Advent, Holy Week, Easter   (#/season/holy-week …)
     #/thread/signs     one thread                   (#/find/region/Galilee, #/find/kind/Miracle, #/find/only/luke)
     #/story            The Whole Story in Eight Movements
     #/plan             40-day reading plan
   Data: loc/data/loc.json and loc/data/events/<n>.json, built by scripts/build_loc.py. */
(function () {
  "use strict";

  var ROOT = (window.MTB && MTB.root) || "../";
  var esc = (window.MTB && MTB.esc) || function (s) { return String(s); };
  var app = document.getElementById("loj-app");
  var D = null;                    // loc.json
  var EV = {};                     // n -> event row
  var cache = {};                  // n -> full event
  var bibles = {};                 // book slug -> chapters
  var listFilter = "All";

  var G = {
    matthew: { ab: "Matt", name: "Matthew", cls: "mt", tag: "Mt" },
    mark: { ab: "Mark", name: "Mark", cls: "mk", tag: "Mk" },
    luke: { ab: "Luke", name: "Luke", cls: "lk", tag: "Lk" },
    john: { ab: "John", name: "John", cls: "jn", tag: "Jn" }
  };
  var GOSPELS = ["matthew", "mark", "luke", "john"];
  var TAGS = { Mt: "matthew", Mk: "mark", Lk: "luke", Jn: "john" };
  var OTHER_BOOKS = { "Acts": "acts", "1 Cor": "1-corinthians", "1 Corinthians": "1-corinthians" };
  var CONF = { "Stated": "c-stated", "Strong likelihood": "c-strong", "Reasonable possibility": "c-possible", "Views differ": "c-views" };
  var CONF_ORDER = ["Stated", "Strong likelihood", "Reasonable possibility", "Views differ"];
  var DAYS = ["Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
  var DAY_INFO = {
    "Friday": ["Friday – Saturday", "Bethany", "Six days before the Passover"],
    "Sunday": ["Sunday", "Palm Sunday", "The King comes, gentle and riding on a donkey"],
    "Monday": ["Monday", "Authority", "Fruitless religion exposed"],
    "Tuesday": ["Tuesday", "The long day", "Every question answered, every trap undone"],
    "Wednesday": ["Wednesday", "The quiet day", "While the leaders plot, Judas strikes a deal"],
    "Thursday": ["Thursday", "The Upper Room", "Love to the end"],
    "Good Friday": ["Friday", "Good Friday", "It is finished"],
    "Saturday": ["Saturday", "The Sabbath", "The tomb sealed and guarded"],
    "Resurrection Sunday": ["Sunday", "Resurrection", "He is not here, but is risen"]
  };
  var NKJV = "Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved.";

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function dash(s) { return String(s).replace(/(\d)-(\d)/g, "$1–$2"); }
  function refLabel(g, spec) { return G[g].ab + " " + dash(spec); }
  function link(path) { return "#/" + path; }
  function mv(n) { return D.movements[n - 1]; }
  function gospelsOf(e) { return GOSPELS.filter(function (g) { return e.refs[g]; }); }
  function written(e) { return e.status === "approved" || e.status === "draft"; }

  /* ---------- small pieces ---------- */
  function refChips(e, asLinks) {
    var h = gospelsOf(e).map(function (g) {
      var t = esc(refLabel(g, e.refs[g]));
      return asLinks ? '<a class="loj-ref ' + G[g].cls + '" href="#sbs">' + t + "</a>" : '<span class="loj-ref ' + G[g].cls + '">' + t + "</span>";
    });
    if (e.other) e.other.split(";").forEach(function (o) {
      o = o.trim(); if (o) h.push((asLinks ? '<a class="loj-ref oth" href="#sbs">' : '<span class="loj-ref oth">') + esc(dash(o)) + (asLinks ? "</a>" : "</span>"));
    });
    return h.join("");
  }
  function badges(e, opts) {
    opts = opts || {};
    var b = [];
    if (!opts.noKind) b.push('<span class="loj-badge">' + esc(e.kind) + "</span>");
    var gs = gospelsOf(e);
    if (gs.length === 1 && e.kind !== "Prologue") b.push('<span class="loj-badge only">Only in ' + G[gs[0]].name + "</span>");
    if (e.fit && e.fit.length) b.push('<span class="loj-badge diff">Seeming difference</span>');
    if (e.status === "draft") b.push('<span class="loj-badge draft">Draft</span>');
    if (!written(e) && !opts.noSoon) b.push('<span class="loj-badge soon">Study coming</span>');
    return b.join("");
  }
  function eventCard(e) {
    var sub = e.summary || [e.place, e.when].filter(Boolean).join(" · ");
    return '<a class="loj-ev' + (written(e) ? " written" : "") + '" href="' + link("e/" + e.n) + '">' +
      '<span class="t"><span class="n">' + e.n + "</span><strong>" + esc(e.title) + "</strong></span>" +
      '<span class="s">' + esc(sub) + "</span>" +
      '<span class="row">' + refChips(e) + "</span>" +
      '<span class="row">' + badges(e) + "</span></a>";
  }
  function head(o) {
    return '<section class="loj-head' + (o.hero ? " loj-hero" : "") + '"><div class="wrap">' +
      (o.back ? '<a class="loj-back" href="' + o.back[0] + '">← ' + esc(o.back[1]) + "</a>" : "") +
      (o.eyebrow ? '<div class="eyebrow">' + o.eyebrow + "</div>" : "") +
      "<h1>" + esc(o.title) + "</h1>" +
      (o.tag ? '<p class="tag">' + esc(o.tag) + "</p>" : "") +
      (o.meta ? '<div class="meta">' + o.meta + "</div>" : "") +
      (o.text ? "<p>" + esc(o.text) + "</p>" : "") +
      (o.progress ? '<div class="loj-progress" aria-hidden="true"><i style="width:' + o.progress + '%"></i></div>' : "") +
      "</div></section>";
  }
  function chipsRow(items) {
    return '<div class="loj-chips">' + items.map(function (i) {
      return '<a class="loj-chip' + (i[2] ? " " + i[2] : "") + '" href="' + i[1] + '">' + esc(i[0]) + "</a>";
    }).join("") + "</div>";
  }
  function copyLine() { return '<p class="loj-copy">' + NKJV + "</p>"; }
  function render(html) { app.innerHTML = html; window.scrollTo(0, 0); }

  /* ---------- Home ---------- */
  function viewHome() {
    var last = parseInt(store("loj-last") || "", 10);
    var lastEv = EV[last];
    var h = head({ hero: true, eyebrow: "The Gospels · " + D.events.length + " events", title: "The Life of Jesus", tag: "One story. Four witnesses.", text: D.intro });
    h += '<main class="wrap loj-main">';
    h += '<div class="loj-top"><a class="loj-cta" href="' + link("story") + '"><span class="k">New here? Start with the story</span>' +
      "<strong>The Whole Story in Eight Movements</strong><span>A 10-minute read from Bethlehem to the empty tomb.</span>" +
      '<span class="btn">Read the story</span></a>';
    h += lastEv ? '<a class="loj-resume" href="' + link("e/" + lastEv.n) + '"><span>Pick up where you left off<b>' + lastEv.n + " · " + esc(lastEv.title) + "</b></span>›</a>"
      : '<a class="loj-resume" href="' + link("differences") + '"><span>Do the Gospels contradict each other?<b>See the Seeming Differences</b></span>›</a>';
    h += "</div>";

    h += '<section class="loj-sec"><h2>Walk the Timeline</h2><p class="lede">About 33 years, with three years of public ministry. The gold markers are the Passovers John mentions; they are how we know the ministry lasted about three years. Dates are approximate.</p><div class="loj-moves">';
    var maxc = Math.max.apply(null, D.movements.map(function (m) { return m.count; }));
    D.movements.forEach(function (m) {
      var before = [], after = [];
      D.events.forEach(function (e) {
        if (e.passover && e.movement === m.n) (e.n === m.first ? before : after).push(e.passover);
      });
      before.forEach(function (p) { h += '<div class="loj-pass">' + esc(p) + "</div>"; });
      var done = D.events.filter(function (e) { return e.movement === m.n && written(e); }).length;
      h += '<a class="loj-move" href="' + link("m/" + m.n) + '"><span class="num">' + m.n + '</span><span class="body"><strong>' + esc(m.title) + "</strong>" +
        '<span class="m">' + esc(m.when) + " · " + m.count + " events" + (done ? " · " + done + " written" : "") + "</span>" +
        '<span class="d">' + esc(m.summary) + '</span><span class="loj-bar"><i style="width:' + Math.round(m.count / maxc * 100) + '%"></i></span></span></a>';
      after.forEach(function (p) { h += '<div class="loj-pass">' + esc(p) + "</div>"; });
    });
    h += "</div></section>";

    h += '<section class="loj-sec"><h2>Ways In</h2><p class="lede">Different doors into the same story.</p><div class="loj-tiles">' +
      tile("seasons", "Seasons", "Advent, Holy Week day by day, and Easter morning in order.") +
      tile("differences", "Seeming Differences", "Where the accounts seem to disagree, and how they fit.") +
      tile("plan", "40-Day Reading Plan", "Walk through the whole life of Christ in forty days.") +
      tile("story", "The Whole Story", "The life of Jesus in eight movements, start to finish.") + "</div></section>";

    h += '<section class="loj-sec"><h2>Follow a Thread</h2><p class="lede">Trace one theme across the whole story.</p>' +
      chipsRow(D.threads.map(function (t) { return [t.title, link("thread/" + t.id)]; })) + "</section>";

    var regions = ["Bethlehem", "Nazareth", "Galilee", "Beyond Galilee", "Samaria", "Judea", "Perea", "Jerusalem"];
    var kinds = ["Miracle", "Parable", "Teaching", "Encounter", "Conflict", "Milestone", "Appearance"];
    h += '<section class="loj-sec"><h2>Find Events By</h2>' +
      '<div class="loj-label">Place</div>' + chipsRow(regions.map(function (r) { return [r, link("find/region/" + encodeURIComponent(r))]; })) +
      '<div class="loj-label">Kind of event</div>' + chipsRow(kinds.map(function (k) { return [k, link("find/kind/" + k)]; })) +
      '<div class="loj-label">Told only by</div>' + chipsRow(GOSPELS.map(function (g) { return [G[g].name, link("find/only/" + g), "g-" + G[g].cls]; })) +
      '<div class="loj-label">Studies</div>' + chipsRow([["Written so far", link("find/status/written")]]) +
      "</section>";
    h += copyLine() + "</main>";
    render(h);
  }
  function tile(path, t, s) { return '<a class="loj-tile" href="' + link(path) + '"><strong>' + t + "</strong><span>" + s + "</span></a>"; }

  /* ---------- Lists ---------- */
  function filterBar(list, key) {
    var kinds = ["All"];
    list.forEach(function (e) { if (kinds.indexOf(e.kind) < 0) kinds.push(e.kind); });
    if (kinds.length <= 2) return "";
    if (kinds.indexOf(listFilter) < 0) listFilter = "All";
    return '<div class="loj-chips" data-filter>' + kinds.map(function (k) {
      return '<button type="button" class="loj-chip' + (k === listFilter ? " on" : "") + '" data-kind="' + esc(k) + '" aria-pressed="' + (k === listFilter) + '">' + esc(k) + "</button>";
    }).join("") + "</div>";
  }
  function listHtml(list) {
    var shown = list.filter(function (e) { return listFilter === "All" || e.kind === listFilter; });
    return '<div class="loj-events" data-list>' + shown.map(eventCard).join("") + "</div>";
  }
  function wireFilter(list) {
    var bar = app.querySelector("[data-filter]");
    if (!bar) return;
    bar.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-kind]"); if (!b) return;
      listFilter = b.getAttribute("data-kind");
      Array.prototype.forEach.call(bar.querySelectorAll("button"), function (x) {
        var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", String(on));
      });
      app.querySelector("[data-list]").outerHTML = listHtml(list);
    });
  }

  function viewMovement(n) {
    var m = mv(n); if (!m) return viewHome();
    var list = D.events.filter(function (e) { return e.movement === n; });
    var h = head({ back: [link(""), "The Life of Jesus"], eyebrow: "Movement " + n + " of " + D.movements.length, title: m.title,
      meta: esc(m.when) + " · Events " + m.first + "–" + m.last });
    h += '<main class="wrap loj-main"><div>';
    if (m.intro) h += '<p class="loj-summary" style="margin-bottom:12px">' + esc(m.intro) + "</p>";
    if (m.order_note) h += '<div class="loj-note"><span><b>Order note.</b> ' + esc(m.order_note) + "</span></div>";
    h += "</div>" + filterBar(list) + listHtml(list);
    h += '<div class="loj-pn">' + (n > 1 ? '<a href="' + link("m/" + (n - 1)) + '"><small>← Movement ' + (n - 1) + "</small><b>" + esc(mv(n - 1).title) + "</b></a>" : "<span></span>") +
      (n < D.movements.length ? '<a class="next" href="' + link("m/" + (n + 1)) + '"><small>Movement ' + (n + 1) + " →</small><b>" + esc(mv(n + 1).title) + "</b></a>" : "") + "</div>";
    h += copyLine() + "</main>";
    render(h); wireFilter(list);
  }

  function viewList(title, eyebrow, text, list, back) {
    var h = head({ back: back || [link(""), "The Life of Jesus"], eyebrow: eyebrow, title: title, text: text, meta: list.length + (list.length === 1 ? " event" : " events") });
    h += '<main class="wrap loj-main">' + filterBar(list) + (list.length ? listHtml(list) : '<p class="lede">No events here yet.</p>') + copyLine() + "</main>";
    render(h); wireFilter(list);
  }
  function viewThread(id) {
    var t = D.threads.filter(function (x) { return x.id === id; })[0]; if (!t) return viewHome();
    viewList(t.title, "Follow a thread", "", D.events.filter(function (e) { return e.threads.indexOf(id) >= 0; }));
  }
  function viewFind(type, val) {
    val = decodeURIComponent(val || "");
    var list = [], title = val, eb = "Find events";
    if (type === "region") { list = D.events.filter(function (e) { return e.region === val; }); eb = "Place"; }
    else if (type === "kind") { list = D.events.filter(function (e) { return e.kind === val; }); title = val + (val.slice(-1) === "y" ? "" : "s"); eb = "Kind of event"; if (val === "Miracle") title = "Miracles"; }
    else if (type === "only" && G[val]) { list = D.events.filter(function (e) { var g = gospelsOf(e); return g.length === 1 && g[0] === val && e.kind !== "Prologue"; }); title = "Only in " + G[val].name; eb = "Told only by"; }
    else if (type === "status") { list = D.events.filter(written); title = "Written So Far"; eb = "Studies"; }
    viewList(title, eb, "", list);
  }

  /* ---------- Seasons ---------- */
  function viewSeasons() {
    var h = head({ back: [link(""), "The Life of Jesus"], eyebrow: "Ways in", title: "Seasons", text: "The parts of the story the church returns to every year." });
    h += '<main class="wrap loj-main"><div class="loj-tiles">' +
      tile("season/advent", "Advent and Christmas", "From the angel’s promise to the boy in the temple.") +
      tile("season/holy-week", "Holy Week, Day by Day", "From Bethany to the tomb, one day at a time.") +
      tile("season/easter", "Easter and the Forty Days", "The empty tomb, the appearances, the ascension.") +
      "</div>" + copyLine() + "</main>";
    render(h);
  }
  function viewSeason(id) {
    if (id === "advent") return viewList("Advent and Christmas", "Seasons", "His coming foretold, His birth, and His childhood.", D.events.filter(function (e) { return e.movement === 1; }), [link("seasons"), "Seasons"]);
    if (id === "easter") return viewList("Easter and the Forty Days", "Seasons", "From the empty tomb to the ascension.", D.events.filter(function (e) { return e.movement === 8; }), [link("seasons"), "Seasons"]);
    if (id !== "holy-week") return viewSeasons();
    var h = head({ back: [link("seasons"), "Seasons"], eyebrow: "Seasons · Movement 7", title: "Holy Week, Day by Day",
      text: "About a third of the Gospels covers these eight days. Walk through them in order, from Bethany to the empty tomb." });
    h += '<main class="wrap loj-main"><div class="loj-note"><span><b>For pastors:</b> each day works as a Holy Week reading, a Lent series or a Good Friday service. The days follow the usual reckoning; a few placements are debated.</span></div>';
    var order = [], groups = {}, afterPalm = false;
    D.events.forEach(function (e) {
      if (!e.day) return;
      var key = e.day;
      if (key === "Sunday") afterPalm = true;
      if (!afterPalm && (key === "Friday" || key === "Saturday")) key = "Friday";   // arrival and anointing at Bethany
      else if (afterPalm && key === "Friday") key = "Good Friday";
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(e);
    });
    order.forEach(function (k) {
      var info = DAY_INFO[k] || [k, "", ""];
      h += '<div><h2 class="loj-day">' + esc(info[0]) + "<small>" + esc(info[1]) + '</small></h2><p class="lede" style="font-family:var(--serif);font-style:italic;margin:4px 0 10px">' + esc(info[2]) + '</p><div class="loj-events">' + groups[k].map(eventCard).join("") + "</div></div>";
    });
    h += copyLine() + "</main>";
    render(h);
  }

  /* ---------- Seeming Differences ---------- */
  var diffFilter = "All";
  function viewDifferences() {
    var items = [];
    D.events.forEach(function (e) { (e.fit || []).forEach(function (f) { items.push({ e: e, f: f }); }); });
    var h = head({ back: [link(""), "The Life of Jesus"], eyebrow: "Ways in", title: "Seeming Differences",
      text: "Four honest witnesses never tell a story in exactly the same words. Here are the places the Gospels seem to disagree, how the accounts fit, and how sure we can be." });
    h += '<main class="wrap loj-main"><section class="loj-sec"><div class="loj-label" style="margin-top:0">How sure can we be?</div><div class="loj-legend">' +
      '<div><span class="loj-conf c-stated">Stated</span> The Bible itself settles it.</div>' +
      '<div><span class="loj-conf c-strong">Strong likelihood</span> A natural reading that fits all the facts.</div>' +
      '<div><span class="loj-conf c-possible">Reasonable possibility</span> More than one good answer.</div>' +
      '<div><span class="loj-conf c-views">Views differ</span> Faithful scholars land in different places.</div></div></section>';
    h += '<div class="loj-chips" data-dfilter>' + ["All"].concat(CONF_ORDER).map(function (c) {
      return '<button type="button" class="loj-chip' + (c === diffFilter ? " on" : "") + '" data-c="' + c + '">' + c + "</button>";
    }).join("") + "</div>";
    h += '<div data-dlist></div><p class="lede">' + items.length + " so far. More are added as each event is written.</p>" + copyLine() + "</main>";
    render(h);
    function draw() {
      var shown = items.filter(function (x) { return diffFilter === "All" || x.f.c === diffFilter; });
      app.querySelector("[data-dlist]").innerHTML = '<div class="loj-dlist">' + shown.map(function (x) {
        var refs = gospelsOf(x.e).map(function (g) { return refLabel(g, x.e.refs[g]); }).join(" · ");
        return '<a class="loj-d" href="' + link("e/" + x.e.n) + '"><strong>' + esc(x.f.q) + '</strong><span class="r">' + esc(refs) + '</span><span class="a">' + esc(x.f.short) +
          '</span><span class="loj-chips" style="align-items:center"><span class="loj-conf ' + (CONF[x.f.c] || "") + '">' + esc(x.f.c) + '</span><span class="loj-small">Event ' + x.e.n + " · " + esc(x.e.title) + "</span></span></a>";
      }).join("") + "</div>" + (shown.length ? "" : '<p class="lede">None yet in this group.</p>');
    }
    draw();
    app.querySelector("[data-dfilter]").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      diffFilter = b.getAttribute("data-c");
      Array.prototype.forEach.call(this.querySelectorAll("button"), function (x) { x.classList.toggle("on", x === b); });
      draw();
    });
  }

  /* ---------- The Whole Story ---------- */
  function viewStory() {
    var h = head({ back: [link(""), "The Life of Jesus"], eyebrow: "The Whole Story" + (D.story_status === "draft" ? ' · <span class="loj-badge draft">Draft</span>' : ""), title: "The Life of Jesus in Eight Movements", text: "A ten-minute read from before the beginning to the ascension." });
    h += '<main class="wrap loj-main"><article class="loj-read">';
    D.movements.forEach(function (m) {
      h += "<h2>" + m.n + ". " + esc(m.title) + '</h2><div class="m">' + esc(m.when) + " · Events " + m.first + "–" + m.last + "</div>";
      (m.story || []).forEach(function (p) { h += "<p>" + esc(p) + "</p>"; });
      h += '<a class="more" href="' + link("m/" + m.n) + '">Walk through Movement ' + m.n + " →</a>";
    });
    h += "</article>" + copyLine() + "</main>";
    render(h);
  }

  /* ---------- 40-day plan ---------- */
  function viewPlan() {
    var total = 40, sizes = D.movements.map(function (m) { return m.count; }), sum = D.events.length;
    var days = sizes.map(function (s) { return Math.max(1, Math.floor(s / sum * total)); });
    var rem = sizes.map(function (s, i) { return { i: i, r: s / sum * total - days[i] }; }).sort(function (a, b) { return b.r - a.r; });
    var k = 0;
    while (days.reduce(function (a, b) { return a + b; }, 0) < total) { days[rem[k % rem.length].i]++; k++; }
    var plan = [];
    D.movements.forEach(function (m, i) {
      var evs = D.events.filter(function (e) { return e.movement === m.n; }), d = days[i];
      for (var j = 0; j < d; j++) {
        var a = Math.round(j * evs.length / d), b = Math.round((j + 1) * evs.length / d);
        if (b > a) plan.push({ m: m, evs: evs.slice(a, b) });
      }
    });
    var h = head({ back: [link(""), "The Life of Jesus"], eyebrow: "Ways in", title: "40-Day Reading Plan", text: "Read a few events a day and walk through the whole life of Christ in forty days. Tap a day to begin with its first event." });
    h += '<main class="wrap loj-main"><div class="loj-plan">' + plan.map(function (p, i) {
      var f = p.evs[0], l = p.evs[p.evs.length - 1];
      return '<a href="' + link("e/" + f.n) + '"><b>Day ' + (i + 1) + " · " + esc(p.m.title) + "</b><span>" + p.evs.map(function (e) { return esc(e.title); }).join(" · ") +
        '</span><span class="loj-small">Events ' + f.n + (l.n !== f.n ? "–" + l.n : "") + "</span></a>";
    }).join("") + "</div>" + copyLine() + "</main>";
    render(h);
  }

  /* ---------- Scripture (Side by Side) ---------- */
  function bible(book) {
    if (!bibles[book]) {
      bibles[book] = fetch(ROOT + "assets/js/bibles-json/nkjv/" + book + ".json").then(function (r) {
        if (!r.ok) throw new Error(book); return r.json();
      }).then(function (j) { return j.chapters || {}; });
    }
    return bibles[book];
  }
  function passage(book, spec) {
    return bible(book).then(function (chs) {
      var out = [], ch = null;
      spec.split(",").forEach(function (part) {
        part = part.trim(); if (!part) return;
        var m = part.match(/^(\d+):(\d+)-(\d+):(\d+)$/);
        if (m) {
          for (var c = +m[1]; c <= +m[3]; c++) {
            var vs = chs[String(c)] || {}, keys = Object.keys(vs).map(Number);
            var lo = c === +m[1] ? +m[2] : 1, hi = c === +m[3] ? +m[4] : Math.max.apply(null, keys);
            for (var v = lo; v <= hi; v++) if (vs[v] != null) out.push([c, v, vs[v]]);
          }
          ch = +m[3]; return;
        }
        m = part.match(/^(?:(\d+):)?(\d+)(?:-(\d+))?$/);
        if (!m) return;
        if (m[1]) ch = +m[1];
        var vs2 = chs[String(ch)] || {};
        for (var v2 = +m[2]; v2 <= +(m[3] || m[2]); v2++) if (vs2[v2] != null) out.push([ch, v2, vs2[v2]]);
      });
      return out;
    });
  }
  function versesHtml(vs) {
    var h = "", last = null, multi = vs.length && vs[0][0] !== vs[vs.length - 1][0];
    vs.forEach(function (x) {
      if (multi && x[0] !== last) h += '<span class="ch">Chapter ' + x[0] + "</span>";
      last = x[0];
      h += "<sup>" + x[1] + "</sup>" + esc(String(x[2]).replace(/\s+/g, " ")) + " ";
    });
    return h || "<em>Text not available.</em>";
  }
  function fillScripture(e) {
    var host = app.querySelector("[data-sbs]"); if (!host) return;
    var accts = [];
    GOSPELS.forEach(function (g) { if (e.refs[g]) accts.push({ cls: G[g].cls, label: G[g].name + " " + dash(e.refs[g]), book: g, spec: e.refs[g] }); });
    (e.other || "").split(";").forEach(function (o) {
      o = o.trim(); var m = o.match(/^(\d?\s?[A-Za-z]+)\s+([\d:,\-]+)$/);
      if (m && OTHER_BOOKS[m[1]]) accts.push({ cls: "oth", label: dash(o), book: OTHER_BOOKS[m[1]], spec: m[2] });
    });
    var gs = gospelsOf(e);
    var missing = gs.length >= 3 ? GOSPELS.filter(function (g) { return !e.refs[g]; }) : [];
    host.innerHTML = accts.map(function (a, i) { return '<div class="loj-acct ' + a.cls + (accts.length === 1 ? " solo" : "") + '"><h4>' + esc(a.label) + '</h4><div class="tx" data-acct="' + i + '">Loading…</div></div>'; }).join("") +
      missing.map(function (g) { return '<div class="loj-acct none ' + G[g].cls + '"><h4>' + G[g].name + '</h4><div class="tx">' + G[g].name + " does not record this event.</div></div>"; }).join("");
    accts.forEach(function (a, i) {
      passage(a.book, a.spec).then(function (vs) { host.querySelector('[data-acct="' + i + '"]').innerHTML = versesHtml(vs); })
        .catch(function () { host.querySelector('[data-acct="' + i + '"]').textContent = "The text could not be loaded."; });
    });
  }

  /* ---------- One event ---------- */
  function storyHtml(p) {
    return esc(p).replace(/\s*\{(Mt|Mk|Lk|Jn)\}/g, function (all, t) {
      var g = G[TAGS[t]]; return '<span class="loj-src ' + g.cls + '" title="' + g.name + '">' + t + "</span>";
    });
  }
  function storyNote(e) {
    var gs = gospelsOf(e);
    if (gs.length > 1) return "Retold by MTB from all " + ["", "", "two", "three", "four"][gs.length] + " accounts. Quotations are from the NKJV; the tags show which Gospel a detail comes from.";
    if (gs.length === 1) return "Retold by MTB from " + G[gs[0]].name + "’s account. Quotations are from the NKJV.";
    return "Retold by MTB. Quotations are from the NKJV.";
  }
  function layer(title, sub, body, id) {
    return '<details class="loj-layer" open' + (id ? ' id="' + id + '"' : "") + '><summary><span><span class="lt">' + title + '</span><span class="ls">' + sub + "</span></span></summary><div class=\"loj-lb\">" + body + "</div></details>";
  }
  function labelled(items) {
    return "<ul>" + (items || []).map(function (s) { return "<li><b>" + esc(s.label) + (/[.?!]$/.test(s.label) ? "" : ".") + "</b> " + esc(s.text) + "</li>"; }).join("") + "</ul>";
  }
  function chapterLink(text) {
    var m = String(text || "").match(/^(Matthew|Mark|Luke|John)\s+(\d+)/);
    if (!m || !window.MTB || !MTB.library) return Promise.resolve("");
    var slug = m[1].toLowerCase(), c = +m[2];
    return MTB.library().then(function (lib) {
      var b = MTB.books(lib).filter(function (x) { return x.slug === slug; })[0];
      var ok = b && b.ready.some(function (r) { return r.n === c; });
      return ok ? '<a href="' + MTB.chapterUrl(slug, c) + '">Open ' + m[1] + " " + c + " in Chapter Study</a>" : "";
    }).catch(function () { return ""; });
  }

  function viewEvent(n) {
    var e = EV[n]; if (!e) return viewHome();
    store("loj-last", String(n));
    var m = mv(e.movement);
    var meta = [esc(e.when), esc(e.place)];
    if (e.day) meta.push(esc(e.day === "Resurrection Sunday" ? "Resurrection Sunday" : "Holy Week · " + e.day));
    var top = head({ back: [link("m/" + e.movement), e.movement + " · " + m.title], eyebrow: "Event " + n + " of " + D.events.length, title: e.title,
      meta: meta.filter(Boolean).join(" · "), progress: Math.round(n / D.events.length * 100) });
    function finish(full) {
      var h = top + '<section class="loj-glance"><div class="wrap"><div class="loj-chips">' + refChips(e, true) +
        (gospelsOf(e).length === 3 ? GOSPELS.filter(function (g) { return !e.refs[g]; }).map(function (g) { return '<span class="loj-ref none">Not in ' + G[g].name + "</span>"; }).join("") : "") + "</div>";
      if (full) {
        h += '<p class="loj-summary">' + esc(full.summary) + "</p>";
        if (full.key_insight) h += '<div class="loj-key"><div class="k">Key insight</div><p>' + esc(full.key_insight) + "</p></div>";
      }
      h += '<div class="loj-chips">' + badges(e, { noSoon: true }) + (e.passover ? '<span class="loj-badge diff">' + esc(e.passover) + "</span>" : "") + "</div></div></section>";
      h += '<main class="wrap loj-main"><div class="loj-layers-bar"><div class="loj-label">Go deeper</div><button type="button" class="loj-openall" data-toggle-all>Close all</button></div><div class="loj-layers">';
      if (full) {
        h += layer("The Story", gospelsOf(e).length > 1 ? "All the accounts, woven into one telling" : "The event, retold",
          '<div class="loj-story">' + (full.story || []).map(function (p) { return "<p>" + storyHtml(p) + "</p>"; }).join("") +
          '</div><p class="loj-small">' + storyNote(e) + "</p>");
      } else {
        h += '<div class="loj-soon"><b>The written study for this event is coming.</b> For now you can read the accounts side by side below.</div>';
      }
      var diffs = full && full.differences && full.differences.length ? '<div class="loj-box"><div class="k">What differs</div><ul>' + full.differences.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul></div>" : "";
      h += layer("Side by Side", gospelsOf(e).length > 1 ? "The actual words of each account (NKJV)" : "The passage (NKJV)", diffs + '<div class="loj-sbs" data-sbs></div>', "sbs");
      if (full) {
        if (full.fit && full.fit.length) {
          h += layer("How the Accounts Fit", esc(full.fit[0].question.length < 70 ? full.fit[0].question : "Where the accounts seem to differ"), full.fit.map(function (f) {
            return '<div class="loj-fit"><p><b>The question.</b> ' + esc(f.question) + "</p><p><b>How they fit.</b></p>" + labelled(f.points) +
              '<div class="loj-label">How sure can we be?</div><div class="loj-scale">' + CONF_ORDER.map(function (c) { return '<span class="' + (c === f.confidence ? "on" : "") + '">' + c + "</span>"; }).join("") + "</div>" +
              (f.note ? '<p class="loj-small" style="font-size:16px">' + esc(f.note) + "</p>" : "") + "</div>";
          }).join("") + '<p><a href="' + link("differences") + '">See all Seeming Differences →</a></p>');
        }
        if (full.scene && full.scene.length) h += layer("Behind the Scene", "The world Jesus was walking through", labelled(full.scene));
        var gs = gospelsOf(e), w = full.witnesses || {};
        var wit = (gs.length >= 3 ? GOSPELS : gs).map(function (g) {
          return w[g] ? '<div class="loj-wit ' + G[g].cls + '"><b>' + G[g].name + "</b><span>" + esc(w[g]) + "</span></div>"
            : '<div class="loj-wit none ' + G[g].cls + '"><b>' + G[g].name + "</b><span>Does not record this event.</span></div>";
        }).join("");
        if (wit) h += layer(gs.length > 1 ? "Four Witnesses" : "The Witness", gs.length > 1 ? "What each writer noticed, and why" : "Why " + (G[gs[0]] ? G[gs[0]].name : "this Gospel") + " tells it", wit);
        if (full.seeing) h += layer("Seeing Jesus", "What this shows us about Him, and how to respond",
          '<p class="loj-story" style="font-family:var(--serif);font-size:19px">' + esc(full.seeing.reveals) + "</p>" +
          '<div class="loj-box"><div class="k">Living it</div><p>' + esc(full.seeing.living) + "</p></div>" +
          '<div class="loj-box warm"><div class="k">Ponder and pray</div><p>' + esc(full.seeing.ponder) + "</p></div>");
        var pr = full.preaching || {};
        if (pr.big_idea) h += layer("Preaching Handle", "For the pastor and teacher",
          '<div class="loj-label" style="margin-top:0">Big idea</div><p class="loj-big">' + esc(pr.big_idea) + "</p>" +
          '<div class="loj-label">A natural outline (' + esc(dash(pr.text || "")) + ")</div><ol>" + (pr.outline || []).map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("") + "</ol>" +
          (pr.watch_for ? '<div class="loj-box"><div class="k">Watch for</div><p>' + esc(pr.watch_for) + "</p></div>" : "") +
          '<div class="loj-label">Related</div><div class="loj-links" data-related>' + (full.related || []).map(function (r) { return '<a href="' + link("e/" + r.n) + '">' + r.n + " · " + esc(r.title) + "</a>"; }).join("") +
          (pr.related_other || []).map(function (o) { return '<span class="loj-small" style="padding:8px 0">' + esc(o) + "</span>"; }).join("") + "</div>");
      }
      h += "</div>";
      var prev = EV[n - 1], next = EV[n + 1];
      h += '<div class="loj-pn">' + (prev ? '<a href="' + link("e/" + prev.n) + '"><small>← Previous · ' + prev.n + "</small><b>" + esc(prev.title) + "</b></a>" : "<span></span>") +
        (next ? '<a class="next" href="' + link("e/" + next.n) + '"><small>Next · ' + next.n + " →</small><b>" + esc(next.title) + "</b></a>" : "") + "</div>";
      h += copyLine() + "</main>";
      render(h);
      fillScripture(e);
      var tog = app.querySelector("[data-toggle-all]");
      tog.addEventListener("click", function () {
        var ds = app.querySelectorAll("details.loj-layer"), anyOpen = Array.prototype.some.call(ds, function (d) { return d.open; });
        Array.prototype.forEach.call(ds, function (d) { d.open = !anyOpen; });
        tog.textContent = anyOpen ? "Open all" : "Close all";
      });
      if (full && full.preaching) chapterLink(full.preaching.text).then(function (a) {
        var host = app.querySelector("[data-related]"); if (a && host) host.insertAdjacentHTML("beforeend", a);
      });
      document.title = e.title + " · The Life of Jesus · Mastering the Bible";
    }
    if (!written(e)) return finish(null);
    if (cache[n]) return finish(cache[n]);
    app.innerHTML = top + '<p class="wrap loj-loading">Loading…</p>';
    fetch("data/events/" + n + ".json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (full) { cache[n] = full; finish(full); })
      .catch(function () { finish(null); });
  }

  /* ---------- Router ---------- */
  function route() {
    var p = (location.hash || "#/").replace(/^#\/?/, "").split("/");
    document.title = "The Life of Jesus · Mastering the Bible";
    switch (p[0]) {
      case "m": return viewMovement(parseInt(p[1], 10));
      case "e": return viewEvent(parseInt(p[1], 10));
      case "differences": return viewDifferences();
      case "seasons": return viewSeasons();
      case "season": return viewSeason(p[1]);
      case "thread": return viewThread(p[1]);
      case "find": return viewFind(p[1], p[2]);
      case "story": return viewStory();
      case "plan": return viewPlan();
      default: return viewHome();
    }
  }

  fetch("data/loc.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      D = d; d.events.forEach(function (e) { EV[e.n] = e; });
      // Old links: life-of-jesus.html?loc=121 or loc.html?loc=121
      var q = new URLSearchParams(location.search).get("loc");
      if (q && !location.hash) location.replace("#/e/" + parseInt(q, 10));
      route();
      window.addEventListener("hashchange", route);
    })
    .catch(function () { app.innerHTML = '<p class="wrap loj-loading">The Life of Jesus could not be loaded. Please refresh the page.</p>'; });
})();
