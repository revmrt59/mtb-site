// Mastering the Bible - Scripture from API.Bible (licensed translations).
// The API key stays on the server: set API_BIBLE_KEY in Netlify > Site configuration > Environment variables.
// Optional: API_BIBLE_IDS = {"niv":"<bibleId>","kjv":"<bibleId>"} to pin exact Bibles.
//
//   /.netlify/functions/bible?tr=niv&book=psalms&c=23   -> { verses:{"1":"..."}, copyright, fumsToken, reference }
//   /.netlify/functions/bible?list=1                    -> the Bibles this key can use (id, abbreviation, name)

// API.Bible has a newer and an older address; keys from either era work on one of them.
const BASES = ["https://rest.api.bible/v1", "https://api.scripture.api.bible/v1"];
let goodBase = null;
const BOOKS = {
  "genesis": "GEN", "exodus": "EXO", "leviticus": "LEV", "numbers": "NUM", "deuteronomy": "DEU",
  "joshua": "JOS", "judges": "JDG", "ruth": "RUT", "1-samuel": "1SA", "2-samuel": "2SA",
  "1-kings": "1KI", "2-kings": "2KI", "1-chronicles": "1CH", "2-chronicles": "2CH", "ezra": "EZR",
  "nehemiah": "NEH", "esther": "EST", "job": "JOB", "psalms": "PSA", "proverbs": "PRO",
  "ecclesiastes": "ECC", "song-of-solomon": "SNG", "isaiah": "ISA", "jeremiah": "JER",
  "lamentations": "LAM", "ezekiel": "EZK", "daniel": "DAN", "hosea": "HOS", "joel": "JOL",
  "amos": "AMO", "obadiah": "OBA", "jonah": "JON", "micah": "MIC", "nahum": "NAM",
  "habakkuk": "HAB", "zephaniah": "ZEP", "haggai": "HAG", "zechariah": "ZEC", "malachi": "MAL",
  "matthew": "MAT", "mark": "MRK", "luke": "LUK", "john": "JHN", "acts": "ACT", "romans": "ROM",
  "1-corinthians": "1CO", "2-corinthians": "2CO", "galatians": "GAL", "ephesians": "EPH",
  "philippians": "PHP", "colossians": "COL", "1-thessalonians": "1TH", "2-thessalonians": "2TH",
  "1-timothy": "1TI", "2-timothy": "2TI", "titus": "TIT", "philemon": "PHM", "hebrews": "HEB",
  "james": "JAS", "1-peter": "1PE", "2-peter": "2PE", "1-john": "1JN", "2-john": "2JN",
  "3-john": "3JN", "jude": "JUD", "revelation": "REV"
};

// Licensed Bibles on this key (from ?list=1, Nov 5 2026). API_BIBLE_IDS in Netlify can override these.
const PINNED = {
  niv: "78a9f6124f344018-01",  // New International Version 2011
  nlt: "d6e14a625393b4da-01",  // New Living Translation
  amp: "a81b73293d3080c9-01",  // Amplified Bible
  kjv: "de4e12af7f28f599-01"   // King James (Authorised) Version
};

let bibleList = null; // cached while the function stays warm

function reply(status, body, cache) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cache || "no-store"
    },
    body: JSON.stringify(body)
  };
}

async function api(path, key) {
  const tries = goodBase ? [goodBase] : BASES;
  let last = "";
  for (const base of tries) {
    const r = await fetch(base + path, { headers: { "api-key": key, "accept": "application/json" } });
    if (r.ok) { goodBase = base; return r.json(); }
    let msg = "";
    try { msg = (await r.text()).slice(0, 300); } catch (e) { /* ignore */ }
    last = "API.Bible " + r.status + " at " + base.replace("https://", "") + path.split("?")[0] + (msg ? " - " + msg : "");
    if (r.status !== 401 && r.status !== 403 && r.status !== 404) break;
  }
  throw new Error(last);
}

