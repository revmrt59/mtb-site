(function () {
  // Determine which generated HTML file to load
  const params = new URLSearchParams(window.location.search);
  const docName = params.get("doc") || "titus-0-book-introduction.html";
  const docPath = "/generated/" + docName;

  fetch(docPath, { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error("Failed to load: " + docPath);
      return r.text();
    })
    .then((html) => {
      // Parse the HTML we fetched
      const parsed = new DOMParser().parseFromString(html, "text/html");

      // Prefer the Pandoc template wrapper if present
      const root = parsed.querySelector("#doc-root");

      // Inject only the document body content
      const content = root
        ? root.innerHTML
        : (parsed.body ? parsed.body.innerHTML : html);

      const target = document.getElementById("doc-target");
      if (!target) throw new Error("Missing #doc-target in book.html");

      target.innerHTML = content;
    })
    .catch((err) => {
      const target = document.getElementById("doc-target");
      if (target) {
        target.innerHTML =
          "<p>Error loading document.</p><pre>" + err.message + "</pre>";
      }
    });
})();
