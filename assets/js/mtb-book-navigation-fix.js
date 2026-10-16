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
  // Chapter editorial tab compatibility / discovery
  // -------------------------------------------------------------
  var mtbTabRepairTimer = null;
  var mtbTabRepairBusy = false;

  function mtbCanonicalBookSlug(value) {
    var b = String(value || "").toLowerCase().trim().replace(/\s+/g, "-");
    if (b === "psalm") b = "psalms";
    return b;
  }

  function mtbChapterContext() {
    var p = new URLSearchParams(window.location.search);
    var book = mtbCanonicalBookSlug(
      p.get("book") || document.body.getAttribute("data-book") || ""
    );
    var chapter = parseInt(
      p.get("chapter") || document.body.getAttribute("data-chapter") || "0",
      10
    );
    if (!book || !Number.isFinite(chapter) || chapter < 1) return null;
    return {
      book: book,
      chapter: chapter,
      folder: String(chapter).padStart(3, "0")
    };
  }

  function mtbCandidateUrls(ctx, fileNames) {
    var urls = [];
    ["old-testament", "new-testament"].forEach(function (testament) {
      fileNames.forEach(function (fileName) {
        urls.push(
          "/books/" + testament + "/" + ctx.book + "/" +
          ctx.folder + "/" + fileName
        );
      });
    });
    return urls;
  }

  async function mtbFindRealEditorialFile(urls, kind) {
    for (var i = 0; i < urls.length; i++) {
      try {
        var response = await fetch(urls[i], {
          method: "GET",
          cache: "no-store"
        });
        if (!response.ok) continue;

        var html = await response.text();

        // Reject a static-server fallback that returned book.html with 200.
        if (/id=["']book-hero["']/i.test(html) &&
            !/data-doc-type=["']chapter-/i.test(html)) {
          continue;
        }

        if (kind === "study") {
          if (!/data-doc-type=["']chapter-explanation["']/i.test(html) &&
              !/mtb-chapter-study/i.test(html)) continue;
          if (/data-mtb-status=["']placeholder["']/i.test(html)) continue;
        }
        else if (kind === "overview") {
          if (!/data-doc-type=["']chapter-overview["']/i.test(html) &&
              !/mtb-chapter-overview-dashboard/i.test(html) &&
              !/mtb-overview-glance/i.test(html)) continue;
        }
        else if (kind === "reflections") {
          if (!/data-doc-type=["']chapter-reflections["']/i.test(html) &&
              !/mtb-reflections-dashboard/i.test(html)) continue;
        }
        else if (kind === "culture") {
          if (!/data-doc-type=["']chapter-eg-culture["']/i.test(html) &&
              !/mtb-culture-dashboard/i.test(html)) continue;
        }

        return urls[i];
      } catch (_) {}
    }
    return "";
  }

  function mtbTabByMeaning(tabs, key, label) {
    var selectors = [];

    if (key === "chapter_overview") {
      selectors = [
        '[data-tab="chapter_overview"]',
        '[data-tab="chapter_orientation"]'
      ];
    }
    else if (key === "chapter_reflections") {
      selectors = [
        '[data-tab="chapter_reflections"]',
        '[data-tab="chapter_insights"]'
      ];
    }
    else {
      selectors = ['[data-tab="' + key + '"]'];
    }

    for (var i = 0; i < selectors.length; i++) {
      var found = tabs.querySelector(selectors[i]);
      if (found) return found;
    }

    var buttons = tabs.querySelectorAll("button,a");
    for (var j = 0; j < buttons.length; j++) {
      if ((buttons[j].textContent || "").trim().toLowerCase() ===
          label.toLowerCase()) {
        return buttons[j];
      }
    }
    return null;
  }

  function mtbMakeTabButton(ctx, key, label, fileUrl) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab-btn mtb-tab-compat";
    btn.dataset.tab = key;
    btn.textContent = label;

    var current = String(
      new URLSearchParams(window.location.search).get("tab") || ""
    ).toLowerCase();

    if (current === key ||
        (key === "chapter_overview" && current === "chapter_orientation") ||
        (key === "chapter_reflections" && current === "chapter_insights")) {
      btn.classList.add("active");
      btn.setAttribute("aria-current", "page");
    }

    btn.addEventListener("click", function () {
      var u = new URL(window.location.href);
      u.searchParams.set("book", ctx.book);
      u.searchParams.set("chapter", String(ctx.chapter));
      u.searchParams.set("tab", key);

      // Supplying doc makes the click independent of old/new tab suffix maps.
      var fileName = String(fileUrl || "").split("/").pop();
      if (fileName) u.searchParams.set("doc", fileName);
      else u.searchParams.delete("doc");

      window.location.href =
        u.pathname + "?" + u.searchParams.toString();
    });

    return btn;
  }

  async function mtbEnsureEditorialTabs() {
    if (mtbTabRepairBusy) return;

    var ctx = mtbChapterContext();
    var tabs = document.getElementById("tabs");
    if (!ctx || !tabs) return;

    mtbTabRepairBusy = true;

    try {
      var b = ctx.book;
      var ch = ctx.chapter;

      var found = await Promise.all([
        mtbFindRealEditorialFile(
          mtbCandidateUrls(ctx, [
            b + "-" + ch + "-chapter-overview.html",
            b + "-" + ch + "-chapter-overview-draft.html",
            b + "-" + ch + "-chapter-orientation.html",
            b + "-" + ch + "-chapter-orientation-draft.html"
          ]),
          "overview"
        ),

        mtbFindRealEditorialFile(
          mtbCandidateUrls(ctx, [
            b + "-" + ch + "-chapter-explanation.html",
            b + "-" + ch + "-chapter-explanation-draft.html"
          ]),
          "study"
        ),

        mtbFindRealEditorialFile(
          mtbCandidateUrls(ctx, [
            b + "-" + ch + "-chapter-reflections.html",
            b + "-" + ch + "-chapter-reflections-draft.html",
            b + "-" + ch + "-chapter-insights.html"
          ]),
          "reflections"
        ),

        mtbFindRealEditorialFile(
          mtbCandidateUrls(ctx, [
            b + "-" + ch + "-chapter-eg-culture.html",
            b + "-" + ch + "-chapter-eg-culture-draft.html"
          ]),
          "culture"
        )
      ]);

      var desired = [
        { key: "chapter_scripture", label: "Chapter Scripture", url: "builtin" },
        { key: "chapter_overview", label: "Chapter Overview", url: found[0] },
        { key: "chapter_explanation", label: "Chapter Study", url: found[1] },
        { key: "chapter_reflections", label: "Chapter Reflection", url: found[2] },
        { key: "eg_culture", label: "EG Culture", url: found[3] }
      ];

      desired.forEach(function (item) {
        if (item.key === "chapter_scripture" || !item.url) return;

        var existing = mtbTabByMeaning(
          tabs,
          item.key,
          item.label
        );

        if (!existing) {
          existing = mtbMakeTabButton(
            ctx,
            item.key,
            item.label,
            item.url
          );
        }

        existing.dataset.mtbEditorialTab = "1";
      });

      // Restore the locked MTB order while preserving existing event handlers.
      var nav = tabs.querySelector(".chapter-nav");

      desired.forEach(function (item) {
        var node = mtbTabByMeaning(
          tabs,
          item.key,
          item.label
        );
        if (node) tabs.insertBefore(node, nav || null);
      });

      var resources = mtbTabByMeaning(
        tabs,
        "resources",
        "Resources"
      );
      if (resources) tabs.insertBefore(resources, nav || null);
    }
    finally {
      mtbTabRepairBusy = false;
    }
  }

  function mtbScheduleEditorialTabRepair() {
    if (mtbTabRepairTimer) clearTimeout(mtbTabRepairTimer);
    mtbTabRepairTimer = setTimeout(function () {
      mtbTabRepairTimer = null;
      mtbEnsureEditorialTabs();
    }, 120);
  }

  document.addEventListener("DOMContentLoaded", function () {
    mtbScheduleEditorialTabRepair();

    var tabs = document.getElementById("tabs");
    if (tabs) {
      new MutationObserver(mtbScheduleEditorialTabRepair)
        .observe(tabs, { childList: true, subtree: true });
    }
  });

  window.addEventListener("popstate", mtbScheduleEditorialTabRepair);

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