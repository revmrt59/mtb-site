(async function () {
  
  // Only run on LOC DETAIL pages that have a loc= param
const params = new URLSearchParams(window.location.search);
if (!params.get("loc")) return;
  const loc = (params.get("loc") || "").trim();
  const tab = (params.get("tab") || "scripture_harmony").trim();

  const target = document.getElementById("doc-target");
  if (!target) return;

  // Turn on LOC detail page CSS (sticky header + scroll body)
  document.body.classList.add("loc-page");

  // Ensure we HAVE a title host (create if missing)
  const titleHost = ensureLocTitleHost();

  // Ensure structure exists so the CSS can work: .loc-header and .loc-scroll-body
  ensureLocLayout(titleHost, target);

  // Always show something so blank pages never happen silently
  if (!loc) {
    target.innerHTML = `<div style="padding:12px;">Missing loc parameter.</div>`;
    return;
  }

  // Load harmony index
  const harmonyUrl = "/assets/js/loc/life-of-christ-harmony-table.json";
  let harmony;
  try {
    harmony = await fetch(harmonyUrl).then(r => r.json());
  } catch (e) {
    target.innerHTML = `<div style="padding:12px;">Could not load harmony JSON: ${escapeHtml(harmonyUrl)}</div>`;
    return;
  }

  const row = harmony.find(r => r.seq === loc);
  if (!row) {
    target.innerHTML = `<div style="padding:12px;">Sequence not found: ${escapeHtml(loc)}</div>`;
    return;
  }

  // Title block (now guaranteed to exist)
  titleHost.style.whiteSpace = "nowrap";
  titleHost.innerHTML = `
    <div style="font-size:20px; font-weight:700; margin-bottom:4px;">${escapeHtml(row.title || "")}</div>
    <div style="opacity:.8; margin-bottom:2px;">Sequence ${escapeHtml(row.seq)}${row.approxDate ? " | " + escapeHtml(row.approxDate) : ""}</div>
    <div style="opacity:.8;">${escapeHtml([row.rollup, row.phase].filter(Boolean).join(" | "))}</div>
  `;

  // Nudge "Scripture Harmony" button right (CSS :contains does not work in real browsers)
  nudgeHarmonyButton();

  // Add right-side prev/next buttons that page by harmony index using loc=
  initLocSequenceNav(harmony, loc, tab);

  // Only one tab for now
  if (tab === "scripture_harmony") {
    renderScriptureHarmony(row);
  } else {
    target.innerHTML = `<div style="padding:12px;">Unknown tab: ${escapeHtml(tab)}</div>`;
  }

  // Run header controls patch after layout exists
  patchHeaderControls();

  function renderScriptureHarmony(row) {
    target.innerHTML = `
      <section class="loc-harmony">
        <div class="loc-harmony-controls" style="margin: 10px 0 14px;">
          <label for="loc-translation" style="margin-right:8px;">Translation</label>
          <select id="loc-translation">
            <option value="nkjv" selected>NKJV</option>
            <option value="nlt">NLT</option>
            <option value="esv">ESV</option>
            <option value="niv">NIV</option>
            <option value="nasb">NASB</option>
            <option value="kjv">KJV</option>
          </select>
        </div>

        <div id="loc-harmony-table"></div>
      </section>
    `;

    const sel = document.getElementById("loc-translation");
    const tableHost = document.getElementById("loc-harmony-table");
    const refs = row.refs || {};

    async function draw() {
      const t = sel.value;

      const [mat, mar, luk, joh] = await Promise.all([
        passageHtml(t, "matthew", refs.matthew),
        passageHtml(t, "mark", refs.mark),
        passageHtml(t, "luke", refs.luke),
        passageHtml(t, "john", refs.john)
      ]);

      tableHost.innerHTML = `
        <table class="mtb-loc-harmony-table" style="width:100%; table-layout:fixed; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #ccc;">Matthew</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #ccc;">Mark</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #ccc;">Luke</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #ccc;">John</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="vertical-align:top; padding:10px; border-bottom:1px solid #eee;">${mat}</td>
              <td style="vertical-align:top; padding:10px; border-bottom:1px solid #eee;">${mar}</td>
              <td style="vertical-align:top; padding:10px; border-bottom:1px solid #eee;">${luk}</td>
              <td style="vertical-align:top; padding:10px; border-bottom:1px solid #eee;">${joh}</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    sel.addEventListener("change", draw);
    draw();
  }

  async function passageHtml(translation, bookSlug, refStr) {
    const s = (refStr || "").trim();
    if (!s) return "";

    const refs = parseRefs(s);
    if (refs.length === 0) {
      return `<div style="opacity:.7;">Unrecognized reference: ${escapeHtml(s)}</div>`;
    }

    const url = `/assets/js/bibles-json/${translation}/${bookSlug}.json`;
    let bookData;
    try {
      bookData = await fetch(url).then(r => r.json());
    } catch {
      return `<div style="opacity:.7;">Missing Bible JSON:<br>${escapeHtml(url)}</div>`;
    }

    const chunks = [];
    for (const r of refs) chunks.push(renderRefChunk(bookData, r));
    return chunks.join("");
  }

  function parseRefs(input) {
    const parts = input.split(/[,;]+/).map(p => p.trim()).filter(Boolean);
    const out = [];

    for (const p of parts) {
      const m = p.match(/^(\d+):(\d+)(?:\s*-\s*(?:(\d+):)?(\d+))?$/);
      if (!m) continue;

      const c1 = parseInt(m[1], 10);
      const v1 = parseInt(m[2], 10);
      const c2 = m[3] ? parseInt(m[3], 10) : c1;
      const v2 = m[4] ? parseInt(m[4], 10) : v1;

      out.push({ c1, v1, c2, v2, raw: p });
    }
    return out;
  }

  function renderRefChunk(bookData, r) {
    const lines = [];

    for (let c = r.c1; c <= r.c2; c++) {
      const vStart = (c === r.c1) ? r.v1 : 1;
      const vEnd = (c === r.c2) ? r.v2 : 999;

      for (let v = vStart; v <= vEnd; v++) {
        const t = getVerseText(bookData, c, v);
        if (!t) {
          if (vEnd === 999) break;
          continue;
        }

        lines.push(
          `<div style="margin:0 0 6px;">
             <span style="opacity:.75;">${c}:${v}</span> ${escapeHtml(t)}
           </div>`
        );
      }
    }

    if (lines.length === 0) return `<div style="opacity:.7;">No text found for ${escapeHtml(r.raw)}</div>`;
    return `<div style="margin-bottom:10px;">${lines.join("")}</div>`;
  }

  function getVerseText(bookData, chapter, verse) {
    const c = String(chapter);
    const v = String(verse);

    if (bookData?.chapters?.[c]?.[v]) return bookData.chapters[c][v];
    if (bookData?.[c]?.[v]) return bookData[c][v];

    if (Array.isArray(bookData?.chapters)) {
      const chap = bookData.chapters[chapter - 1];
      if (Array.isArray(chap)) return chap[verse - 1] || "";
    }

    if (bookData?.verses?.[`${c}:${v}`]) return bookData.verses[`${c}:${v}`];
    return "";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  // NEW: create title host if missing
  function ensureLocTitleHost() {
    let host = document.getElementById("loc-title");
    if (host) return host;

    host = document.createElement("div");
    host.id = "loc-title";

    // Prefer placing it before doc-target
    const parent = target.parentNode || document.body;
    parent.insertBefore(host, target);

    return host;
  }

  function ensureLocLayout(titleHost, target) {
    // Ensure .loc-header exists and contains titleHost
    if (!titleHost.closest(".loc-header")) {
      const wrap = document.createElement("div");
      wrap.className = "loc-header";
      titleHost.parentNode.insertBefore(wrap, titleHost);
      wrap.appendChild(titleHost);
    }

    // Wrap #doc-target in .loc-scroll-body (if not already)
    if (!target.closest(".loc-scroll-body")) {
      const wrap = document.createElement("div");
      wrap.className = "loc-scroll-body";
      target.parentNode.insertBefore(wrap, target);
      wrap.appendChild(target);
    }
  }

  function nudgeHarmonyButton() {
    const btns = Array.from(document.querySelectorAll("button"));
    const b = btns.find(x => (x.textContent || "").trim().toLowerCase() === "scripture harmony");
    if (b) b.style.marginLeft = "32px";
  }

  function initLocSequenceNav(harmony, loc, tab) {
    if (!Array.isArray(harmony) || harmony.length === 0) return;

    const idx = harmony.findIndex(r => r.seq === loc);
    if (idx === -1) return;

    const prev = harmony[idx - 1]?.seq || null;
    const next = harmony[idx + 1]?.seq || null;

    let wrap = document.getElementById("seq-nav");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "seq-nav";
      document.body.appendChild(wrap);
    } else {
      wrap.innerHTML = "";
    }

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.id = "seq-prev";
    prevBtn.textContent = "◀ Prev";
    prevBtn.disabled = !prev;

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.id = "seq-next";
    nextBtn.textContent = "Next ▶";
    nextBtn.disabled = !next;

    prevBtn.addEventListener("click", () => {
      if (!prev) return;
      const url = new URL(window.location.href);
      url.searchParams.set("loc", prev);
      url.searchParams.set("tab", tab || "scripture_harmony");
      window.location.href = url.toString();
    });

    nextBtn.addEventListener("click", () => {
      if (!next) return;
      const url = new URL(window.location.href);
      url.searchParams.set("loc", next);
      url.searchParams.set("tab", tab || "scripture_harmony");
      window.location.href = url.toString();
    });

    wrap.appendChild(prevBtn);
    wrap.appendChild(nextBtn);
  }

  // NEW: reliable back button + harmony class, runs after layout exists
  function patchHeaderControls() {
    const header = document.querySelector(".loc-header");
    if (!header) return;

    if (!header.querySelector(".loc-back-btn")) {
      const back = document.createElement("button");
      back.type = "button";
      back.className = "loc-back-btn";
      back.textContent = "Back";
      back.addEventListener("click", () => window.history.back());
      header.prepend(back);
    }

    const harmonyBtn = [...document.querySelectorAll("button")].find(
      b => (b.textContent || "").trim() === "Scripture Harmony"
    );
    if (harmonyBtn) harmonyBtn.classList.add("scripture-harmony-btn");
  }

})();
