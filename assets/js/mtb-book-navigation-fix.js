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