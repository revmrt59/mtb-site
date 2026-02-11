(function () {
  let cache = {};
  let cacheUrl = null;

  let tooltipEl = null;
  let modalEl = null;

  // Cache fetched HTML word-study docs
  const docCache = new Map();

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.className = "ws-tooltip";
    tooltipEl.setAttribute("role", "tooltip");
    tooltipEl.style.display = "none";
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }
function isTouchDevice() {
  return (
    "ontouchstart" in window ||
    (navigator.maxTouchPoints || 0) > 0 ||
    window.matchMedia && window.matchMedia("(pointer: coarse)").matches
  );
}

  function showTooltip(text, x, y) {
    const el = ensureTooltip();
    el.textContent = fixMojibake(text);
    el.style.display = "block";

    const pad = 12;
    const rect = el.getBoundingClientRect();
    let left = x + pad;
    let top = y + pad;

    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = window.innerHeight - rect.height - 8;

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = "none";
  }

  function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement("div");
    modalEl.className = "ws-modal";
    modalEl.style.display = "none";

    modalEl.innerHTML = `
      <div class="ws-modal-backdrop" data-close="1"></div>

      <div class="ws-modal-panel" role="dialog" aria-modal="true" aria-label="Word Study">
        <div class="ws-modal-header">
          <button class="ws-modal-close" type="button" data-close="1" aria-label="Close">Close</button>
        </div>
        <div class="ws-modal-body"></div>
      </div>
    `;

    document.body.appendChild(modalEl);

    modalEl.addEventListener("click", (e) => {
      if (e.target && e.target.getAttribute("data-close")) hideModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideModal();
    });

    return modalEl;
  }

  function showModal(html) {
    const el = ensureModal();
    const body = el.querySelector(".ws-modal-body");
    body.innerHTML = fixMojibake(html) || "<p class='muted'>No details available.</p>";
    el.style.display = "block";
  }

  function hideModal() {
    if (!modalEl) return;
    modalEl.style.display = "none";
    const body = modalEl.querySelector(".ws-modal-body");
    if (body) body.innerHTML = "";
  }

  // ----------------------------
  // JSON mode (existing behavior)
  // ----------------------------
  function getJsonUrl() {
    return document.body.getAttribute("data-ws-json");
  }

  async function loadWordStudies(url) {
    if (!url) return null;

    if (cacheUrl !== url) {
      cache = {};
      cacheUrl = url;
    }
    if (cache.__loaded) return cache;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load word studies JSON");

    const data = await res.json();
    cache = { ...data, __loaded: true };

    return cache;
  }

  async function getItem(key) {
    const url = getJsonUrl();
    if (!url) return null;

    try {
      await loadWordStudies(url);
    } catch {
      return null;
    }

    return cache[key] || null;
  }

  // ----------------------------
  // HTML doc mode (new behavior)
  // ----------------------------
  function resolveDocUrl(raw) {
    if (!raw) return null;
    try {
      return new URL(raw, window.location.origin).toString();
    } catch {
      return null;
    }
  }

  function extractDocBodyHtml(fullHtml) {
    const temp = document.createElement("div");
    temp.innerHTML = fullHtml;

    const body = temp.querySelector("body");
    if (body) return body.innerHTML;

    return fullHtml;
  }

  function fixMojibake(input) {
    if (input == null) return input;
    let s = String(input);

    // Normalize NBSP (real + common mangled forms)
    s = s.replace(/\u00A0/g, " ");
    s = s.replace(/&nbsp;/g, " ");
    s = s.split("┬á").join(" ");
    s = s.split("Â ").join(" ");
    s = s.split("Â").join("");

    // Common double-encoded "ΓÇ.." family (seen in your hover/popup)
    const map1 = [
      ["ΓÇ£", "“"], ["ΓÇØ", "”"], ["ΓÇ¥", "”"],
      ["ΓÇÿ", "‘"], ["ΓÇÖ", "’"],
      ["ΓÇª", "…"],
      ["ΓÇô", "—"], ["ΓÇò", "—"],
      ["ΓÇû", "–"],
      ["ΓÂ ", " "], ["ΓÂ", ""]
    ];

    // Common UTF-8-as-Win1252 "â€.." family
    const map2 = [
      ["â€”", "—"], ["â€“", "–"],
      ["â€œ", "“"], ["â€", "”"],
      ["â€˜", "‘"], ["â€™", "’"],
      ["â€¦", "…"]
    ];

    // Common double-encoded "Γâ.." family
    const map3 = [
      ["Γâ€”", "—"], ["Γâ€“", "–"],
      ["Γâ€œ", "“"], ["Γâ€", "”"],
      ["Γâ€˜", "‘"], ["Γâ€™", "’"],
      ["Γâ€¦", "…"]
    ];

    const applyMap = (str, map) => {
      let out = str;
      for (const [bad, good] of map) out = out.split(bad).join(good);
      return out;
    };

    // Two passes catches many "double mangled" strings
    s = applyMap(s, map1);
    s = applyMap(s, map2);
    s = applyMap(s, map3);

    s = applyMap(s, map1);
    s = applyMap(s, map2);
    s = applyMap(s, map3);

    // Tidy spacing
    s = s.replace(/[ \t]{2,}/g, " ");

    return s;
  }

  // Key fix: skip empty <p> (including NBSP) after the Summary heading
  function extractSummaryFromHtml(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html;

    const root = temp.querySelector("#doc-root") || temp;
    const h2 = root.querySelector("h2#summary");
    if (!h2) return null;

    let el = h2.nextElementSibling;
    while (el) {
      if (el.tagName === "P") {
        const txt = (el.textContent || "").replace(/\u00A0/g, " ").trim();
        if (txt.length > 0) return txt;
      }
      el = el.nextElementSibling;
    }
    return null;
  }

  async function loadDocHtml(docUrl) {
    const url = resolveDocUrl(docUrl);
    if (!url) return null;

    // Cache hit
    if (docCache.has(url)) return docCache.get(url);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load word study file: ${url}`);

    const html = await res.text();
    const bodyHtml = extractDocBodyHtml(html);
    const cleaned = fixMojibake(bodyHtml);

    docCache.set(url, cleaned);
    return cleaned;
  }

  function getDocUrlFromEl(el) {
    const d = el.getAttribute("data-ws-doc");
    if (d) return d;

    const href = el.getAttribute("href");
    if (href && href !== "#") return href;

    return null;
  }

  function bindWordStudies(root) {
  const scope = root || document;
  const wsEls = scope.querySelectorAll(".ws");
  if (!wsEls.length) return;

  const isTouch =
    "ontouchstart" in window ||
    (navigator.maxTouchPoints || 0) > 0 ||
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

  wsEls.forEach((el) => {
    if (el.dataset.wsBound === "1") return;
    el.dataset.wsBound = "1";

    let hoverTimer = null;

    const key = el.getAttribute("data-ws");     // JSON key (optional)
    const docUrl = getDocUrlFromEl(el);         // HTML doc url (optional)

    // -----------------------------
    // DESKTOP HOVER (only if not touch)
    // -----------------------------
    if (!isTouch) {

      el.addEventListener("mouseenter", (e) => {
        hoverTimer = window.setTimeout(async () => {

          // Prefer HTML doc mode
          if (docUrl) {
            try {
              const html = await loadDocHtml(docUrl);
              const summary = extractSummaryFromHtml(html);
              showTooltip(summary || "Click for word study", e.clientX, e.clientY);
            } catch {
              showTooltip("Click for word study", e.clientX, e.clientY);
            }
            return;
          }

          // Fallback to JSON mode
          if (key) {
            const item = await getItem(key);
            if (item && item.short) {
              showTooltip(item.short, e.clientX, e.clientY);
            }
          }

        }, 150);
      });

      el.addEventListener("mousemove", (e) => {
        if (tooltipEl && tooltipEl.style.display === "block") {
          showTooltip(tooltipEl.textContent, e.clientX, e.clientY);
        }
      });

      el.addEventListener("mouseleave", () => {
        if (hoverTimer) window.clearTimeout(hoverTimer);
        hideTooltip();
      });
    }

    // -----------------------------
    // CLICK / TAP (always enabled)
    // -----------------------------
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      hideTooltip();

      // Prefer HTML doc mode
      if (docUrl) {
        try {
          const html = await loadDocHtml(docUrl);
          showModal(html);
        } catch {
          showModal("<p class='muted'>Could not load word study.</p>");
        }
        return;
      }

      // Fallback to JSON mode
      if (key) {
        const item = await getItem(key);
        if (!item) return;

        showModal(
          item.longHtml ||
          `<p><strong>${item.term || key}</strong></p><p>${item.gloss || ""}</p>`
        );
      }
    });
  });
}


      el.addEventListener("mousemove", (e) => {
        if (tooltipEl && tooltipEl.style.display === "block") {
          // just reposition; don’t refetch on every move
          const txt = tooltipEl.textContent || "";
          showTooltip(txt, e.clientX, e.clientY);
        }
      });

      el.addEventListener("mouseleave", () => {
        if (hoverTimer) window.clearTimeout(hoverTimer);
        hideTooltip();
      });

      el.addEventListener("click", async (e) => {
        e.preventDefault();
        hideTooltip();

        // Prefer HTML doc mode when present
        if (docUrl) {
          try {
            const html = await loadDocHtml(docUrl);
            showModal(html);
          } catch (err) {
            console.error(err);
            showModal(
              `<p class='muted'>Could not load word study.</p>
               <p class='muted'>${resolveDocUrl(docUrl) || docUrl}</p>`
            );
          }
          return;
        }

        // Fall back to JSON mode
        if (key) {
          const item = await getItem(key);
          if (!item) return;
          showModal(
            item.longHtml ||
            `<p><strong>${item.term || key}</strong></p><p>${item.gloss || ""}</p>`
          );
          return;
        }

        console.warn("Clicked .ws without data-ws-doc or data-ws:", el);
      });
    });
  }

  function startObservers() {
    const docTarget = document.getElementById("doc-target");

    if (docTarget) {
      const obs = new MutationObserver(() => bindWordStudies(docTarget));
      obs.observe(docTarget, { childList: true, subtree: true });
    }

    const bodyObs = new MutationObserver(() => bindWordStudies(document));
    bodyObs.observe(document.body, { attributes: true, attributeFilter: ["data-ws-json"] });

    bindWordStudies(document);
  }

  // Expose a manual bind hook (your load-doc.js calls this)
  window.MTBWordStudyHover = {
    bind: (root) => bindWordStudies(root || document)
  };

  document.addEventListener("DOMContentLoaded", startObservers);
})();
