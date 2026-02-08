(function () {
  const target = document.getElementById("doc-target");
  const titleEl = document.getElementById("resource-title");
  const descEl = document.getElementById("resource-desc");
  const linksEl = document.getElementById("resource-links");

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function cleanMeta(s) {
    return String(s || "")
      .replace(/^(Title|Description)\s*:\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function setHeader(title, desc) {
    if (titleEl) titleEl.textContent = title || "Resource";
    if (descEl) descEl.textContent = desc || "";
    document.title = "Mastering the Bible - " + (title || "Resource");
  }

  function setLinks(html) {
    if (!linksEl) return;
    linksEl.innerHTML = `<a href="/resources/index.html">Back to Resources</a>` + (html ? ` | ${html}` : "");
  }

  async function loadResource() {
    // If target is missing, nothing can render.
    if (!target) {
      setHeader("Resource", "");
      setLinks(`<span class="muted">Missing #doc-target in view.html</span>`);
      return;
    }

    const doc = (getParam("doc") || "").trim();
    if (!doc) {
      setHeader("No resource selected", "");
      setLinks("");
      target.innerHTML = `<p class="muted">Missing doc parameter. <a href="/resources/index.html">Go back</a>.</p>`;
      return;
    }

    const url = "/resources/" + encodeURIComponent(doc);
    setLinks(`<span class="muted">Loading…</span>`);

    let html = "";
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        setHeader("Resource file not found", "");
        setLinks(`<span class="muted">HTTP ${res.status}: ${url}</span>`);
        target.innerHTML = `<p class="muted">Resource file not found. <a href="/resources/index.html">Go back</a>.</p>`;
        return;
      }
      html = await res.text();
    } catch (err) {
      setHeader("Fetch failed", "");
      setLinks(`<span class="muted">Error fetching ${url}</span>`);
      target.innerHTML = `<p class="muted">Fetch failed: ${String(err)}</p>`;
      return;
    }

    // Parse fragment HTML
    const temp = document.createElement("div");
    temp.innerHTML = html;

    // Prefer doc-root wrapper if present
    const docRoot = temp.querySelector("#doc-root") || temp;

    // Find first two meaningful TOP-LEVEL blocks (robust for headings or paragraphs)
    const top = Array.from(docRoot.children)
      .map(el => ({ el, text: (el.textContent || "").trim() }))
      .filter(x => x.text.length > 0);

    const title = cleanMeta(top[0]?.text || "Resource");
    const desc = cleanMeta(top[1]?.text || "");

    setHeader(title, desc);
    setLinks(""); // clear Loading

    // Remove those exact blocks from the body so they don’t duplicate
    if (top[0]?.el) top[0].el.remove();
    if (top[1]?.el) top[1].el.remove();

    // Render remaining content
    target.innerHTML = docRoot.innerHTML;
  }

  loadResource();
})();
