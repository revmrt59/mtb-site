(function () {
  "use strict";

  var availabilityKey = "";
  var availabilityPath = "";
  var availabilityPromise = null;
  var cachedDocPath = "";
  var cachedDoc = null;

  function context() {
    var p = new URLSearchParams(window.location.search);
    var book = String(p.get("book") || document.body.dataset.book || "").toLowerCase().trim().replace(/\s+/g,"-");
    if (book === "psalm") book = "psalms";
    var chapter = parseInt(p.get("chapter") || document.body.dataset.chapter || "0",10);
    if (!book || !Number.isFinite(chapter) || chapter < 1) return null;

    var nt = {
      "matthew":1,"mark":1,"luke":1,"john":1,"acts":1,"romans":1,
      "1-corinthians":1,"2-corinthians":1,"galatians":1,"ephesians":1,
      "philippians":1,"colossians":1,"1-thessalonians":1,"2-thessalonians":1,
      "1-timothy":1,"2-timothy":1,"titus":1,"philemon":1,"hebrews":1,
      "james":1,"1-peter":1,"2-peter":1,"1-john":1,"2-john":1,
      "3-john":1,"jude":1,"revelation":1
    };

    return { book:book, chapter:chapter, folder:String(chapter).padStart(3,"0"), testament:nt[book] ? "new-testament" : "old-testament" };
  }

  function contextKey(c) { return c ? (c.book + ":" + c.chapter) : ""; }

  async function findHearingPath() {
    var c = context();
    if (!c) return "";
    var key = contextKey(c);
    if (key === availabilityKey && availabilityPath) return availabilityPath;
    if (key === availabilityKey && availabilityPromise) return availabilityPromise;

    availabilityKey = key;
    availabilityPath = "";
    availabilityPromise = (async function () {
      var base = "/books/" + c.testament + "/" + c.book + "/" + c.folder + "/" + c.book + "-" + c.chapter + "-chapter-hearing";
      var candidates = [base + ".html", base + "-draft.html"];
      for (var i=0; i<candidates.length; i++) {
        try {
          var r = await fetch(candidates[i], { method:"GET", cache:"no-store" });
          if (!r.ok) continue;
          var html = await r.text();
          if (!/data-doc-type=["']chapter-hearing["']/i.test(html) && !/mtb-chapter-hearing/i.test(html)) continue;
          availabilityPath = candidates[i];
          return availabilityPath;
        } catch (_) {}
      }
      return "";
    })();

    var result = await availabilityPromise;
    availabilityPromise = null;
    return result;
  }

  async function hearingDoc() {
    var path = await findHearingPath();
    if (!path) throw new Error("Hearing God's Voice is not available for this chapter.");
    if (cachedDoc && cachedDocPath === path) return cachedDoc;
    var r = await fetch(path,{cache:"no-store"});
    if (!r.ok) throw new Error("Could not load Hearing God's Voice.");
    cachedDocPath = path;
    cachedDoc = new DOMParser().parseFromString(await r.text(),"text/html");
    return cachedDoc;
  }

  function installStyle() {
    if (document.getElementById("mtb-hearing-voice-style")) return;
    var st = document.createElement("style");
    st.id = "mtb-hearing-voice-style";
    st.textContent = ".mtb-scripture-verse-cell{min-width:76px}.mtb-verse-hearing-button{margin-left:4px;font-weight:800}.mtb-hearing-popup-overlay{position:fixed;inset:0;z-index:10050;background:rgba(17,31,43,.58);display:none;align-items:center;justify-content:center;padding:24px}.mtb-hearing-popup-overlay.is-open{display:flex}.mtb-hearing-popup{width:min(1050px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 22px 70px rgba(0,0,0,.28);position:relative}.mtb-hearing-popup-close{position:absolute;right:14px;top:12px;border:0;background:transparent;font-size:1.6rem;cursor:pointer;color:#173a5e}.mtb-hearing-popup-head{padding:14px 54px 12px 22px;background:#edf4f8;border-bottom:1px solid #cbd8e3}.mtb-hearing-popup-title{margin:0 0 3px;color:#8a611f;font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.mtb-hearing-popup-ref{font-size:1.08rem;font-weight:800;color:#173a5e}.mtb-hearing-popup-body{padding:16px 18px 18px}.mtb-hearing-popup-context{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.1fr);gap:0;margin:0 0 14px;border:1px solid #cbd8e3;border-radius:9px;overflow:hidden;background:#edf4f8}.mtb-hearing-popup-context-cell{min-width:0;padding:12px 14px;border-right:1px solid #cbd8e3;line-height:1.5}.mtb-hearing-popup-context-cell:last-child{border-right:0}.mtb-hearing-popup-context-label{display:block;margin:0 0 5px;color:#173a5e;font-size:.74rem;font-weight:800;letter-spacing:.02em}.mtb-hearing-popup-context-understand .mtb-hearing-popup-context-label{color:#8a611f}.mtb-hearing-popup-context-content{color:#26384a}.mtb-hearing-popup-context-content p{margin:0 0 .65em}.mtb-hearing-popup-context-content p:last-child{margin-bottom:0}.mtb-hearing-popup-understand{display:none}.mtb-hearing-popup-understand h3,.mtb-hearing-popup-panel h3{margin:0;padding:8px 13px;background:#f7f8f9;color:#8a611f;font-size:.79rem;font-weight:800;letter-spacing:.02em}.mtb-hearing-popup-content{padding:14px 16px;line-height:1.58}.mtb-hearing-popup-content p{margin:0 0 .85em}.mtb-hearing-popup-content p:last-child{margin-bottom:0}.mtb-hearing-popup-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin:0 0 14px;align-items:stretch}.mtb-hearing-popup-row:last-child{margin-bottom:0}.mtb-hearing-popup-row-label{grid-column:1/-1;margin:0 0 -3px;color:#6b7782;font-size:.70rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.mtb-hearing-popup-panel{margin:0;border:1px solid #d7e0e8;border-radius:9px;overflow:hidden;background:#fff}.mtb-hearing-popup-panel[data-hearing-field=\"notice\"]{grid-column:1}.mtb-hearing-popup-panel[data-hearing-field=\"hear\"]{grid-column:2}@media(max-width:760px){.mtb-hearing-popup-context{grid-template-columns:1fr}.mtb-hearing-popup-context-cell{border-right:0;border-bottom:1px solid #cbd8e3}.mtb-hearing-popup-context-cell:last-child{border-bottom:0}.mtb-hearing-popup-row{grid-template-columns:1fr}.mtb-hearing-popup-panel[data-hearing-field=\"notice\"],.mtb-hearing-popup-panel[data-hearing-field=\"hear\"]{grid-column:1}}";
    document.head.appendChild(st);
  }

  function modal() {
    installStyle();
    var overlay = document.getElementById("mtb-hearing-popup-overlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "mtb-hearing-popup-overlay";
    overlay.className = "mtb-hearing-popup-overlay";
    overlay.setAttribute("aria-hidden","true");
    overlay.innerHTML = `<div class="mtb-hearing-popup" role="dialog" aria-modal="true" aria-labelledby="mtb-hearing-popup-ref"><button type="button" class="mtb-hearing-popup-close" aria-label="Close">×</button><div class="mtb-hearing-popup-head"><div class="mtb-hearing-popup-title">Hearing God's Voice</div><div id="mtb-hearing-popup-ref" class="mtb-hearing-popup-ref"></div></div><div class="mtb-hearing-popup-body"></div></div>`;
    document.body.appendChild(overlay);
    function close(){ overlay.classList.remove("is-open"); overlay.setAttribute("aria-hidden","true"); }
    overlay.querySelector(".mtb-hearing-popup-close").addEventListener("click",close);
    overlay.addEventListener("click",function(e){if(e.target===overlay)close();});
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&overlay.classList.contains("is-open"))close();});
    return overlay;
  }

  async function openVerse(verse) {
    var overlay = modal();
    var c = context();
    var ref = overlay.querySelector(".mtb-hearing-popup-ref");
    var body = overlay.querySelector(".mtb-hearing-popup-body");
    var pretty = c ? c.book.replace(/-/g," ").replace(/\b\w/g,function(x){return x.toUpperCase();}) : "";
    ref.textContent = pretty + (c ? (" " + c.chapter + ":" + verse) : ("Verse " + verse));
    body.innerHTML = '<p>Loading…</p>';
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden","false");

    try {
      var doc = await hearingDoc();
      var block = doc.querySelector('details.mtb-hearing-verse[data-verse="' + Number(verse) + '"]');
      if (!block) throw new Error("No Hearing God's Voice content was found for this verse.");
      var scriptureCells = block.querySelectorAll(".mtb-hearing-summary-scripture");
      var understand = block.querySelector('[data-hearing-field="understand"] .mtb-hearing-understand-content');
      var rows = block.querySelectorAll(".mtb-hearing-observation-row");
      if (!rows.length && !understand) throw new Error("No Hearing God's Voice content was found for this verse.");
      body.innerHTML = "";

      var contextGrid = document.createElement("div");
      contextGrid.className = "mtb-hearing-popup-context";

      function addContextCell(labelText, html, extraClass) {
        var cell = document.createElement("section");
        cell.className = "mtb-hearing-popup-context-cell" + (extraClass ? (" " + extraClass) : "");
        var label = document.createElement("span");
        label.className = "mtb-hearing-popup-context-label";
        label.textContent = labelText;
        cell.appendChild(label);
        var content = document.createElement("div");
        content.className = "mtb-hearing-popup-context-content";
        content.innerHTML = html || "";
        cell.appendChild(content);
        contextGrid.appendChild(cell);
      }

      addContextCell(
        "NKJV",
        scriptureCells.length > 0 ? scriptureCells[0].innerHTML.replace(/<span[^>]*class=["']mtb-hearing-summary-label["'][^>]*>.*?<\/span>/i,"") : "",
        ""
      );
      addContextCell(
        "NLT",
        scriptureCells.length > 1 ? scriptureCells[1].innerHTML.replace(/<span[^>]*class=["']mtb-hearing-summary-label["'][^>]*>.*?<\/span>/i,"") : "",
        ""
      );
      addContextCell(
        "Understand: What the verse says",
        understand ? understand.innerHTML : "",
        "mtb-hearing-popup-context-understand"
      );

      body.appendChild(contextGrid);

      for (var si=0;si<rows.length;si++) {
        var rowWrap=document.createElement("div");
        rowWrap.className="mtb-hearing-popup-row";

        var sourceLabel=rows[si].querySelector(".mtb-hearing-set-label");
        if(sourceLabel){
          var label=document.createElement("div");
          label.className="mtb-hearing-popup-row-label";
          label.textContent=sourceLabel.textContent;
          rowWrap.appendChild(label);
        }

        var panels = rows[si].querySelectorAll(".mtb-hearing-panel");
        for (var i=0;i<panels.length;i++) {
          var panel = document.createElement("section");
          panel.className = "mtb-hearing-popup-panel";
          var field = panels[i].getAttribute("data-hearing-field") || "";
          if (field) panel.setAttribute("data-hearing-field", field);
          var h = panels[i].querySelector("h4,h3");
          var content = panels[i].querySelector(".mtb-hearing-panel-content");
          if (h) {
            var hc=document.createElement("h3");
            hc.textContent=h.textContent;
            panel.appendChild(hc);
          }
          var cc=document.createElement("div");
          cc.className="mtb-hearing-popup-content";
          cc.innerHTML=content ? content.innerHTML : "";
          panel.appendChild(cc);
          rowWrap.appendChild(panel);
        }
        body.appendChild(rowWrap);
      }
    } catch (err) {
      body.innerHTML = '<p>' + String(err && err.message ? err.message : err) + '</p>';
    }
  }

  async function installButtons() {
    if (!document.querySelector("#doc-target .mtb-chapter-scripture, #doc-target .mtb-scripture-root")) return;
    var path = await findHearingPath();
    if (!path) return;
    var cells = document.querySelectorAll("#doc-target .mtb-scripture-verse-cell");
    for (var i=0;i<cells.length;i++) {
      var cell=cells[i];
      if (cell.querySelector(".mtb-verse-hearing-button")) continue;
      var numberEl=cell.querySelector(".mtb-scripture-verse-number");
      if (!numberEl) continue;
      var verse=parseInt((numberEl.textContent||"").trim(),10);
      if (!Number.isFinite(verse)) continue;
      var b=document.createElement("button");
      b.type="button";
      b.className="mtb-verse-info-button mtb-verse-hearing-button";
      b.textContent="h";
      b.title="Hearing God's Voice for verse " + verse;
      b.setAttribute("aria-label","Hearing God's Voice for verse " + verse);
      b.addEventListener("click",(function(v){return function(e){e.preventDefault();e.stopPropagation();openVerse(v);};})(verse));
      cell.appendChild(b);
    }
  }

  window.MTB = window.MTB || {};
  window.MTB.hasVerseHearingFile = async function(){ return !!(await findHearingPath()); };
  window.MTB.openVerseHearing = function(verse){ return openVerse(Number(verse)); };

  var hearingObserver = null;
  var hearingObserverTimer = null;
  var hearingRetryTimer = null;

  function scheduleInstall(delay) {
    window.setTimeout(function(){ installButtons(); }, delay || 0);
  }

  function armHearingObserver() {
    var target = document.getElementById("doc-target");
    if (!target || !window.MutationObserver) return;
    if (hearingObserver) return;

    hearingObserver = new MutationObserver(function(){
      if (hearingObserverTimer) window.clearTimeout(hearingObserverTimer);
      hearingObserverTimer = window.setTimeout(function(){ installButtons(); }, 60);
    });

    hearingObserver.observe(target,{childList:true,subtree:true});
  }

  function retryUntilScriptureRowsExist() {
    var attempts = 0;
    if (hearingRetryTimer) window.clearInterval(hearingRetryTimer);
    hearingRetryTimer = window.setInterval(function(){
      attempts++;
      armHearingObserver();
      installButtons();
      var hasRows = !!document.querySelector("#doc-target .mtb-scripture-verse-cell");
      var hasH = !!document.querySelector("#doc-target .mtb-verse-hearing-button");
      if ((hasRows && hasH) || attempts >= 40) {
        window.clearInterval(hearingRetryTimer);
        hearingRetryTimer = null;
      }
    },250);
  }

  document.addEventListener("DOMContentLoaded",function(){
    armHearingObserver();
    retryUntilScriptureRowsExist();
  });

  document.addEventListener("mtb:doc-injected",function(){
    armHearingObserver();
    retryUntilScriptureRowsExist();
  });

  window.addEventListener("popstate",function(){
    availabilityKey="";availabilityPath="";availabilityPromise=null;cachedDoc=null;cachedDocPath="";
    retryUntilScriptureRowsExist();
  });

  // The renderer creates the Scripture table asynchronously after the stub is
  // injected.  If this runtime executes before #doc-target exists, arm the
  // observer again after the DOM is available and keep a short bounded retry
  // loop so the h button cannot be lost to render timing.
  armHearingObserver();
  scheduleInstall(100);
})();