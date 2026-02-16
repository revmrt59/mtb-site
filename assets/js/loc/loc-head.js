(async function () {
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
        <th style="width:70px;">Seq</th>
        <th style="width:140px;">Rollup</th>
        <th style="width:160px;">Phase</th>
        <th style="width:140px;">Approx Date</th>
        <th style="min-width:260px;">Event Title</th>
        <th style="width:140px;">Matthew</th>
        <th style="width:140px;">Mark</th>
        <th style="width:140px;">Luke</th>
        <th style="width:140px;">John</th>
      </tr>
    </thead>`);
    html.push(`<tbody>`);

    for (const r of filtered) {
      const link = makeLocUrl(r.seq);
      const refs = r.refs || {};

      html.push(`<tr>
        <td><a class="loc-link" href="${link}">${escapeHtml(r.seq)}</a></td>
        <td>${escapeHtml(r.rollup)}</td>
        <td>${escapeHtml(r.phase)}</td>
        <td>${escapeHtml(r.approxDate)}</td>
        <td><a class="loc-link" href="${link}">${escapeHtml(r.title)}</a></td>

        <!-- Plain text only (no links) -->
        <td>${escapeHtml(refs.matthew)}</td>
        <td>${escapeHtml(refs.mark)}</td>
        <td>${escapeHtml(refs.luke)}</td>
        <td>${escapeHtml(refs.john)}</td>
      </tr>`);
    }

    html.push(`</tbody></table>`);
    tableHost.innerHTML = html.join("");
  }

  if (searchEl) searchEl.addEventListener("input", render);
  if (rollupEl) rollupEl.addEventListener("change", render);
  if (phaseEl)  phaseEl.addEventListener("change", render);

  render();
})();
