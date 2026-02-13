(function () {
  "use strict";

  // =========================================================
  // HELPERS
  // =========================================================

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  // Prevent path traversal and weird inputs.
  // Allow site-relative paths like:
  //   books/old-testament/obadiah/obadiah-1-resources-xyz.html
  function sanitizeDocParam(doc) {
    const s = String(doc || "").trim().replace(/\\/g, "/");
    if (!s) return "";
    if (s.includes("..")) return "";      // block traversal
    if (s.startsWith("/")) return "";     // block absolute paths
    return s;
  }

  // Encode path safely without encoding slashes.
  function encodePath(path) {
    return path
      .split("/")
      .map(seg => encodeURIComponent(seg))
      .join("/");
  }

  // If doc includes '/', treat as site-relative path and fetch from '/<doc>'.
  // Otherwise, treat as bible-level filename and fetch from '/resources/<doc>'.
  function buildFetchUrl(doc) {
    if (doc.includes("/")) {
      return "/" + encodePath(doc.replace(/^\/+/, ""));
    }
    return "/resources/" + encodePath(doc);
  }

  function cleanMeta(s) {
    return String(s || "")
      .replace(/^(Title|Description)\s*:\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // =========================================================
  // DOM
  // =========================================================

  const target = document.getElementById("doc-target");
  const titleEl = document.getElementById("resource-title");
  const descEl = document.getElementById("resource-desc");
  const linksEl = document.getElementById("resource-links");

  function setHeader(title, desc) {
    if (titleEl) titleEl.textContent = title || "Resource";
    if (descEl) descEl.textContent = desc || "";
    document.title = "Mastering the Bible - " + (title || "Resource");
  }

  // History-based Back link: always returns to where the user came from.
  function setLinks(extraHtml) {
    if (!linksEl) return;

    linksEl.innerHTML =
      `<a href="#" id="mtb-back-link">Back</a>` +
      (extraHtml ? ` | ${extraHtml}` : "");

    const backLink = document.getElementById("mtb-back-link");
    if (backLink) {
      backLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (window.history.length > 1) {
          window.history.back();
        } else {
          // Fallback if opened in a new tab
          window.location.href = "/resources/index.html";
        }
      });
    }
  }

  // =========================================================
  // MAIN
  // =========================================================

  async function loadResource() {
    if (!target) {
      setHeader("Resource", "");
      setLinks(`<span class="muted">Missing #doc-target in view.html</span>`);
      return;
    }

    const rawDoc = getParam("doc");
    const doc = sanitizeDocParam(rawDoc);

    if (!doc) {
      setHeader("No resource selected", "");
      setLinks("");
      target.innerHTML = `<p class="muted">Missing or invalid doc parameter.</p>`;
      return;
    }

    const url = buildFetchUrl(doc);

    setLinks(`<span class="muted">Loading…</span>`);

    let html = "";
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        setHeader("Resource file not found", "");
        setLinks(`<span class="muted">HTTP ${res.status}: ${url}</span>`);
        target.innerHTML = `<p class="muted">Resource file not found.</p>`;
        return;
      }
      html = await res.text();
    } catch (err) {
      setHeader("Fetch failed", "");
      setLinks(`<span class="muted">Error fetching ${url}</span>`);
      target.innerHTML = `<p class="muted">Fetch failed: ${String(err)}</p>`;
      return;
    }

    const temp = document.createElement("div");
    temp.innerHTML = html;

    const docRoot = temp.querySelector("#doc-root") || temp;

    const top = Array.from(docRoot.children)
      .map(el => ({ el, text: (el.textContent || "").trim() }))
      .filter(x => x.text.length > 0);

    const title = cleanMeta(top[0]?.text || "Resource");
    const desc  = cleanMeta(top[1]?.text || "");

    setHeader(title, desc);
    setLinks(""); // show Back (no extra)

    if (top[0]?.el) top[0].el.remove();
    if (top[1]?.el) top[1].el.remove();

    target.innerHTML = docRoot.innerHTML;
  }

  loadResource();
})();
