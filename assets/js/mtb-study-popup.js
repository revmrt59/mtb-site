(function () {
  "use strict";

  var cacheKey = "";
  var cachePath = "";
  var cacheDoc = null;

  function context() {
    var p = new URLSearchParams(window.location.search);
    var book = String(p.get("book") || document.body.dataset.book || "").toLowerCase().trim().replace(/\\s+/g,"-");
    if (book === "psalm") book = "psalms";
    var chapter = parseInt(p.get("chapter") || document.body.dataset.chapter || "0",10);
    if (!book || !Number.isFinite(chapter) || chapter < 1) return null;
    var nt={"matthew":1,"mark":1,"luke":1,"john":1,"acts":1,"romans":1,"1-corinthians":1,"2-corinthians":1,"galatians":1,"ephesians":1,"philippians":1,"colossians":1,"1-thessalonians":1,"2-thessalonians":1,"1-timothy":1,"2-timothy":1,"titus":1,"philemon":1,"hebrews":1,"james":1,"1-peter":1,"2-peter":1,"1-john":1,"2-john":1,"3-john":1,"jude":1,"revelation":1};
    return {book:book,chapter:chapter,folder:String(chapter).padStart(3,"0"),testament:nt[book]?"new-testament":"old-testament"};
  }

  async function findStudyPath() {
    var c=context(); if(!c)return "";
    var key=c.book+":"+c.chapter;
    if(cacheKey===key && cachePath)return cachePath;
    var base="/books/"+c.testament+"/"+c.book+"/"+c.folder+"/"+c.book+"-"+c.chapter+"-chapter-explanation";
    var candidates=[base+".html",base+"-draft.html"];
    for(var i=0;i<candidates.length;i++){
      try{var r=await fetch(candidates[i],{method:"GET",cache:"no-store"});if(!r.ok)continue;var html=await r.text();if(/data-mtb-status=["']placeholder["']/i.test(html))continue;if(!/data-doc-type=["']chapter-explanation["']/i.test(html)&&!/mtb-chapter-study/i.test(html))continue;cacheKey=key;cachePath=candidates[i];return cachePath;}catch(_){}
    }
    return "";
  }

  async function studyDoc(){var path=await findStudyPath();if(!path)throw new Error("Chapter Study is not available for this chapter.");if(cacheDoc&&cachePath===path)return cacheDoc;var r=await fetch(path,{cache:"no-store"});if(!r.ok)throw new Error("Could not load Chapter Study.");cacheDoc=new DOMParser().parseFromString(await r.text(),"text/html");return cacheDoc;}

  function cleanLegacyStudy(root){
    if(!root)return;
    root.querySelectorAll(".mtb-study-verse-panel").forEach(function(panel){var h=panel.querySelector("h4");var label=(h&&h.textContent||"").trim().toLowerCase();if(label==="spirit & life"||label==="spirit and life")panel.remove();});
  }

  function modal(){
    var overlay=document.getElementById("mtb-study-popup-overlay");if(overlay)return overlay;
    var st=document.createElement("style");st.id="mtb-study-popup-style";st.textContent=".mtb-study-popup-overlay{position:fixed;inset:0;z-index:10040;background:rgba(17,31,43,.58);display:none;align-items:center;justify-content:center;padding:24px}.mtb-study-popup-overlay.is-open{display:flex}.mtb-study-popup{width:min(1100px,97vw);max-height:90vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 22px 70px rgba(0,0,0,.28);position:relative}.mtb-study-popup-close{position:absolute;right:14px;top:12px;border:0;background:transparent;font-size:1.6rem;cursor:pointer;color:#173a5e}.mtb-study-popup-head{padding:20px 54px 16px 22px;background:#eaf2f8;border-bottom:1px solid #cbd8e3}.mtb-study-popup-ref{font-size:1.15rem;font-weight:800;color:#173a5e}.mtb-study-popup-scripture{margin-top:8px;color:#1f4f87;line-height:1.45}.mtb-study-popup-body{padding:16px}.mtb-study-popup-panel{margin:0 0 14px;border:1px solid #d8e1e8;border-radius:9px;overflow:hidden;background:#fff}.mtb-study-popup-panel h3{margin:0;padding:10px 13px;background:#f4f7f9;color:#173a5e;font-size:.9rem}.mtb-study-popup-content{padding:14px 16px;line-height:1.55}.mtb-study-popup-content p{margin:0 0 .85em}.mtb-study-popup-content p:last-child{margin-bottom:0}";document.head.appendChild(st);
    overlay=document.createElement("div");overlay.id="mtb-study-popup-overlay";overlay.className="mtb-study-popup-overlay";overlay.setAttribute("aria-hidden","true");overlay.innerHTML='<div class="mtb-study-popup" role="dialog" aria-modal="true"><button type="button" class="mtb-study-popup-close" aria-label="Close">×</button><div class="mtb-study-popup-head"><div class="mtb-study-popup-ref"></div><div class="mtb-study-popup-scripture"></div></div><div class="mtb-study-popup-body"></div></div>';document.body.appendChild(overlay);
    function close(){overlay.classList.remove("is-open");overlay.setAttribute("aria-hidden","true");}overlay.querySelector(".mtb-study-popup-close").addEventListener("click",close);overlay.addEventListener("click",function(e){if(e.target===overlay)close();});document.addEventListener("keydown",function(e){if(e.key==="Escape"&&overlay.classList.contains("is-open"))close();});return overlay;
  }

  async function openVerse(verse){
    var overlay=modal(),body=overlay.querySelector(".mtb-study-popup-body"),ref=overlay.querySelector(".mtb-study-popup-ref"),scripture=overlay.querySelector(".mtb-study-popup-scripture");
    body.innerHTML="<p>Loading…</p>";scripture.innerHTML="";overlay.classList.add("is-open");overlay.setAttribute("aria-hidden","false");
    try{
      var doc=await studyDoc();var block=doc.querySelector('details.mtb-study-verse[data-verse="'+Number(verse)+'"]');if(!block)throw new Error("Verse explanation could not be loaded.");
      var r=block.querySelector(".mtb-study-summary-reference,.mtb-study-modal-reference");ref.textContent=r?r.textContent.trim():"Verse "+verse;
      var nkjv=block.querySelector(".mtb-study-summary-scripture .mtb-study-scripture-nkjv");scripture.innerHTML=nkjv?nkjv.innerHTML:"";
      body.innerHTML="";
      var compat=block.querySelector(".mtb-study-modal-compat .mtb-study-verse-panel-content");
      var exp=Array.from(block.querySelectorAll(".mtb-study-verse-panel")).find(function(p){var h=p.querySelector("h4");return h&&h.textContent.trim().toLowerCase()==="verse explanation";});
      var notes=Array.from(block.querySelectorAll(".mtb-study-verse-panel")).find(function(p){var h=p.querySelector("h4");return h&&h.textContent.trim().toLowerCase()==="study notes";});
      function add(title,html){if(!html||!String(html).replace(/<[^>]+>/g,"").trim())return;var sec=document.createElement("section");sec.className="mtb-study-popup-panel";sec.innerHTML='<h3>'+title+'</h3><div class="mtb-study-popup-content">'+html+'</div>';body.appendChild(sec);}
      add("Brief Explanation",compat?compat.innerHTML:"");
      if(exp){var c=exp.querySelector(".mtb-study-verse-panel-content");var clone=c?c.cloneNode(true):null;if(clone){var inline=clone.querySelector(".mtb-study-brief-inline");if(inline)inline.remove();add("Verse Explanation",clone.innerHTML);}}
      if(notes){var nc=notes.querySelector(".mtb-study-verse-panel-content");add("Study Notes",nc?nc.innerHTML:"");}
      if(!body.children.length)throw new Error("Verse explanation could not be loaded.");
    }catch(err){body.innerHTML='<p style="color:#66727d;font-style:italic">'+String(err&&err.message?err.message:err)+'</p>';}
  }

  window.MTB=window.MTB||{};
  window.MTB.openVerseExplanation=function(verse){return openVerse(Number(verse));};
  window.MTB.hasVerseExplanationFile=async function(){return !!(await findStudyPath());};

  function cleanup(){cleanLegacyStudy(document.querySelector("#doc-target"));}

  // Own the Chapter Scripture "i" button at capture phase.  Older load-doc.js
  // versions also attach an explanation handler; stopping propagation here
  // prevents that retired MAIN IDEA / SPIRIT & LIFE modal from ever opening.
  document.addEventListener("click",function(e){
    var button=e.target&&e.target.closest?e.target.closest(".mtb-verse-info-button"):null;
    if(!button)return;
    var cell=button.closest(".mtb-scripture-verse-cell");
    var numberEl=cell?cell.querySelector(".mtb-scripture-verse-number"):null;
    var verse=parseInt(numberEl?numberEl.textContent:"",10);
    if(!Number.isFinite(verse)||verse<1)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openVerse(verse);
  },true);

  document.addEventListener("DOMContentLoaded",cleanup);document.addEventListener("mtb:doc-injected",cleanup);window.addEventListener("popstate",function(){cacheKey="";cachePath="";cacheDoc=null;setTimeout(cleanup,50);});
})();