/* =========================================================
   MTB Bible Loader (JSON per translation per book)
   - Default: NKJV + NLT
   - Supports 1-column or 2-column compare
   - Caches loaded books in-memory
   - Expects JSON: assets/bibles-json/{translationKey}/{bookSlug}.json
   ========================================================= */

(function () {
  "use strict";

  // -------- Config --------
  const DEFAULT_LEFT = "nkjv";
  const DEFAULT_RIGHT = "nlt";

  // If you keep your book slugs elsewhere, you can override by passing bookSlug directly to render().
  // Otherwise it uses the URL param "book" as the slug.
  const JSON_ROOT = "/assets/bibles-json";

  // In-memory cache: { `${translationKey}:${bookSlug}` : jsonObj }
  const cache = new Map();

  function $(sel, root = document) { return root.querySelector(sel); }

  function getParams() {
    const p = new URLSearchParams(window.location.search);
    return {
      bookSlug: (p.get("book") || "").trim().toLowerCase(),
      chapter: (p.get("chapter") || "1").trim(),
      v1: (p.get("v1") || "").trim().toLowerCase(),
      v2: (p.get("v2") || "").trim().toLowerCase(),
      compare: (p.get("compare") || "").trim().toLowerCase()
    };
  }

  function setParam(key, val) {
    const url = new URL(window.location.href);
    if (val == null || val === "") url.searchParams.delete(key);
    else url.searchParams.set(key, val);
    window.history.replaceState({}, "", url.toString());
  }

  async function fetchJson(translationKey, bookSlug) {
    const key = `${translationKey}:${bookSlug}`;
    if (cache.has(key)) return cache.get(key);

    const url = `${JSON_ROOT}/${encodeURIComponent(translationKey)}/${encodeURIComponent(bookSlug)}.json`;
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`Bible JSON not found: ${url} (${res.status})`);
    const data = await res.json();
    cache.set(key, data);
    return data;
  }

  function normalizeChapterKey(ch) {
    // Your converter wrote chapters as string keys like "1", "2", etc.
    // Ensure we index the object correctly.
    const n = parseInt(ch, 10);
    return Number.isFinite(n) ? String(n) : String(ch);
  }

  function getChapterObj(bibleJson, chapter) {
    const ck = normalizeChapterKey(chapter);
    return (bibleJson && bibleJson.chapters && bibleJson.chapters[ck]) ? bibleJson.chapters[ck] : null;
  }

  function getSortedVerseNums(chapterObj) {
    return Object.keys(chapterObj || {})
      .map(v => parseInt(v, 10))
      .filter(n => Number.isFinite(n))
      .sort((a, b) => a - b);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // -------- Rendering --------
  function renderSingle(container, chapterObj, label) {
    const verses = getSortedVerseNums(chapterObj);
    let html = `<div class="mtb-bible-one">
      <div class="mtb-bible-head">${esc(label)}</div>
      <div class="mtb-bible-body">`;

    for (const v of verses) {
      const t = chapterObj[String(v)] ?? "";
      html += `<div class="mtb-bible-verse">
        <span class="mtb-bible-vnum">${v}</span>
        <span class="mtb-bible-vtext">${esc(t)}</span>
      </div>`;
    }
    html += `</div></div>`;
    container.innerHTML = html;
  }

  function renderCompare(container, leftObj, rightObj, leftLabel, rightLabel) {
    const all = new Set([
      ...getSortedVerseNums(leftObj),
      ...getSortedVerseNums(rightObj),
    ]);
    const verses = Array.from(all).sort((a, b) => a - b);

    let html = `<div class="mtb-bible-two">
      <div class="mtb-bible-head-row">
        <div class="mtb-bible-head">${esc(leftLabel)}</div>
        <div class="mtb-bible-head">${esc(rightLabel)}</div>
      </div>
      <div class="mtb-bible-rows">`;

    for (const v of verses) {
      const lt = leftObj?.[String(v)] ?? "";
      const rt = rightObj?.[String(v)] ?? "";
      html += `<div class="mtb-bible-row">
        <div class="mtb-bible-cell">
          <div class="mtb-bible-verse">
            <span class="mtb-bible-vnum">${v}</span>
            <span class="mtb-bible-vtext">${esc(lt)}</span>
          </div>
        </div>
        <div class="mtb-bible-cell">
          <div class="mtb-bible-verse">
            <span class="mtb-bible-vnum">${v}</span>
            <span class="mtb-bible-vtext">${esc(rt)}</span>
          </div>
        </div>
      </div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;
  }

  // -------- Public: main render --------
  async function render(targetId = "chapter-scripture-target") {
    const params = getParams();
    const bookSlug = params.bookSlug;
    const chapter = params.chapter;

    const leftKey = params.v1 || DEFAULT_LEFT;
    const rightKey = params.v2 || DEFAULT_RIGHT;

    // compare defaults to "on" if v2 exists; otherwise off
    const compareOn = (params.compare === "on") || (!!params.v2) || (!params.compare);

    const container = document.getElementById(targetId);
    if (!container) return;

    if (!bookSlug) {
      container.innerHTML = `<div class="mtb-bible-error">Missing URL param: book</div>`;
      return;
    }

    try {
      const leftJson = await fetchJson(leftKey, bookSlug);
      const leftChapter = getChapterObj(leftJson, chapter);

      if (!leftChapter) {
        container.innerHTML = `<div class="mtb-bible-error">No chapter data found: ${esc(leftKey)} ${esc(bookSlug)} ${esc(chapter)}</div>`;
        return;
      }

      if (!compareOn) {
        renderSingle(container, leftChapter, leftJson.translation || leftKey.toUpperCase());
        return;
      }

      const rightJson = await fetchJson(rightKey, bookSlug);
      const rightChapter = getChapterObj(rightJson, chapter);

      // If right is missing, still render left
      if (!rightChapter) {
        renderSingle(container, leftChapter, leftJson.translation || leftKey.toUpperCase());
        return;
      }

      renderCompare(
        container,
        leftChapter,
        rightChapter,
        leftJson.translation || leftKey.toUpperCase(),
        rightJson.translation || rightKey.toUpperCase()
      );
    } catch (e) {
      container.innerHTML = `<div class="mtb-bible-error">${esc(e.message || e)}</div>`;
    }
  }

  // Expose a small API so your existing code can call it
  window.MTB_Bible = {
    render,
    setParam,
    getParams
  };
})();
