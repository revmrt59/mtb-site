// wordstudy-hover.js
// Desktop/laptop: hover shows extracted Summary from the word-study HTML; click opens full popup
// Mobile/touch: no hover tooltip; tap reliably opens full popup (and suppresses OS dictionary/selection)
// Supports verse-aware word studies via .ws spans with:
//   data-book="titus" data-ch="2" data-v="1" data-strong="g1319"
// or explicit data-ws-doc/href.
// Uses generator wrappers if present:
//   #ws-summary-text for hover
//   #ws-full-body for popup
//
// IMPORTANT: URL resolution uses window.location.href (not origin) to avoid <base href="/"> issues.
console.log("WS-HOVER VERSION: 2026-02-24-A");
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
  // URL helpers
  // ---------------------------------------------------
  function getCurrentDirPath() {
    // NOT affected by <base href="">
    // Example:
    //   /books/new-testament/titus/002/titus-2-chapter-explanation.html
    // -> /books/new-testament/titus/002/
    return window.location.pathname.replace(/[^/]*$/, "");
  }
  function getInjectedDocDir() {
  const target = document.getElementById("doc-target");
  const dir = target ? target.getAttribute("data-doc-dir") : null;
  if (dir) return dir; // e.g. "/books/new-testament/titus/002/"
  return window.location.pathname.replace(/[^/]*$/, "/");
}

  // Resolve any URL relative to the current page (NOT origin) so <base href="/"> can't break it.
  // Also: if a bare root path like "/titus-2-1-g1319.html" slips in, force it into current dir.
  function resolveDocUrl(raw) {
    if (!raw) return null;

    // already absolute
    if (/^https?:\/\//i.test(raw)) return raw;

    // root-absolute: if it's a bare word-study filename, treat it as chapter-local
    if (raw.startsWith("/") && /^\/[a-z0-9-]+-\d+-\d+-[gh]\d+\.html$/i.test(raw)) {
      raw = raw.slice(1);
    }

    try {
      // new URL(relative, window.location.href) resolves to the current directory
      return new URL(raw, window.location.href).toString();
    } catch {
      return null;
    }
  }

  function normalizeDocUrl(u) {
    // If absolute, keep
    if (/^https?:\/\//i.test(u)) return u;

    // If root-absolute, keep (resolveDocUrl will handle bare-word-study root case)
    if (u.startsWith("/")) return u;

    // Otherwise force relative to current directory (ignores <base href>)
    return getCurrentDirPath() + u.replace(/^\.\//, "");
  }

  // ---------------------------------------------------
  // HTML loading + parsing
  // ---------------------------------------------------
async function loadDocHtml(rawUrl) {
  if (!rawUrl) return { ok: false, url: null, status: 0, html: null };

  // If absolute URL already, use it
  if (/^https?:\/\//i.test(rawUrl)) {
    try {
      const res = await fetch(rawUrl, { cache: "no-store" });
      if (!res.ok) return { ok: false, url: rawUrl, status: res.status, html: null };
      const txt = await res.text();
      return { ok: true, url: rawUrl, status: res.status, html: fixMojibake(txt) };
    } catch {
      return { ok: false, url: rawUrl, status: 0, html: null };
    }
  }

 // Use injected document directory (set by load-doc.js)
const baseDir = getInjectedDocDir(); // e.g. "/books/new-testament/titus/002/"

// Normalize filename
let rel = rawUrl.replace(/^\.\//, "").replace(/^\/+/, "");

// Force into injected document directory
const absUrl = window.location.origin + baseDir + rel;

  try {
    const res = await fetch(absUrl, { cache: "no-store" });
    if (!res.ok) return { ok: false, url: absUrl, status: res.status, html: null };
    const txt = await res.text();
    return { ok: true, url: absUrl, status: res.status, html: fixMojibake(txt) };
  } catch {
    return { ok: false, url: absUrl, status: 0, html: null };
  }
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
  // Preferred: #ws-summary-text
  // Fallback: between h2#summary and h2#full-study, concatenating paragraphs
  function extractSummaryFromHtml(fullHtml) {
    const temp = document.createElement("div");
    temp.innerHTML = fullHtml;

    const root = temp.querySelector("#doc-root") || temp;

    const wrapped = root.querySelector("#ws-summary-text");
    if (wrapped) {
      const txt = (wrapped.textContent || "").replace(/\u00A0/g, " ").trim();
      return txt.length ? txt : null;
    }

    const h2 = root.querySelector("h2#summary");
    if (!h2) return null;

    const stop = root.querySelector("h2#full-study");
    let el = h2.nextElementSibling;
    const parts = [];

    while (el) {
      if (stop && el === stop) break;

      if (el.tagName === "P") {
        const txt = (el.textContent || "").replace(/\u00A0/g, " ").trim();
        if (txt.length) parts.push(txt);
      }
      el = el.nextElementSibling;
    }

    return parts.length ? parts.join("\n\n") : null;
  }

  // Full body extractor:
  // Preferred: #ws-full-body
  // Fallback: entire #doc-root
  function extractFullBodyHtml(fullHtml) {
    const temp = document.createElement("div");
    temp.innerHTML = fullHtml;

    const root = temp.querySelector("#doc-root") || temp;

    const full = root.querySelector("#ws-full-body");
    if (full) return full.innerHTML;

    return root.innerHTML;
  }

  // ---------------------------------------------------
  // Word-study element -> URL
  // ---------------------------------------------------
  function getDocUrlFromEl(el) {
    // Explicit URL wins (backward compatible)
    const d = el.getAttribute("data-ws-doc");
    if (d) return normalizeDocUrl(d);

    const href = el.getAttribute("href");
    if (href && href !== "#") return normalizeDocUrl(href);

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

    // Word studies live in the same chapter folder as the page that references them
    // IMPORTANT: return a relative filename, not a root path
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
      let hoverTimer = null;

      // Desktop hover: show extracted Summary
      if (!touch) {
        el.addEventListener("mouseenter", (e) => {
          hoverTimer = window.setTimeout(async () => {
            if (!docUrl) return;

            try {
              const fullHtml = await loadDocHtml(docUrl);
              if (!fullHtml) {
                showTooltip("Click for word study", e.clientX, e.clientY);
                return;
              }
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
        const r = await loadDocHtml(docUrl);

if (!r.ok || !r.html) {
  showModal(
    `<p class="muted">No details available.</p>
     <p class="muted">URL: ${r.url || "(none)"}</p>
     <p class="muted">HTTP: ${r.status || "(failed)"}</p>`
  );
  return;
}

const bodyHtml = extractFullBodyHtml(r.html);
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