async function bibles(key) {
  if (!bibleList) bibleList = (await api("/bibles", key)).data || [];
  return bibleList;
}

async function bibleId(tr, key) {
  try {
    const pinned = JSON.parse(process.env.API_BIBLE_IDS || "{}");
    if (pinned[tr]) return pinned[tr];
  } catch (e) { /* ignore bad JSON */ }
  if (PINNED[tr]) return PINNED[tr];
  const want = tr.toUpperCase();
  const list = await bibles(key);
  const hit = list.find(b => (b.abbreviation || "").toUpperCase() === want)
    || list.find(b => (b.abbreviationLocal || "").toUpperCase() === want)
    || list.find(b => (b.abbreviation || "").toUpperCase().startsWith(want));
  return hit ? hit.id : null;
}

// Turn API.Bible "json" content into { "1": "line one  line two", ... }.
// Poetry lines (each q-paragraph) are joined with two spaces, which the chapter page splits into lines.
function versesFromJson(content) {
  const verses = {};
  function add(v, text, newLine) {
    if (!v) return;
    const m = String(v).match(/(\d+)(?:-\d+)?\s*$/);
    if (!m) return;
    const n = m[1];
    const cur = verses[n] || "";
    const sep = cur && newLine ? "  " : "";
    verses[n] = cur + sep + text;
  }
  function walk(nodes, style, state) {
    (nodes || []).forEach(node => {
      if (node.type === "text") {
        const v = node.attrs && node.attrs.verseId;
        if (v && node.text) { add(v, node.text, state.newPara); state.newPara = false; }
        return;
      }
      if (node.name === "note") return;
      const st = node.attrs && node.attrs.style;
      if (node.name === "para") {
        // headings, Psalm titles and similar are not verse text
        if (/^(s\d?|ms\d?|mr|r|d|sp|cl|qa|iex)$/.test(st || "")) return;
        state.newPara = true;
        walk(node.items, st, state);
        return;
      }
      walk(node.items, style, state);
    });
  }
  walk(content, "", { newPara: false });
  Object.keys(verses).forEach(k => { verses[k] = verses[k].replace(/[ \t]{3,}/g, "  ").replace(/^\s+|\s+$/g, ""); });
  return verses;
}

exports.handler = async function (event) {
  const key = (process.env.API_BIBLE_KEY || "").trim() || null;
  const rawKey = process.env.API_BIBLE_KEY || "";
  if (!key) return reply(500, { error: "API_BIBLE_KEY is not set in Netlify." });
  if (event.queryStringParameters && event.queryStringParameters.check) {
    return reply(200, { keyLength: key.length, hadExtraSpaces: rawKey !== rawKey.trim() });
  }
  const q = event.queryStringParameters || {};
  try {
    if (q.list) {
      const list = (await bibles(key)).map(b => ({ id: b.id, abbreviation: b.abbreviation, name: b.name, language: b.language && b.language.name }));
      return reply(200, { bibles: list });
    }
    const tr = String(q.tr || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const book = BOOKS[String(q.book || "").toLowerCase()];
    const c = parseInt(q.c, 10);
    if (!tr || !book || !(c > 0)) return reply(400, { error: "Use ?tr=niv&book=psalms&c=23" });
    const id = await bibleId(tr, key);
    if (!id) return reply(404, { error: "No Bible with abbreviation " + tr.toUpperCase() + " on this API key. Try ?list=1." });
    const j = await api("/bibles/" + id + "/chapters/" + book + "." + c +
      "?content-type=json&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=false&include-verse-spans=false", key);
    const d = j.data || {}, meta = j.meta || {};
    return reply(200, {
      tr: tr, bibleId: id, reference: d.reference,
      verses: versesFromJson(d.content),
      copyright: d.copyright || "",
      fumsToken: meta.fumsToken || meta.fumsId || null
    }, "private, max-age=300");
  } catch (e) {
    return reply(502, { error: String(e.message || e) });
  }
};
