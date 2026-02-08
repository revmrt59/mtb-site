(function () {
  const target = document.getElementById("doc-target");
  const titleEl = document.getElementById("resource-title");
  const descEl = document.getElementById("resource-desc");
  const linksEl = document.getElementById("resource-links");

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function normalizeDoc(doc) {
    if (!doc) return "";
    doc = String(doc).trim().replace(/\\/g, "/");
    doc = doc.split("/").pop(); // filename only
    return doc;
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

  function setLinks(msgHtml) {
    if (!linksEl) return;
    linksEl.innerHTML = `<a href="/resources/index.html">Back to Resources</a>` + (msgHtml ? ` | ${msgHtml}` : "");
  }

  async function loadResource() {
    if (!target) return;

    const doc = normalizeDoc(getParam("doc"));
    if (!doc) {
      setHeader("No resource selected", "");
      setLinks("");
      target.innerHTML = `<p class="muted">Missing doc parameter. <a href="/resources/index.html">Go back</a>.</p>`;
      return;
    }

    const url = "/resources/" + encodeURIComponent(doc);
    setLinks(`<span class="muted">Loading: ${url}</span>`);

    let html = "";
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        setHeader("Resource file not found", "");
        setLinks(`<span class="muted">Not found: ${url} (HTTP ${res.status})</span>`);
        target.innerHTML = `<p class="muted">Resource file not found. <a href="/resources/index.html">Go back</a>.</p>`;
        return;
      }
      html = await res.text();
    } catch (err) {
      console.error(err);
      setHeader("Fetch failed", "");
      setLinks(`<span class="muted">Error fetching: ${url}</span>`);
      target.innerHTML = `<p class="muted">Fetch failed: ${String(err)}</p>`;
      return;
    }

    // Parse fragment HTML
    const temp = document.createElement("div");
    temp.innerHTML = html;

    const root = temp.querySelector("#doc-root") || temp;

  // Strip Title: and Description: lines from the body and use them for the header
let title = "Resource";
let desc = "";

const labeled = Array.from(root.querySelectorAll("p, h1, h2, h3, h4, h5, h6, div"))
  .map(el => ({ el, text: (el.textContent || "").trim() }))
  .filter(x => x.text.length > 0);

const titleItem = labeled.find(x => /^Title\s*:/i.test(x.text));
if (titleItem) {
  title = cleanMeta(titleItem.text);
  titleItem.el.remove();
}

const descItem = labeled.find(x => /^Description\s*:/i.test(x.text));
if (descItem) {
  desc = cleanMeta(descItem.text);
  descItem.el.remove();
}

setHeader(title, desc);



    target.innerHTML = root.innerHTML;
  }

  loadResource();
})();
