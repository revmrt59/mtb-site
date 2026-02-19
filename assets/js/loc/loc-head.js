(async function () {
    document.body.classList.add("loc-index");

  const tableHost = document.getElementById("loc-head-table");
  if (!tableHost) return;

  const searchEl = document.getElementById("loc-search");
  const rollupEl = document.getElementById("loc-rollup");
  const phaseEl  = document.getElementById("loc-phase");

  const dataUrl = "/assets/js/loc/life-of-christ-harmony-table.json";
  const rows = await fetch(dataUrl).then(r => r.json());

  function uniqSorted(values) {
    return Array.from(new Set(values.filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
  }

  function fillSelect(sel, items) {
    sel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "All";
    sel.appendChild(optAll);

    items.forEach(v => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
  }

  fillSelect(rollupEl, uniqSorted(rows.map(r => r.rollup)));
  fillSelect(phaseEl,  uniqSorted(rows.map(r => r.phase)));

  function matches(row, q, rollup, phase) {
    if (rollup && row.rollup !== rollup) return false;
    if (phase && row.phase !== phase) return false;
    if (!q) return true;

    const hay = [
      row.seq,
      row.rollup,
      row.phase,
      row.approxDate,
      row.title,
      row?.refs?.matthew,
      row?.refs?.mark,
      row?.refs?.luke,
      row?.refs?.john
    ].join(" ").toLowerCase();

    return hay.includes(q);
  }

  function makeLocUrl(seq) {
    const url = new URL(window.location.href);
    url.pathname = "/loc.html";
    url.searchParams.set("loc", seq);
    url.searchParams.set("tab", "scripture_harmony");
    return url.toString();
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function render() {
    const q = (searchEl?.value || "").trim().toLowerCase();
    const rollup = rollupEl?.value || "";
    const phase = phaseEl?.value || "";

    const filtered = rows.filter(r => matches(r, q, rollup, phase));

    const html = [];
    html.push(`<table class="mtb-loc-head-table">`);
    html.push(`<thead>
    <tr>
        <th class="col-seq">Seq</th>
        <th class="col-rollup">Rollup</th>
        <th class="col-phase">Phase</th>
        <th class="col-date">Approx Date</th>
        <th class="col-title">Event Title</th>
        <th class="col-matt">Matthew</th>
        <th class="col-mark">Mark</th>
        <th class="col-luke">Luke</th>
        <th class="col-john">John</th>
    </tr>
    </thead>`);

    html.push(`<tbody>`);

    for (const r of filtered) {
      const link = makeLocUrl(r.seq);
      const refs = r.refs || {};

html.push(`<tr>
  <td class="col-seq"><a class="loc-link" href="${link}">${escapeHtml(r.seq)}</a></td>
  <td class="col-rollup">${escapeHtml(r.rollup)}</td>
  <td class="col-phase">${escapeHtml(r.phase)}</td>
  <td class="col-date">${escapeHtml(r.approxDate)}</td>
  <td class="col-title"><a class="loc-link" href="${link}">${escapeHtml(r.title)}</a></td>
  <td class="col-matt">${escapeHtml(refs.matthew)}</td>
  <td class="col-mark">${escapeHtml(refs.mark)}</td>
  <td class="col-luke">${escapeHtml(refs.luke)}</td>
  <td class="col-john">${escapeHtml(refs.john)}</td>
</tr>`);

    }

    html.push(`</tbody></table>`);
    tableHost.innerHTML = html.join("");
  }

  if (searchEl) searchEl.addEventListener("input", render);
  if (rollupEl) rollupEl.addEventListener("change", render);
  if (phaseEl)  phaseEl.addEventListener("change", render);
console.log("LOC-HEAD JS VERSION: 2026-02-16 A");
  render();
})();
