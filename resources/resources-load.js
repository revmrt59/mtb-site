/* File: /assets/js/resources-load.js */
(function () {
  const target = document.getElementById("doc-target");
  const titleEl = document.getElementById("resource-title");
  const descEl = document.getElementById("resource-desc");
  const linksEl = document.getElementById("resource-links");

  function getParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function normalizeDoc(doc) {
    // Keep it simple and safe: only allow filenames, no paths
    // Example: "how-to-read.html"
    if (!doc) return "";
    doc = String(doc).trim();
    doc = doc.replace(/\\/g, "/");
    doc = doc.split("/").pop(); // filename only
    return doc;
  }

  function isMeaningfulElement(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "script" || tag === "style" || tag === "noscript") return false;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    return text.length > 0;
  }

  function firstTwoMetaBlocks(container) {
    const kids = Array.from(container.children || []);
    const meaningful = kids.filter(isMeaningfulElement);
    const first = meaningful[0] || null;
    const second = meaningful[1] || null;

    const firstText = first ? (first.textContent || "").trim() : "";
    const secondText = second ? (second.textContent || "").trim() : "";

    return { first, second, firstText, secondText };
  }

  function removeMetaBlocks(meta) {
    try { if (meta.first) meta.first.remove(); } catch (e) {}
    try { if (meta.second) meta.second.remove(); } catch (e) {}
  }

  function buildPdfHref(docFile) {
    const base = docFile.replace(/\.html?$/i, "");
    return base ? ("/resources/pdf/" + base + ".pdf") : "";
  }

  function setHeader(title, desc) {
    if (titleEl && title) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc || "";
  }

  function setLinks(docFile) {
    if (!linksEl) return;

    const back = `<a href="/resources/index.html">Back to Resources</a>`;
    const pdfHref = buildPdfHref(docFile);

    // Check if PDF exists, then show link
    fetch(pdfHref, { method: "HEAD" })
      .then(r => {
        const pdf = r.ok ? ` | <a href="${pdfHref}">Open PDF</a>` : "";
        linksEl.innerHTML = back + pdf;
      })
      .catch(() => {
        linksEl.innerHTML = back;
      });
  }

  async function loadResource() {
    const raw = getParam("doc");
    const doc = normalizeDoc(raw);

    if (!doc) {
      if (target) target.innerHTML = `<p class="muted">No resource selected. <a href="/resources/index.html">Go back</a>.</p>`;
      setHeader("Resource", "");
      if (linksEl) linksEl.innerHTML = `<a href="/resources/index.html">Back to Resources</a>`;
      return;
    }

    setLinks(doc);

    const url = "/resources/" + encodeURIComponent(doc);

    let html;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Resource not found: " + url);
      html = await res.text();
    } catch (err) {
      console.error(err);
      if (target) target.innerHTML = `<p class="muted">Resource file not found. <a href="/resources/index.html">Go back</a>.</p>`;
      setHeader("Resource", "");
      return;
    }

    // Parse fetched HTML and extract body content
    const parser = new DOMParser();
    const docDom = parser.parseFromString(html, "text/html");

    const body = docDom.body;
    if (!body) {
      if (target) target.innerHTML = `<p class="muted">Could not read resource content.</p>`;
      return;
    }

    // We assume first two meaningful blocks are title and description
    const meta = firstTwoMetaBlocks(body);

    // Put title and description into the page header
    const t = meta.firstText || "Resource";
    const d = meta.secondText || "";
    setHeader(t, d);

    // Remove them from displayed content
    removeMetaBlocks(meta);

    // Inject remaining HTML into the viewer
    if (target) {
      target.innerHTML = body.innerHTML;
    }

    // Update document title
    document.title = "Mastering the Bible - " + t;
  }

  loadResource();
})();
