(function () {
  "use strict";

  function isBookHome() {
    var p = new URLSearchParams(window.location.search);
    return (p.get("chapter") === "0" && p.get("tab") === "book_home");
  }

  function buildChapterUrl(book, chapter) {
    return "/book.html?book=" + encodeURIComponent(book) +
      "&chapter=" + encodeURIComponent(String(chapter)) +
      "&tab=chapter_scripture";
  }

  function renderAvailableChapters() {
    if (!isBookHome()) return;

    var p = new URLSearchParams(window.location.search);
    var book = (p.get("book") || "").toLowerCase();
    var wrap = document.getElementById("book-hero-chapters");
    if (!book || !wrap) return;

    fetch("/assets/data/chapter-availability.json", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("chapter-availability.json could not be loaded");
        return response.json();
      })
      .then(function (manifest) {
        var chapters = Array.isArray(manifest[book]) ? manifest[book] : [];
        chapters = chapters
          .map(function (value) { return parseInt(value, 10); })
          .filter(function (value) { return Number.isFinite(value) && value > 0; })
          .sort(function (a, b) { return a - b; });

        wrap.innerHTML = "";

        if (!chapters.length) {
          var message = document.createElement("div");
          message.className = "book-hero-no-chapters";
          message.textContent = "No chapter studies are available yet.";
          wrap.appendChild(message);
          return;
        }

        chapters.forEach(function (chapter) {
          var button = document.createElement("button");
          button.type = "button";
          button.textContent = String(chapter);
          button.addEventListener("click", function () {
            window.location.href = buildChapterUrl(book, chapter);
          });
          wrap.appendChild(button);
        });
      })
      .catch(function (error) {
        console.warn("MTB chapter availability failed:", error);
        wrap.innerHTML = "";
        var message = document.createElement("div");
        message.className = "book-hero-no-chapters";
        message.textContent = "Chapter list could not be loaded.";
        wrap.appendChild(message);
      });
  }

  document.addEventListener("DOMContentLoaded", renderAvailableChapters);
  window.addEventListener("popstate", renderAvailableChapters);
})();