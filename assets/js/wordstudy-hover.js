// wordstudy-hover.js
// Desktop/laptop: hover shows extracted Summary from the word-study HTML; click opens full popup
// Mobile/touch: no hover tooltip; tap reliably opens full popup (and suppresses OS dictionary/selection)
// Includes mojibake cleanup (including ΓÇó -> •) and skips blank paragraphs after Summary

(function () {
  // ---------------------------------------------------
  // State
  // ---------------------------------------------------
  let tooltipEl = null;
  let modalEl = null;

  // Cache fetched HTML word-study docs
  const docCache = new Map();

  // ---------------------------------------------------
  // Device detection
  // ---------------------------------------------------
  function isTouchDevice() {
    return (
      "ontouchstart" in window ||
      (navigator.maxTouchPoints || 0) > 0 ||
      (window.matchMedia && window.matchMedia("(pointer: coarse)").matches)
    );
  }

  // ---------------------------------------------------
  // Mojibake fix (applied to loaded HTML)
  // ---------------------------------------------------
  function fixMojibake(html) {
    const map = [
      ["ΓÇ£", "“"], ["ΓÇØ", "”"], ["ΓÇ¥", "”"],
      ["ΓÇÿ", "‘"], ["ΓÇÖ", "’"], ["ΓÇª", "…"],
      ["ΓÇô", "—"], ["ΓÇû", "–"],
      ["ΓÇó", "•"],
      ["Â ", " "], ["Â", ""]
    ];
    let out = html || "";
    map.forEach(([bad, good]) => { out = out.split(bad).join(good); });
    return out;
  }

  // ---------------------------------------------------
  // Tooltip (desktop only)
  // ---------------------------------------------------
  function ensureTooltip() {
    if (isTouchDevice()) return null; // never show tooltips on touch devices
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
    if (!el) return;

    el.textContent = text || "";
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

  // ---------------------------------------------------
  // Modal
  // ---------------------------------------------------
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

    // Close on backdrop / close button
    modalEl.addEventListener("click", (e) => {
      if (e.target && e.target.getAttribute("data-close")) hideModal();
    });

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideModal();
    });

    return modalEl;
  }

  function showModal(html) {
    hideTooltip(); // critical for mobile overlay issues
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

  // ---------------------------------------------------
  // HTML loading + parsing
  // ---------------------------------------------------
  function resolveDocUrl(raw) {
    if (!raw) return null;
    try {
      return new URL(raw, window.location.origin).toString();
    } catch {
      return null;
    }
  }

  async function loadDocHtml(docUrl) {
    const url = resolveDocUrl(docUrl);
    if (!url) return null;

    if (docCache.has(url)) return docCache.get(url);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load word study file: ${url}`);

    const raw = await res.text();
    const cleaned = fixMojibake(raw);

    docCache.set(url, cleaned);
    return cleaned;
  }

  // Extract #doc-root inner HTML when present; else use body inner; else raw
  function extractDocRootInnerHtml(fullHtml) {
    const temp = document.createElement("div");
    temp.innerHTML = fullHtml;

    const root = temp.querySelector("#doc-root");
    if (root) return root.innerHTML;

    const body = temp.querySelector("body");
    if (body) return body.innerHTML;

    return fullHtml;
  }

  // Summary extractor:
  // - Finds h2#summary
  // - Takes the first non-empty <p> after it
  // - Treats NBSP as whitespace
  function extractSummaryFromHtml(fullHtml) {
    const temp = document.createElement("div");
    temp.innerHTML = fullHtml;

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

  function getDocUrlFromEl(el) {
    // Primary: data-ws-doc
    const d = el.getAttribute("data-ws-doc");
    if (d) return d;

    // Fallback: href
    const href = el.getAttribute("href");
    if (href && href !== "#") return href;

    return null;
  }

  // ---------------------------------------------------
  // Binding
  // ---------------------------------------------------
  function bindWordStudies(root) {
    const scope = root || document;
    const wsEls = scope.querySelectorAll(".ws");
    if (!wsEls.length) return;

    const touch = isTouchDevice();

    wsEls.forEach((el) => {
      if (el.dataset.wsBound === "1") return;
      el.dataset.wsBound = "1";

      const docUrl = getDocUrlFromEl(el);
      let hoverTimer = null;

      // Desktop hover: show extracted Summary
      if (!touch) {
        el.addEventListener("mouseenter", (e) => {
          hoverTimer = window.setTimeout(async () => {
            if (!docUrl) return;

            try {
              const fullHtml = await loadDocHtml(docUrl);
              const summary = extractSummaryFromHtml(fullHtml);
              showTooltip(summary || "Click for word study", e.clientX, e.clientY);
            } catch {
              showTooltip("Click for word study", e.clientX, e.clientY);
            }
          }, 150);
        });

        el.addEventListener("mousemove", (e) => {
          if (tooltipEl && tooltipEl.style.display === "block") {
            showTooltip(tooltipEl.textContent || "", e.clientX, e.clientY);
          }
        });

        el.addEventListener("mouseleave", () => {
          if (hoverTimer) window.clearTimeout(hoverTimer);
          hideTooltip();
        });
      }

      // Reliable opener for desktop + mobile
      const openWordStudy = async (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        hideTooltip();

        if (!docUrl) return;

        try {
          const fullHtml = await loadDocHtml(docUrl);
          const bodyHtml = extractDocRootInnerHtml(fullHtml);
          showModal(bodyHtml);
        } catch (err) {
          console.error(err);
          showModal(
            `<p class="muted">Could not load word study.</p>
             <p class="muted">${resolveDocUrl(docUrl) || docUrl}</p>`
          );
        }
      };

      if (touch) {
        // Prevent iOS/Android "Define/Look Up" callout and text selection behaviors
        el.addEventListener("touchstart", (e) => {
          e.preventDefault();
          e.stopPropagation();
        }, { passive: false });

        el.addEventListener("touchend", openWordStudy, { passive: false });
      } else {
        el.addEventListener("click", openWordStudy);
      }
    });
  }

  function startObservers() {
    const docTarget = document.getElementById("doc-target");
    if (docTarget) {
      const obs = new MutationObserver(() => bindWordStudies(docTarget));
      obs.observe(docTarget, { childList: true, subtree: true });
    }

    // Initial bind
    bindWordStudies(document);
  }

  // Expose hook for load-doc.js (so it can rebind after injecting HTML)
  window.MTBWordStudyHover = {
    bind: (root) => bindWordStudies(root || document)
  };

  document.addEventListener("DOMContentLoaded", startObservers);
})();
