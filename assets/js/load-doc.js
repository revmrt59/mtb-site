(function () {

  function parseDocName(docName) {
    // Expected:
    // <book>-0-book-introduction.html
    // <book>-<n>-chapter-orientation.html
    // <book>-<n>-chapter-teaching.html
    // <book>-<n>-chapter-scripture.html  (new)
    const intro = docName.match(/^([a-z0-9-]+)-0-book-introduction\.html$/);
    if (intro) {
      return { book: intro[1], chapter: 0, type: "book-introduction" };
    }

    const chap = docName.match(/^([a-z0-9-]+)-(\d+)-chapter-(orientation|teaching|scripture)\.html$/);
    if (chap) {
      return { book: chap[1], chapter: Number(chap[2]), type: "chapter-" + chap[3] };
    }

    return { book: "", chapter: null, type: "" };
  }

  function setBodyDocMeta(meta) {
    document.body.dataset.docType = meta.type || "";
    document.body.dataset.book = meta.book || "";
    document.body.dataset.chapter = (meta.chapter === null || meta.chapter === undefined) ? "" : String(meta.chapter);
  }

  function markTeachingScriptureBlocks(targetEl) {
    // Rule: In Teaching docs, Scripture sections are denoted by H5.
    // Make H5 and the elements that follow it (until the next heading) blue.
    const h5s = Array.from(targetEl.querySelectorAll("h5"));
    if (!h5s.length) return;

    const headingSelector = "h1,h2,h3,h4,h5";

    h5s.forEach(h5 => {
      h5.classList.add("mtb-scripture");

      let node = h5.nextElementSibling;
      while (node) {
        if (node.matches(headingSelector)) break;
        node.classList.add("mtb-scripture");
        node = node.nextElementSibling;
      }
    });
  }

  // -------------------------
  // Modal popup provision
  // -------------------------
  let POPUPS = null;

  function ensureModalExists() {
    if (document.getElementById("mtbModal")) return;

    const modal = document.createElement("div");
    modal.id = "mtbModal";
    modal.className = "mtb-modal";
    modal.hidden = true;

    modal.innerHTML = `
      <div class="mtb-modal-inner" role="dialog" aria-modal="true" aria-label="Popup">
        <button id="mtbModalClose" class="mtb-modal-close" type="button">Close</button>
        <h3 id="mtbModalTitle"></h3>
        <div id="mtbModalBody"></div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById("mtbModalClose");
    closeBtn.addEventListener("click", closePopup);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closePopup();
    });
  }

  function openPopup(title, html) {
    ensureModalExists();

    const modal = document.getElementById("mtbModal");
    const t = document.getElementById("mtbModalTitle");
    const b = document.getElementById("mtbModalBody");

    t.textContent = title || "";
    b.innerHTML = html || "";
    modal.hidden = false;
  }

  function closePopup() {
    const modal = document.getElementById("mtbModal");
    if (modal) modal.hidden = true;
  }

  async function loadPopupsIfPresent() {
    if (POPUPS !== null) return; // already attempted
    try {
      const r = await fetch("/assets/data/mtb-popups.json", { cache: "no-store" });
      if (!r.ok) {
        POPUPS = {};
        return;
      }
      POPUPS = await r.json();
    } catch {
      POPUPS = {};
    }
  }

  function wirePopupClicks() {
    document.addEventListener("click", async (e) => {
      const a = e.target.closest("a.mtb-popup");
      if (!a) return;

      e.preventDefault();

      await loadPopupsIfPresent();

      const id = a.getAttribute("data-popup-id") || "";
      if (POPUPS && POPUPS[id]) {
        openPopup(POPUPS[id].title || "Note", POPUPS[id].html || "");
      } else {
        openPopup("Note", "<p>Popup placeholder. Add this id to /assets/data/mtb-popups.json:</p><pre>" + id + "</pre>");
      }
    });
  }

  // -------------------------
  // Load doc
  // -------------------------
  const params = new URLSearchParams(window.location.search);
  const docName = params.get("doc") || "titus-0-book-introduction.html";
  const docPath = "/generated/" + docName;

  const meta = parseDocName(docName);
  setBodyDocMeta(meta);

  wirePopupClicks();

  fetch(docPath, { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error("Failed to load: " + docPath);
      return r.text();
    })
    .then((html) => {
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const root = parsed.querySelector("#doc-root");

      const content = root
        ? root.innerHTML
        : (parsed.body ? parsed.body.innerHTML : html);

      const target = document.getElementById("doc-target");
      if (!target) throw new Error("Missing #doc-target in book.html");

      target.innerHTML = content;

      // Only Scripture-in-Teaching becomes blue
      if (meta.type === "chapter-teaching") {
        markTeachingScriptureBlocks(target);
      }
    })
    .catch((err) => {
      const target = document.getElementById("doc-target");
      if (target) {
        target.innerHTML =
          "<p>Error loading document.</p><pre>" + err.message + "</pre>";
      }
    });

})();
