(function () {
  function applyMode(mode) {
    // mode: "both" | "nkjv" | "nlt"
    const table = document.querySelector("#doc-target table");
    if (!table) return;

    const rows = Array.from(table.querySelectorAll("tr"));
    rows.forEach((r) => {
      const cells = Array.from(r.querySelectorAll("th, td"));
      if (cells.length < 3) return;

      const nkjv = cells[1]; // col 2
      const nlt  = cells[2]; // col 3

      // reset
      nkjv.style.display = "";
      nlt.style.display = "";

      if (mode === "nkjv") nlt.style.display = "none";
      if (mode === "nlt")  nkjv.style.display = "none";
    });
  }

  function addControls() {
    const target = document.getElementById("doc-target");
    if (!target) return;

    // remove existing
    const existing = document.querySelector(".scripture-controls");
    if (existing) existing.remove();

    const bar = document.createElement("div");
    bar.className = "scripture-controls";

    const makeBtn = (label, mode) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sc-btn";
      b.textContent = label;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        setActive(mode);
        applyMode(mode);
      });
      return b;
    };

    const btnBoth = makeBtn("Both", "both");
    const btnNKJV = makeBtn("NKJV Only", "nkjv");
    const btnNLT  = makeBtn("NLT Only", "nlt");

    function setActive(mode) {
      [btnBoth, btnNKJV, btnNLT].forEach(x => x.classList.remove("is-active"));
      if (mode === "both") btnBoth.classList.add("is-active");
      if (mode === "nkjv") btnNKJV.classList.add("is-active");
      if (mode === "nlt")  btnNLT.classList.add("is-active");
    }

    bar.append(btnBoth, btnNKJV, btnNLT);
    target.parentNode.insertBefore(bar, target);

    setActive("both");
    applyMode("both");
  }

  window.addScriptureControls = addControls;

  // marker
  window.__mtbScriptureControlsLoaded = true;
})();
