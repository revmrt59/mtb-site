/* =========================================================
   MTB Chapter Scripture Renderer (JSON Driven)
   Reads: /assets/js/bibles-json/<translationKey>/<bookSlug>.json
   Example: /assets/js/bibles-json/nkjv/titus.json

   JSON shape (from your file):
   {
     translationKey: "nkjv",
     translation: "NKJV",
     bookSlug: "titus",
     chapters: { "1": { "1": "text", ... } }
   }
   ========================================================= */

(function () {

  const STORAGE_KEY = "mtb_scripture_prefs_v1";
  const BASE_PATH = "/assets/js/bibles-json/";

  function getParams() {
    const p = new URLSearchParams(window.location.search);
    const book = (p.get("book") || "").toLowerCase();
    const chapterNum = parseInt(p.get("chapter") || "1", 10);
    const chapter = String(Number.isFinite(chapterNum) ? chapterNum : 1);
    return { book, chapter };
  }

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch { return {}; }
  }

  function savePrefs(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
    catch {}
  }

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else n.setAttribute(k, v);
    }
    children.forEach(c => n.appendChild(c));
    return n;
  }

  function sortVerseKeys(keys) {
    return keys
      .map(k => String(k))
      .filter(k => k.length > 0)
      .sort((a, b) => Number(a) - Number(b));
  }

  async function fetchJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${path}`);
    return await res.json();
  }

  async function loadTranslationBookJson(translationKey, bookSlug) {
    const path = `${BASE_PATH}${translationKey}/${bookSlug}.json`;
    return await fetchJson(path);
  }

  function buildSelect(options, value) {
    const s = document.createElement("select");
    options.forEach(opt => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt.toUpperCase();
      s.appendChild(o);
    });
    if (options.includes(value)) s.value = value;
    return s;
  }

  function buildTable(verseNums, verseTextByTranslation, v1, v2, twoCols) {
    const table = el("table", { class: "mtb-chapter-scripture" });
    // Force stable 3-column layout (Verse + 2 translations) with equal translation columns.
    // This prevents the "right column clipped / uneven columns" behavior across browsers and CSS cascades.
    table.style.width = "100%";
    table.style.tableLayout = "fixed";
    table.style.borderCollapse = "collapse";

    const colgroup = document.createElement("colgroup");
    const colVerse = document.createElement("col");
    colVerse.style.width = "60px";

    const colV1 = document.createElement("col");
    colV1.style.width = "calc((100% - 60px) / 2)";

    const colV2 = document.createElement("col");
    colV2.style.width = "calc((100% - 60px) / 2)";

    colgroup.append(colVerse, colV1, colV2);
    table.appendChild(colgroup);

    const thead = el("thead");
    const hr = el("tr");
    hr.appendChild(el("th", { class: "mtb-verse-num", text: "Verse" }));
    hr.appendChild(el("th", { class: "mtb-col-v1", text: v1.toUpperCase() }));
    if (twoCols) hr.appendChild(el("th", { class: "mtb-col-v2", text: v2.toUpperCase() }));
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = el("tbody");
    verseNums.forEach(vn => {
      const tr = el("tr");
      tr.appendChild(el("td", { class: "mtb-verse-num", text: vn }));

      const t1 = (verseTextByTranslation[vn] && verseTextByTranslation[vn][v1]) ? verseTextByTranslation[vn][v1] : "";
      tr.appendChild(el("td", { class: "mtb-col-v1", text: t1 }));

      if (twoCols) {
        const t2 = (verseTextByTranslation[vn] && verseTextByTranslation[vn][v2]) ? verseTextByTranslation[vn][v2] : "";
        tr.appendChild(el("td", { class: "mtb-col-v2", text: t2 }));
      }

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
  }

  async function renderChapterScripture(target, options = {}) {
    const { book, chapter } = getParams();
    if (!book) {
      target.textContent = "Missing book parameter.";
      return;
    }

    const prefs = loadPrefs();

    const translationKeys = Array.isArray(options.translationKeys) && options.translationKeys.length
      ? options.translationKeys
      : ["nkjv", "nlt", "esv", "niv", "nasb", "amp", "kjv", "tlv", "ylt"];

    const defaultMode = prefs.mode || "two";
    const defaultV1 = prefs.v1 && translationKeys.includes(prefs.v1) ? prefs.v1 : (translationKeys.includes("nkjv") ? "nkjv" : translationKeys[0]);
    const defaultV2 = prefs.v2 && translationKeys.includes(prefs.v2) ? prefs.v2 : (translationKeys.includes("nlt") ? "nlt" : (translationKeys[1] || translationKeys[0]));

    const wrap = el("div", { class: "mtb-chapter-scripture-wrap" });
    const controls = el("div", { class: "mtb-chapter-scripture-controls" });

    const modeSelect = buildSelect(["two", "one"], defaultMode);
    modeSelect.querySelectorAll("option").forEach(o => {
      if (o.value === "two") o.textContent = "Two Translations";
      if (o.value === "one") o.textContent = "One Translation";
    });

    const v1Select = buildSelect(translationKeys, defaultV1);
    const v2Select = buildSelect(translationKeys, defaultV2);

    const v2Label = el("label", { text: "Version 2:" });

    controls.appendChild(el("label", { text: "View:" }));
    controls.appendChild(modeSelect);
    controls.appendChild(el("label", { text: "Version 1:" }));
    controls.appendChild(v1Select);
    controls.appendChild(v2Label);
    controls.appendChild(v2Select);

    const host = el("div", { class: "mtb-chapter-scripture-host" });

    wrap.appendChild(controls);
    wrap.appendChild(host);

    target.innerHTML = "";
    target.appendChild(wrap);

    async function apply() {
      const mode = modeSelect.value;
      const v1 = v1Select.value;
      const v2 = v2Select.value;
      const twoCols = mode === "two";

      v2Label.style.display = twoCols ? "" : "none";
      v2Select.style.display = twoCols ? "" : "none";
      wrap.classList.toggle("mtb-one-col", !twoCols);

      // Load translation JSON files
      let json1, json2;
      try {
        json1 = await loadTranslationBookJson(v1, book);
        if (twoCols) json2 = await loadTranslationBookJson(v2, book);
      } catch (e) {
        host.textContent = `Could not load scripture JSON. ${String(e.message || e)}`;
        return;
      }

      const c1 = (json1 && json1.chapters)
  ? (json1.chapters[chapter] || json1.chapters[String(Number(chapter))] || {})
  : {};


     const c2 = (twoCols && json2 && json2.chapters)
  ? (json2.chapters[chapter] || json2.chapters[String(Number(chapter))] || {})
  : {};


      // Build a unified verse list (prefer v1 list, then union with v2)
      const verseSet = new Set([...Object.keys(c1), ...Object.keys(c2)]);
      const verseNums = sortVerseKeys(Array.from(verseSet));
function verseToText(v) {
  // Returns the first real string found anywhere inside v
  function findStringDeep(x, depth = 0) {
    if (x == null) return "";
    if (typeof x === "string") return x.trim();
    if (typeof x === "number") return String(x);

    if (depth > 6) return ""; // safety

    if (Array.isArray(x)) {
      for (const item of x) {
        const s = findStringDeep(item, depth + 1);
        if (s) return s;
      }
      return "";
    }

    if (typeof x === "object") {
      // common keys first
      const preferred = ["text", "t", "verse", "v", "value", "content"];
      for (const k of preferred) {
        if (typeof x[k] === "string" && x[k].trim()) return x[k].trim();
      }

      // otherwise search all properties
      for (const k of Object.keys(x)) {
        const s = findStringDeep(x[k], depth + 1);
        if (s) return s;
      }
      return "";
    }

    return "";
  }

  const s = findStringDeep(v);
  if (s) return s;

  // last-resort: show something instead of blank (helps confirm the shape)
  try { return JSON.stringify(v); } catch { return String(v); }
}



      // Map: verseNum -> { v1: text, v2: text }
      const map = {};
      verseNums.forEach(vn => {
        map[vn] = {};
       map[vn][v1] = verseToText(c1[vn]);
      if (twoCols) map[vn][v2] = verseToText(c2[vn]);
      });

      host.innerHTML = "";
      host.appendChild(buildTable(verseNums, map, v1, v2, twoCols));

      savePrefs({ mode, v1, v2 });
    }

    modeSelect.addEventListener("change", apply);
    v1Select.addEventListener("change", apply);
    v2Select.addEventListener("change", apply);

    await apply();
  }

  window.MTB = window.MTB || {};
  window.MTB.renderChapterScriptureFromJson = renderChapterScripture;

})();
(function () {
  const STAMP = "CHAPTER-SCRIPTURE-JSON v1 hook";
  console.log(STAMP);

  function tryRender() {
    const root = document.querySelector("#doc-target .mtb-scripture-root");
    if (!root) return;

    const book = root.getAttribute("data-book");
    const chapter = Number(root.getAttribute("data-chapter"));

    if (!book || !Number.isFinite(chapter) || chapter < 1) return;

    console.log("CHAPTER-SCRIPTURE-JSON render:", { book, chapter });

    // IMPORTANT:
    // Replace `window.MTBChapterScripture?.render` with the real render entrypoint in your file.
    // If you do not have one, this log will still prove the hook is firing.
if (window.MTB && typeof window.MTB.renderChapterScriptureFromJson === "function") {
  window.MTB.renderChapterScriptureFromJson(root);
}

  }

  document.addEventListener("DOMContentLoaded", tryRender);
  document.addEventListener("mtb:doc-injected", tryRender);
})();