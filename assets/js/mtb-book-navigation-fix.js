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