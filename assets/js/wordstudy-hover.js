(function () {
  let cache = {};
  let cacheUrl = null;

  let tooltipEl = null;
  let modalEl = null;

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
        <button class="ws-modal-close" type="button" data-close="1">Close</button>
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

  function getJsonUrl() {
    // This is the single source of truth
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

    // Ensure cache is loaded before reading
    try {
      await loadWordStudies(url);
    } catch {
      return null;
    }

    return cache[key] || null;
  }

  function bindWordStudies() {
    const jsonUrl = getJsonUrl();
    if (!jsonUrl) return; // don’t bind until the page tells us where JSON is

    const wsEls = document.querySelectorAll(".ws[data-ws]");
    if (!wsEls.length) return;

    let hoverTimer = null;

    wsEls.forEach((el) => {
      if (el.dataset.wsBound === "1") return;
      el.dataset.wsBound = "1";

      const key = el.getAttribute("data-ws");

      el.addEventListener("mouseenter", (e) => {
        hoverTimer = window.setTimeout(async () => {
          const item = await getItem(key);
          if (!item || !item.short) return;
          showTooltip(item.short, e.clientX, e.clientY);
        }, 150);
      });

      el.addEventListener("mousemove", async (e) => {
        if (tooltipEl && tooltipEl.style.display === "block") {
          const item = await getItem(key);
          if (!item || !item.short) return;
          showTooltip(item.short, e.clientX, e.clientY);
        }
      });

      el.addEventListener("mouseleave", () => {
        if (hoverTimer) window.clearTimeout(hoverTimer);
        hideTooltip();
      });

      el.addEventListener("click", async (e) => {
        e.preventDefault();
        const item = await getItem(key);
        if (!item) return;

        hideTooltip();
        showModal(
          item.longHtml ||
          `<p><strong>${item.term || key}</strong></p><p>${item.gloss || ""}</p>`
        );
      });
    });
  }

  function startObservers() {
    const docTarget = document.getElementById("doc-target");

    // 1) Observe doc-target changes (tab loads replace content)
    if (docTarget) {
      const obs = new MutationObserver(() => bindWordStudies());
      obs.observe(docTarget, { childList: true, subtree: true });
    }

    // 2) Observe body attribute changes (load-doc sets data-ws-json after load)
    const bodyObs = new MutationObserver(() => bindWordStudies());
    bodyObs.observe(document.body, { attributes: true, attributeFilter: ["data-ws-json"] });

    // Try once immediately too
    bindWordStudies();
  }

  document.addEventListener("DOMContentLoaded", startObservers);
})();
