(function () {
  function addControls() {
    const target = document.getElementById("doc-target");
    if (!target) return;

    // Remove existing bar
    const existing = document.querySelector(".scripture-controls");
    if (existing) existing.remove();

    const bar = document.createElement("div");
    bar.className = "scripture-controls";

    const makeBtn = (label, onClick, extraClass) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sc-btn" + (extraClass ? " " + extraClass : "");
      b.textContent = label;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        onClick();
      });
      return b;
    };

    const btnBoth = makeBtn("Both", () => {
      document.body.classList.remove("hide-nkjv");
      document.body.classList.remove("hide-nlt");
    }, "sc-btn-reset");

    const btnNKJV = makeBtn("NKJV Only", () => {
      document.body.classList.remove("hide-nkjv");
      document.body.classList.add("hide-nlt");
    });

    const btnNLT = makeBtn("NLT Only", () => {
      document.body.classList.add("hide-nkjv");
      document.body.classList.remove("hide-nlt");
    });

    bar.appendChild(btnBoth);
    bar.appendChild(btnNKJV);
    bar.appendChild(btnNLT);

    // Insert above content
    target.parentNode.insertBefore(bar, target);
  }

  function removeControls() {
    const existing = document.querySelector(".scripture-controls");
    if (existing) existing.remove();
    document.body.classList.remove("hide-nkjv");
    document.body.classList.remove("hide-nlt");
  }

  // Expose globally
  window.addScriptureControls = addControls;
  window.removeScriptureControls = removeControls;

  // Debug marker: lets you confirm the script loaded
  window.__mtbScriptureControlsLoaded = true;
})();
