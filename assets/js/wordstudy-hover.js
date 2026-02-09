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

  function showTooltip(text, x, y) {
    const el = ensureTooltip();
    el.textContent = text;
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
    body.innerHTML = html || "<p class='muted'>No details available.</p>";
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
function extractSummaryFromHtml(fullHtml) {
  const temp = document.createElement("div");
  temp.innerHTML = fullHtml;

  const h = temp.querySelector("h2#summary");
  if (!h) return null;

  // Look forward for the first non-empty paragraph,
  // either as a sibling <p> OR a <p> inside a wrapper.
  let n = h.nextElementSibling;
  while (n) {
    // direct <p>
    if (n.tagName === "P") {
      const t = (n.textContent || "").trim();
      if (t) return t;
    }

    // wrapper that contains a <p>
    if (n.querySelector) {
      const p = n.querySelector("p");
      if (p) {
        const t = (p.textContent || "").trim();
        if (t) return t;
      }
    }

    // stop once we hit meaningful content that isn't summary-paragraph-ish
    const text = (n.textContent || "").trim();
    if (text.length > 0) break;

    n = n.nextElementSibling;
  }

  return null;
}



  async function loadDocHtml(docUrl) {
    const url = resolveDocUrl(docUrl);
    if (!url) return null;

    

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load word study file: ${url}`);

    const html = await res.text();
    const bodyHtml = extractDocBodyHtml(html);

    
    return bodyHtml;
  }

  function getDocUrlFromEl(el) {
    // Prefer explicit doc pointer
    const d = el.getAttribute("data-ws-doc");
    if (d) return d;

    // Optional support if you ever use <a href="...">
    const href = el.getAttribute("href");
    if (href && href !== "#") return href;

    return null;
  }

  function bindWordStudies() {
    // Bind ANY .ws elements. JSON is optional now.
    const wsEls = document.querySelectorAll(".ws");
    if (!wsEls.length) return;

    let hoverTimer = null;

    wsEls.forEach((el) => {
      if (el.dataset.wsBound === "1") return;
      el.dataset.wsBound = "1";

      const key = el.getAttribute("data-ws");   // JSON key (optional)
      const docUrl = getDocUrlFromEl(el);       // HTML file url (optional)

el.addEventListener("mouseenter", (e) => {
  hoverTimer = window.setTimeout(async () => {

    // 1) Prefer HTML doc mode when present
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

    // 2) Fall back to JSON
    if (key) {
      const item = await getItem(key);
      if (item && item.short) {
        showTooltip(item.short, e.clientX, e.clientY);
        return;
      }
    }

  }, 150);
});



      el.addEventListener("mousemove", async (e) => {
        if (tooltipEl && tooltipEl.style.display === "block") {
          if (key) {
            const item = await getItem(key);
            if (item && item.short) {
              showTooltip(item.short, e.clientX, e.clientY);
              return;
            }
          }
        }
      });

      el.addEventListener("mouseleave", () => {
        if (hoverTimer) window.clearTimeout(hoverTimer);
        hideTooltip();
      });

      el.addEventListener("click", async (e) => {
        e.preventDefault();
        hideTooltip();

        // 1) Prefer HTML doc mode when present
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

        // 2) Fall back to JSON mode
        if (key) {
          const item = await getItem(key);
          if (!item) return;
          showModal(
            item.longHtml ||
              `<p><strong>${item.term || key}</strong></p><p>${item.gloss || ""}</p>`
          );
          return;
        }

        // 3) Nothing to load
        console.warn("Clicked .ws without data-ws-doc or data-ws:", el);
      });
    });
  }

  function startObservers() {
    const docTarget = document.getElementById("doc-target");

    if (docTarget) {
      const obs = new MutationObserver(() => bindWordStudies());
      obs.observe(docTarget, { childList: true, subtree: true });
    }

    const bodyObs = new MutationObserver(() => bindWordStudies());
    bodyObs.observe(document.body, { attributes: true, attributeFilter: ["data-ws-json"] });

    bindWordStudies();
  }

  document.addEventListener("DOMContentLoaded", startObservers);
})();
