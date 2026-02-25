// wordstudy-hover.js
// Desktop/laptop: hover shows extracted Summary from the word-study HTML; click opens full popup
// Mobile/touch: no hover tooltip; tap reliably opens full popup (and suppresses OS dictionary/selection)
//
// Supports verse-aware word studies via .ws spans with:
//   data-book="titus" data-ch="2" data-v="1" data-strong="g1319"
// or explicit data-ws-doc/href.
//
// Uses generator wrappers if present:
//   #ws-summary-text for hover + modal summary
//   #ws-full-body for modal full study
//
// IMPORTANT: This site often runs as SPA: book.html?book=... injects chapter HTML into #doc-target.
// Therefore we resolve relative paths against #doc-target[data-doc-dir] (set by load-doc.js).

(function () {
  // ---------------------------------------------------
  // State
  // ---------------------------------------------------
  let tooltipEl = null;
  let modalEl = null;

  // Cache fetched HTML word-study docs (keyed by absolute URL)
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
    hideTooltip();
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
  // SPA-aware base directory helpers
  // ---------------------------------------------------
  function getInjectedDocDir() {
    const target = document.getElementById("doc-target");
    if (target) {
      const dir = target.getAttribute("data-doc-dir");
      if (dir) return dir; // e.g. "/books/new-testament/titus/002/"
    }
    // Fallback: current page directory (if a chapter HTML is loaded directly)
    return window.location.pathname.replace(/[^/]*$/, "");
  }

  function toAbsoluteUrl(rawUrl) {
    if (!rawUrl) return null;

    // Already absolute
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;

    // Rooted site path
    if (rawUrl.startsWith("/")) return window.location.origin + rawUrl;

    // Otherwise treat as filename relative to injected doc directory
    const baseDir = getInjectedDocDir();
    const rel = rawUrl.replace(/^\.\//, "");
    return window.location.origin + baseDir + rel;
  }

  // ---------------------------------------------------
  // HTML loader (returns object, used consistently everywhere)
  // ---------------------------------------------------
  async function loadDocHtml(rawUrl) {
    const absUrl = toAbsoluteUrl(rawUrl);
    if (!absUrl) return { ok: false, url: null, status: 0, html: null };

    if (docCache.has(absUrl)) {
      return { ok: true, url: absUrl, status: 200, html: docCache.get(absUrl) };
    }

    try {
      const res = await fetch(absUrl, { cache: "no-store" });
      if (!res.ok) return { ok: false, url: absUrl, status: res.status, html: null };

      const txt = await res.text();
      const cleaned = fixMojibake(txt);
      docCache.set(absUrl, cleaned);

      return { ok: true, url: absUrl, status: res.status, html: cleaned };
    } catch {
      return { ok: false, url: absUrl, status: 0, html: null };
    }
  }

  // ---------------------------------------------------
  // Extractors
  // ---------------------------------------------------
  function extractSummaryFromHtml(fullHtml) {
    const temp = document.createElement("div");
    temp.innerHTML = fullHtml;

    // 1) Preferred: generator wrapper
    const wrapped = temp.querySelector("#ws-summary-text");
    if (wrapped) {
      const txt = (wrapped.textContent || "").replace(/\u00A0/g, " ").trim();
      if (txt) return txt;
    }

    // 2) Common format: a paragraph that starts with "Summary:"
    const ps = Array.from(temp.querySelectorAll("p"));
    for (const p of ps) {
      const t = (p.textContent || "").replace(/\u00A0/g, " ").trim();
      if (!t) continue;

      // "Summary: ...."
      if (t.toLowerCase().startsWith("summary:")) {
        const body = t.replace(/^summary:\s*/i, "").trim();
        return body || t;
      }
    }

    // 3) Fallback: between h2#summary and h2#full-study
    const h2 = temp.querySelector("h2#summary");
    if (h2) {
      const stop = temp.querySelector("h2#full-study");
      let el = h2.nextElementSibling;
      const parts = [];

      while (el) {
        if (stop && el === stop) break;
        if (el.tagName === "P") {
          const t = (el.textContent || "").replace(/\u00A0/g, " ").trim();
          if (t) parts.push(t);
        }
        el = el.nextElementSibling;
      }

      if (parts.length) return parts.join("\n\n");
    }

    return null;
  }

  function extractModalHtml(fullHtml) {
    const temp = document.createElement("div");
    temp.innerHTML = fullHtml;

    const summaryWrap = temp.querySelector("#ws-summary-text");
    const fullWrap = temp.querySelector("#ws-full-body");

    // If wrappers exist, build a clear modal with headings
    if (summaryWrap || fullWrap) {
      const summaryHtml = summaryWrap ? summaryWrap.innerHTML : "";
      const fullStudyHtml = fullWrap ? fullWrap.innerHTML : "";

      return `
        <h2>Summary</h2>
        <div>${summaryHtml || "<p class='muted'>No summary available.</p>"}</div>
        <h2>Full Study</h2>
        <div>${fullStudyHtml || "<p class='muted'>No full study available.</p>"}</div>
      `;
    }

    // Fallback: show #doc-root if present, else entire body
    const docRoot = temp.querySelector("#doc-root");
    if (docRoot) return docRoot.innerHTML;

    const body = temp.querySelector("body");
    if (body) return body.innerHTML;

    return temp.innerHTML;
  }

  // ---------------------------------------------------
  // Word-study element -> URL
  // ---------------------------------------------------
  function getDocUrlFromEl(el) {
    // Explicit URL wins (backward compatible)
    const d = el.getAttribute("data-ws-doc");
    if (d) return d;

    const href = el.getAttribute("href");
    if (href && href !== "#") return href;

    // Verse-aware metadata
    const book = (el.getAttribute("data-book") || "").trim();
    const ch = (el.getAttribute("data-ch") || "").trim();
    const v = (el.getAttribute("data-v") || "").trim();

    let strong = (el.getAttribute("data-strong") || "").trim().toLowerCase();
    if (!strong) {
      const m = (el.textContent || "").match(/\(([GH])\s*(\d+)\)/i);
      if (m) strong = m[1].toLowerCase() + m[2];
    }

    if (!book || !ch || !v || !strong) return null;

    // Return filename relative to injected doc directory
    return `${book}-${ch}-${v}-${strong}.html`;
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
      if (!docUrl) return;

      let hoverTimer = null;

      // Desktop hover: show extracted Summary
      if (!touch) {
        el.addEventListener("mouseenter", (e) => {
          hoverTimer = window.setTimeout(async () => {
            try {
              const r = await loadDocHtml(docUrl);
              if (!r.ok || !r.html) {
                showTooltip("Click for word study", e.clientX, e.clientY);
                return;
              }
              const summary = extractSummaryFromHtml(r.html);
              showTooltip(summary || "Click for word study", e.clientX, e.clientY);
            } catch (err) {
              console.error(err);
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

      // Click/tap: open modal
      const openWordStudy = async (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        hideTooltip();

        try {
          const r = await loadDocHtml(docUrl);

          if (!r.ok || !r.html) {
            showModal(
              `<p class="muted">No details available.</p>
               <p class="muted">URL: ${r.url || "(none)"}</p>
               <p class="muted">HTTP: ${r.status || "(failed)"}</p>`
            );
            return;
          }

          const modalHtml = extractModalHtml(r.html);
          showModal(modalHtml);
        } catch (err) {
          console.error(err);
          showModal("<p class='muted'>Could not load word study.</p>");
        }
      };

      if (touch) {
        el.addEventListener(
          "touchstart",
          (e) => {
            e.preventDefault();
            e.stopPropagation();
          },
          { passive: false }
        );

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
    bind: (root) => bindWordStudies(root || document),
  };

  document.addEventListener("DOMContentLoaded", startObservers);
})();