(function () {

  function setActiveAboutTab(doc) {
    const links = Array.from(document.querySelectorAll(".about-action"));
    links.forEach(a => {
      a.classList.remove("active");
      a.removeAttribute("aria-current");
    });

    if (!doc) return;

    const match = links.find(a => {
      try {
        const u = new URL(a.href, window.location.origin);
        return (u.searchParams.get("doc") || "") === doc;
      } catch {
        return false;
      }
    });

    if (match) {
      match.classList.add("active");
      match.setAttribute("aria-current", "page");
    }
  }

  function getDocParam() {
    const params = new URLSearchParams(window.location.search);
    return params.get("doc") || "about-this-resource.html";
  }

  function safeDocName(name) {
    // Only allow simple filenames to prevent path traversal
    return /^[a-z0-9\-]+\.html$/i.test(name) ? name : "about-this-resource.html";
  }

  const requested = safeDocName(getDocParam());
  setActiveAboutTab(requested);

  const docPath = "/about/" + requested;

  fetch(docPath, { cache: "no-store" })
    .then(r => {
      if (!r.ok) throw new Error("Failed to load: " + docPath);
      return r.text();
    })
    .then(html => {
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const root = parsed.querySelector("#doc-root");
      const content = root ? root.innerHTML : parsed.body.innerHTML;

      const target = document.getElementById("doc-target");
      target.innerHTML = content;
    })
    .catch(err => {
      const target = document.getElementById("doc-target");
      target.innerHTML = `<p>Content failed to load.</p><pre>${err.message}</pre>`;
    });

})();
