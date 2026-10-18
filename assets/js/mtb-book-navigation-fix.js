(function () {
  "use strict";

  function normalizeRootLink(link) {
    var href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#" || /^(https?:|mailto:|tel:|javascript:)/i.test(href)) {
      return;
    }

    if (/^(book|chapter)\.html(?:\?|$)/i.test(href)) {
      link.setAttribute("href", "/" + href.replace(/^\/+/, ""));
    }
  }

  function repairNavigation(root) {
    (root || document).querySelectorAll("a[href]").forEach(normalizeRootLink);

    (root || document).querySelectorAll("[data-href]").forEach(function (item) {
      var href = item.getAttribute("data-href");
      if (/^(book|chapter)\.html(?:\?|$)/i.test(href || "")) {
        item.setAttribute("data-href", "/" + href.replace(/^\/+/, ""));
      }
    });
  }

  function handleStudyControls(event) {
    var button = event.target.closest ? event.target.closest("[data-mtb-study-action]") : null;
    if (!button) return;

    var root = button.closest ? button.closest(".mtb-chapter-study") : null;
    if (!root) return;

    var action = button.getAttribute("data-mtb-study-action");
    var shouldOpen = action === "expand";
    if (!shouldOpen && action !== "collapse") return;

    var panels = root.querySelectorAll("details.mtb-study-verse");
    for (var i = 0; i < panels.length; i++) {
      panels[i].open = shouldOpen;
    }

    event.preventDefault();
  }

  document.addEventListener("click", handleStudyControls);

  // -------------------------------------------------------------
  // Chapter Overview / Study / Hearing / Reflections tab compatibility
  // -------------------------------------------------------------
  // Deliberately finite: do NOT observe the tabs container. The earlier
  // MutationObserver-based repair could retrigger itself after moving tabs,
  // producing an endless stream of availability requests.
  var mtbEditorialTabRepairKey = "";

  function mtbEditorialContext() {
    var p = new URLSearchParams(window.location.search);
    var book = String(p.get("book") || "").toLowerCase().trim().replace(/\s+/g, "-");
    if (book === "psalm") book = "psalms";

    var chapter = parseInt(p.get("chapter") || "0", 10);
    if (!book || !Number.isFinite(chapter) || chapter < 1) return null;

    var nt = {
      "matthew":1,"mark":1,"luke":1,"john":1,"acts":1,"romans":1,
      "1-corinthians":1,"2-corinthians":1,"galatians":1,"ephesians":1,
      "philippians":1,"colossians":1,"1-thessalonians":1,"2-thessalonians":1,
      "1-timothy":1,"2-timothy":1,"titus":1,"philemon":1,"hebrews":1,
      "james":1,"1-peter":1,"2-peter":1,"1-john":1,"2-john":1,
      "3-john":1,"jude":1,"revelation":1
    };

    return {
      book: book,
      chapter: chapter,
      folder: String(chapter).padStart(3, "0"),
      testament: nt[book] ? "new-testament" : "old-testament"
    };
  }

  async function mtbRealEditorialFile(url, kind) {
    try {
      var response = await fetch(url, { method: "GET", cache: "no-store" });
      if (!response.ok) return "";

      var html = await response.text();

      // Reject a static-server fallback page that happened to return 200.
      if (/id=["']book-hero["']/i.test(html) &&
          !/data-doc-type=["']chapter-/i.test(html)) {
        return "";
      }

      if (kind === "overview") {
        if (!/data-doc-type=["']chapter-overview["']/i.test(html) &&
            !/mtb-chapter-overview-dashboard/i.test(html) &&
            !/mtb-overview-glance/i.test(html)) {
          return "";
        }
      }

      if (kind === "study") {
        if (/data-mtb-status=["']placeholder["']/i.test(html)) return "";
        if (!/data-doc-type=["']chapter-explanation["']/i.test(html) &&
            !/mtb-chapter-study/i.test(html)) {
          return "";
        }
      }

      if (kind === "hearing") {
        if (!/data-doc-type=["']chapter-hearing["']/i.test(html) &&
            !/mtb-chapter-hearing/i.test(html)) {
          return "";
        }
      }

      if (kind === "reflections") {
        if (!/data-doc-type=["']chapter-reflections["']/i.test(html) &&
            !/mtb-chapter-reflections/i.test(html)) {
          return "";
        }
      }

      return url;
    } catch (_) {
      return "";
    }
  }

  async function mtbFindEditorialFile(ctx, kind) {
    var base = "/books/" + ctx.testament + "/" + ctx.book + "/" + ctx.folder + "/";
    var stem = ctx.book + "-" + ctx.chapter;

    var names;

    if (kind === "overview") {
      names = [
        stem + "-chapter-overview.html",
        stem + "-chapter-overview-draft.html",
        stem + "-chapter-orientation.html",
        stem + "-chapter-orientation-draft.html"
      ];
    }
    else if (kind === "hearing") {
      names = [
        stem + "-chapter-hearing.html",
        stem + "-chapter-hearing-draft.html"
      ];
    }
    else if (kind === "reflections") {
      names = [
        stem + "-chapter-reflections.html",
        stem + "-chapter-reflections-draft.html",
        stem + "-chapter-insights.html",
        stem + "-chapter-insights-draft.html"
      ];
    }
    else {
      names = [
        stem + "-chapter-explanation.html",
        stem + "-chapter-explanation-draft.html"
      ];
    }

    for (var i = 0; i < names.length; i++) {
      var found = await mtbRealEditorialFile(base + names[i], kind);
      if (found) return found;
    }

    return "";
  }

  function mtbFindTab(tabs, keys, label) {
    for (var i = 0; i < keys.length; i++) {
      var found = tabs.querySelector('[data-tab="' + keys[i] + '"]');
      if (found) return found;
    }

    var nodes = tabs.querySelectorAll("button,a");
    for (var j = 0; j < nodes.length; j++) {
      if ((nodes[j].textContent || "").trim().toLowerCase() === label.toLowerCase()) {
        return nodes[j];
      }
    }

    return null;
  }

  function mtbCreateEditorialTab(ctx, key, label, fileUrl) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "tab-btn mtb-tab-compat";
    button.dataset.tab = key;
    button.textContent = label;

    button.addEventListener("click", function () {
      var u = new URL(window.location.href);
      u.searchParams.set("book", ctx.book);
      u.searchParams.set("chapter", String(ctx.chapter));
      u.searchParams.set("tab", key);

      // Give load-doc.js the exact file as a fallback against older tab maps.
      var fileName = String(fileUrl).split("/").pop();
      if (fileName) u.searchParams.set("doc", fileName);

      window.location.href = u.pathname + "?" + u.searchParams.toString();
    });

    return button;
  }

  async function mtbRepairEditorialTabs(force) {
    var ctx = mtbEditorialContext();
    var tabs = document.getElementById("tabs");
    if (!ctx || !tabs) return;

    var contextKey = ctx.book + ":" + ctx.chapter;

    if (!force && mtbEditorialTabRepairKey === contextKey) {
      var hasOverview = !!mtbFindTab(
        tabs,
        ["chapter_overview", "chapter_orientation"],
        "Chapter Overview"
      );
      var hasStudy = !!mtbFindTab(
        tabs,
        ["chapter_explanation"],
        "Chapter Study"
      );
      var hasHearing = !!mtbFindTab(
        tabs,
        ["chapter_hearing"],
        "Chapter Hearing"
      );
      var hasReflections = !!mtbFindTab(
        tabs,
        ["chapter_reflections", "chapter_insights"],
        "Chapter Reflection"
      );
      if (hasOverview && hasStudy && hasHearing && hasReflections) return;
    }

    var results = await Promise.all([
      mtbFindEditorialFile(ctx, "overview"),
      mtbFindEditorialFile(ctx, "study"),
      mtbFindEditorialFile(ctx, "hearing"),
      mtbFindEditorialFile(ctx, "reflections")
    ]);

    var overviewUrl = results[0];
    var studyUrl = results[1];
    var hearingUrl = results[2];
    var reflectionsUrl = results[3];

    if (overviewUrl && !mtbFindTab(
      tabs,
      ["chapter_overview", "chapter_orientation"],
      "Chapter Overview"
    )) {
      var overviewButton = mtbCreateEditorialTab(
        ctx,
        "chapter_overview",
        "Chapter Overview",
        overviewUrl
      );

      var studyExisting = mtbFindTab(
        tabs,
        ["chapter_explanation"],
        "Chapter Study"
      );

      if (studyExisting) tabs.insertBefore(overviewButton, studyExisting);
      else tabs.appendChild(overviewButton);
    }

    if (studyUrl && !mtbFindTab(
      tabs,
      ["chapter_explanation"],
      "Chapter Study"
    )) {
      var studyButton = mtbCreateEditorialTab(
        ctx,
        "chapter_explanation",
        "Chapter Study",
        studyUrl
      );

      var reflectionExisting = mtbFindTab(
        tabs,
        ["chapter_reflections", "chapter_insights"],
        "Chapter Reflection"
      );

      if (reflectionExisting) tabs.insertBefore(studyButton, reflectionExisting);
      else tabs.appendChild(studyButton);
    }

    if (hearingUrl && !mtbFindTab(
      tabs,
      ["chapter_hearing"],
      "Chapter Hearing"
    )) {
      var hearingButton = mtbCreateEditorialTab(
        ctx,
        "chapter_hearing",
        "Chapter Hearing",
        hearingUrl
      );

      var reflectionForHearing = mtbFindTab(
        tabs,
        ["chapter_reflections", "chapter_insights"],
        "Chapter Reflection"
      );
      if (reflectionForHearing) tabs.insertBefore(hearingButton, reflectionForHearing);
      else tabs.appendChild(hearingButton);
    }

    if (reflectionsUrl && !mtbFindTab(
      tabs,
      ["chapter_reflections", "chapter_insights"],
      "Chapter Reflection"
    )) {
      var reflectionsButton = mtbCreateEditorialTab(
        ctx,
        "chapter_reflections",
        "Chapter Reflection",
        reflectionsUrl
      );

      var cultureExisting = mtbFindTab(
        tabs,
        ["eg_culture"],
        "EG Culture"
      );

      if (cultureExisting) tabs.insertBefore(reflectionsButton, cultureExisting);
      else tabs.appendChild(reflectionsButton);
    }

    mtbEditorialTabRepairKey = contextKey;
  }

  // book.js performs asynchronous availability checks. Run a few finite
  // post-load checks so Overview, Study, Hearing, and Reflections can be restored
  // after its render, without creating an observer/request loop.
  var mtbEditorialObserverTimer = null;

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () { mtbRepairEditorialTabs(true); }, 250);
    setTimeout(function () { mtbRepairEditorialTabs(false); }, 900);
    setTimeout(function () { mtbRepairEditorialTabs(false); }, 1800);

    // book.js can finish its asynchronous tab availability render after our
    // finite checks and replace the entire tab bar. Watch only child changes
    // and repair missing editorial tabs after that replacement. Unlike the
    // retired observer, this code never reorders tabs that already exist, so
    // its own inserted buttons do not create a request loop.
    var tabs = document.getElementById("tabs");
    if (tabs && window.MutationObserver) {
      var observer = new MutationObserver(function () {
        if (mtbEditorialObserverTimer) clearTimeout(mtbEditorialObserverTimer);
        mtbEditorialObserverTimer = setTimeout(function () {
          mtbEditorialObserverTimer = null;
          mtbRepairEditorialTabs(false);
        }, 120);
      });
      observer.observe(tabs, { childList:true });
    }
  });

  window.addEventListener("popstate", function () {
    mtbEditorialTabRepairKey = "";
    setTimeout(function () { mtbRepairEditorialTabs(true); }, 250);
  });

  document.addEventListener("DOMContentLoaded", function () {
    repairNavigation(document);

    new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            repairNavigation(node);
          }
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  });
})();