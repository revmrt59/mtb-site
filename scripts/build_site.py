"""
Mastering the Bible - site builder.

Reads the web files your generator already writes into mtb-site/books/
and builds the data the new site needs:

  data/library.json   every book, which chapters are ready, which layers each has

It also prints a plain-language problem report and saves it to
data/build-report.txt.

Run it with "BUILD SITE DATA.bat" (double-click), or:
  python scripts/build_site.py
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mtb_convert  # noqa: E402

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOKS_DIR = os.path.join(SITE_ROOT, "books")
OUT_DIR = os.path.join(SITE_ROOT, "data")
# The new site's own pages (in the site root). Their ui/ links get a fresh version number each build.
SITE_PAGES = ["index.html", "chapter.html", "book.html", "word.html", "doc.html", "about.html", "wisdom.html",
              "loc/life-of-jesus.html"]

# Canon in Bible order, grouped the same way as the Bible Context pages (sections/).
CANON = [
    ("old-testament", "Old Testament", [
        ("law", "Law", [
            ("genesis", "Genesis", 50), ("exodus", "Exodus", 40), ("leviticus", "Leviticus", 27),
            ("numbers", "Numbers", 36), ("deuteronomy", "Deuteronomy", 34)]),
        ("history", "History", [
            ("joshua", "Joshua", 24), ("judges", "Judges", 21), ("ruth", "Ruth", 4),
            ("1-samuel", "1 Samuel", 31), ("2-samuel", "2 Samuel", 24), ("1-kings", "1 Kings", 22),
            ("2-kings", "2 Kings", 25), ("1-chronicles", "1 Chronicles", 29), ("2-chronicles", "2 Chronicles", 36),
            ("ezra", "Ezra", 10), ("nehemiah", "Nehemiah", 13), ("esther", "Esther", 10)]),
        ("wisdom", "Wisdom", [
            ("job", "Job", 42), ("psalms", "Psalms", 150), ("proverbs", "Proverbs", 31),
            ("ecclesiastes", "Ecclesiastes", 12), ("song-of-solomon", "Song of Songs", 8)]),
        ("major-prophets", "Major Prophets", [
            ("isaiah", "Isaiah", 66), ("jeremiah", "Jeremiah", 52), ("lamentations", "Lamentations", 5),
            ("ezekiel", "Ezekiel", 48), ("daniel", "Daniel", 12)]),
        ("minor-prophets", "Minor Prophets", [
            ("hosea", "Hosea", 14), ("joel", "Joel", 3), ("amos", "Amos", 9), ("obadiah", "Obadiah", 1),
            ("jonah", "Jonah", 4), ("micah", "Micah", 7), ("nahum", "Nahum", 3), ("habakkuk", "Habakkuk", 3),
            ("zephaniah", "Zephaniah", 3), ("haggai", "Haggai", 2), ("zechariah", "Zechariah", 14),
            ("malachi", "Malachi", 4)]),
    ]),
    ("new-testament", "New Testament", [
        ("gospels", "Gospels", [
            ("matthew", "Matthew", 28), ("mark", "Mark", 16), ("luke", "Luke", 24), ("john", "John", 21)]),
        ("acts", "Acts", [("acts", "Acts", 28)]),
        ("pauline-epistles", "Paul’s Letters", [
            ("romans", "Romans", 16), ("1-corinthians", "1 Corinthians", 16), ("2-corinthians", "2 Corinthians", 13),
            ("galatians", "Galatians", 6), ("ephesians", "Ephesians", 6), ("philippians", "Philippians", 4),
            ("colossians", "Colossians", 4), ("1-thessalonians", "1 Thessalonians", 5),
            ("2-thessalonians", "2 Thessalonians", 3), ("philemon", "Philemon", 1)]),
        ("pastoral-epistles", "Pastoral Letters", [
            ("1-timothy", "1 Timothy", 6), ("2-timothy", "2 Timothy", 4), ("titus", "Titus", 3)]),
        ("general-epistles", "General Letters", [
            ("hebrews", "Hebrews", 13), ("james", "James", 5), ("1-peter", "1 Peter", 5),
            ("2-peter", "2 Peter", 3), ("jude", "Jude", 1)]),
        ("johannine-epistles", "John’s Letters", [
            ("1-john", "1 John", 5), ("2-john", "2 John", 1), ("3-john", "3 John", 1)]),
        ("revelation", "Revelation", [("revelation", "Revelation", 22)]),
    ]),
]

# Layer file names the generator writes: <slug>-<n>-chapter-<kind>.html
# Several kinds map to one layer (old and new names both work).
LAYER_KINDS = {
    "overview": "overview",
    "orientation": "overview",      # older duplicate of overview
    "explanation": "study",
    "study": "study",
    "hearing": "hearing",
    "reflections": "reflections",
    "eg-culture": "culture",
    "culture": "culture",
    "scripture": "scripture",
    "resources": "resources",
    "insights": "insights",
    "outline": "outline",          # published Chapter Outline: the authoritative section list
}
# The layers that make a chapter "complete" (Scripture comes from the Bible files).
CORE_LAYERS = ["overview", "study", "hearing", "reflections"]
LAYER_ORDER = ["scripture", "overview", "study", "hearing", "reflections", "culture"]


def chapter_layers(book_dir, slug, n):
    """Return (layers found, files that look misplaced or stray) for one chapter folder."""
    folder = os.path.join(book_dir, "%03d" % n)
    found, stray = {}, []
    if not os.path.isdir(folder):
        return found, stray
    pat = re.compile(r"^%s-%d-chapter-([a-z-]+)\.html$" % (re.escape(slug), n))
    for name in sorted(os.listdir(folder)):
        if not name.lower().endswith(".html"):
            continue
        m = pat.match(name)
        if not m:
            if "-chapter-" in name:
                stray.append(name)
            continue
        kind = m.group(1)
        layer = LAYER_KINDS.get(kind)
        if layer is None:
            stray.append(name)
            continue
        path = os.path.join(folder, name)
        # Skip empty placeholders.
        if os.path.getsize(path) < 400 and layer != "scripture":
            continue
        found.setdefault(layer, name)
    if "overview" in found and found["overview"].endswith("-orientation.html"):
        alt = "%s-%d-chapter-overview.html" % (slug, n)
        if os.path.exists(os.path.join(folder, alt)):
            found["overview"] = alt
    return found, stray


_NKJV = {}


def verse_count(testament, slug, n):
    """Number of verses in a chapter, from the NKJV file."""
    if slug not in _NKJV:
        path = os.path.join(SITE_ROOT, "assets", "js", "bibles-json", "nkjv", slug + ".json")
        try:
            with open(path, encoding="utf-8-sig") as f:
                _NKJV[slug] = json.load(f).get("chapters", {})
        except (OSError, ValueError):
            _NKJV[slug] = {}
    ch = _NKJV[slug].get(str(n)) or {}
    return max([int(k) for k in ch if str(k).isdigit()] or [0])


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def _plain(fragment):
    import html as _h
    return re.sub(r"\s+", " ", _h.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def word_summary(path):
    """English headword and the first Summary paragraph from a word-study page."""
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            t = f.read()
    except OSError:
        return "", ""
    m = re.search(r"id=['\"]ws-summary-text['\"][^>]*>(.*?)</div>", t, flags=re.S)
    if not m:
        return "", ""
    block = m.group(1)
    paras = re.findall(r"<p[^>]*>(.*?)</p>", block, flags=re.S)
    head = ""
    if paras:
        first = _plain(paras[0])
        head = first.split(" - ")[0].strip().title() if " - " in first else ""
    body = [p for p in paras[1:] if "ws-summary-label" not in p and _plain(p).lower() != "summary"]
    summary = _plain(body[0]) if body else ""
    if len(summary) > 420:
        cut = summary[:420]
        summary = cut[:cut.rfind(" ")] + "…"
    return head, summary


ABOUT_ORDER = ["about-mastering-the-bible", "how-to-use-this-resource", "core-convictions-of-mtb", "about-this-resource", "about-the-author",
               "what-is-the-bible", "is-the-bible-the-word-of-god", "how-to-read-the-bible", "the-lens-for-reading-and-understanding-scripture",
               "why-are-there-so-many-translations", "why-so-many-translations"]


def build_pages():
    """List of About pages (title from each page's first heading) for the new About page."""
    out = {}
    for key, folder in (("about", "about"), ("bible", "aboutthebible")):
        items, seen = [], set()
        d = os.path.join(SITE_ROOT, folder)
        if not os.path.isdir(d):
            continue
        for name in os.listdir(d):
            if not name.endswith(".html") or name.startswith("headers"):
                continue
            with open(os.path.join(d, name), encoding="utf-8-sig", errors="replace") as f:
                t = f.read()
            m = re.search(r"<h[12][^>]*>(.*?)</h[12]>", t, flags=re.S)
            title = _plain(m.group(1)) if m else name[:-5].replace("-", " ").title().replace("Mtb", "MTB").replace(" Of ", " of ")
            if title.lower() in seen:
                continue
            seen.add(title.lower())
            stem = name[:-5]
            order = ABOUT_ORDER.index(stem) if stem in ABOUT_ORDER else 99
            items.append((order, title, {"path": folder + "/" + name, "title": title}))
        out[key] = [x[2] for x in sorted(items, key=lambda x: (x[0], x[1]))]
    write_json(os.path.join(OUT_DIR, "pages.json"), out)


# ---------------------------------------------------------------- Proverbs Wisdom
# The Proverbs Project database stays in the Library. The site never reads it directly:
# this export copies ONLY the public fields into data/wisdom.json.
WISDOM_DB = os.path.join(os.path.dirname(os.path.dirname(SITE_ROOT)), "Library", "Proverbs Project", "Proverbs Wisdom.sqlite")
# Pilot: show the newest submission of every chapter, marking unapproved ones as drafts.
# Set to False before launch to show approved chapters only.
WISDOM_INCLUDE_DRAFTS = True
# Fields copied to the site. Anything not listed here (Source Locator, NLT, reviews, history,
# author workspaces, examples, hashes) is never exported.
WISDOM_FIELDS = {
    "Verse Notes": "notes",
    "One-Sentence Summary": "summary",
    "Key Principle": "principle",
    "Pastoral Insight": "insight",
    "Practical Application": "application",
}


def build_wisdom(problems, notes):
    import sqlite3
    if not os.path.exists(WISDOM_DB):
        notes.append("Proverbs Wisdom: database not found at %s; wisdom.json not updated" % WISDOM_DB)
        return
    from pathlib import Path
    con = sqlite3.connect(Path(WISDOM_DB).resolve().as_uri() + "?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    split = lambda v: [x.strip() for x in (v or "").split(";") if x.strip()]
    out = {"generated": datetime.now().strftime("%Y-%m-%d %H:%M"), "drafts": WISDOM_INCLUDE_DRAFTS,
           "vocab": {}, "chapters": {}, "units": []}
    for r in con.execute("SELECT kind, tag, definition FROM vocabulary WHERE kind IN ('themes','characters','keywords','teaching_forms') ORDER BY kind, tag"):
        out["vocab"].setdefault(r["kind"], {})[r["tag"]] = r["definition"]
    approved = shown = 0
    for ch in con.execute("SELECT chapter, approved_submission_id FROM chapters ORDER BY chapter").fetchall():
        sub_id, status = ch["approved_submission_id"], "APPROVED"
        if not sub_id and WISDOM_INCLUDE_DRAFTS:
            row = con.execute("SELECT id, status FROM submissions WHERE chapter=? ORDER BY revision DESC LIMIT 1", (ch["chapter"],)).fetchone()
            if row:
                sub_id, status = row["id"], row["status"]
        if not sub_id:
            continue
        out["chapters"][str(ch["chapter"])] = "approved" if status == "APPROVED" else "draft"
        approved += status == "APPROVED"
        rels = {}
        for r in con.execute("SELECT unit_id, reference, type, explanation FROM submission_relationships WHERE submission_id=?", (sub_id,)):
            rels.setdefault(r["unit_id"], []).append({"ref": r["reference"], "type": r["type"], "note": r["explanation"]})
        for u in con.execute("SELECT unit_id, chapter, start_verse, end_verse, data_json FROM submission_units WHERE submission_id=? ORDER BY start_verse", (sub_id,)):
            d = json.loads(u["data_json"])
            unit = {"id": u["unit_id"], "ref": d.get("Wisdom Unit") or "", "c": u["chapter"], "s": u["start_verse"], "e": u["end_verse"],
                    "theme": (d.get("Primary Theme") or "").strip(), "themes2": split(d.get("Secondary Themes")),
                    "chars": split(d.get("Character Types")), "kw": split(d.get("Keywords")), "forms": split(d.get("Teaching Forms")),
                    "rel": rels.get(u["unit_id"], [])}
            for src, key in WISDOM_FIELDS.items():
                if (d.get(src) or "").strip():
                    unit[key] = d[src].strip()
            if status != "APPROVED":
                unit["draft"] = 1
            out["units"].append(unit)
            shown += 1
    con.close()
    write_json(os.path.join(OUT_DIR, "wisdom.json"), out)
    notes.append("Proverbs Wisdom: %d units from %d chapters (%d approved chapters%s)"
                 % (shown, len(out["chapters"]), approved, ", drafts included for the pilot" if WISDOM_INCLUDE_DRAFTS else ""))


OLD_PAGE_SCRIPTS = ["mtb-word-studies-nav", "mtb-master-word-links"]


def stamp_versions():
    """Give the site's CSS/JS links a fresh ?v= so browsers load the newest copy after each build."""
    stamp = datetime.now().strftime("%Y%m%d%H%M%S")
    for name in SITE_PAGES:
        path = os.path.join(SITE_ROOT, name)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            t = f.read()
        t2 = re.sub(r'(ui/[a-z]+\.(?:css|js))(\?v=[\w-]+)?"', r'\1?v=' + stamp + '"', t)
        # Old-site helper scripts that other tools sometimes add to pages; the new site has its own versions.
        t2 = re.sub(r'[ \t]*<script[^>]+src="[^"]*assets/js/(?:%s)\.js[^"]*"[^>]*>\s*</script>[ \t]*\r?\n?' % "|".join(OLD_PAGE_SCRIPTS), "", t2)
        if t2 != t:
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(t2)


def build_word_index(notes):
    """Small lookup of every word study (Strong's -> word, meaning) for the tap pop-ups."""
    src = os.path.join(SITE_ROOT, "assets", "data", "word-studies.json")
    out = {}
    try:
        with open(src, encoding="utf-8-sig") as f:
            rows = json.load(f)
    except (OSError, ValueError) as e:
        notes.append("word studies list could not be read (%s)" % e)
        return
    scope_path = Path(OUT_DIR) / "word-study-scopes.json"
    scopes = json.loads(scope_path.read_bytes()) if scope_path.is_file() else {}
    for r in rows:
        s = str(r.get("strong") or "").lower()
        if not s:
            continue
        page = os.path.join(SITE_ROOT, "word-studies", s + ".html")
        entry = {"t": r.get("transliteration") or "", "g": r.get("gloss") or "",
                 "l": r.get("language") or "", "p": os.path.exists(page)}
        if entry["p"]:
            head, summary = word_summary(page)
            if head:
                entry["w"] = head
            if summary:
                entry["sum"] = summary
        if s in scopes:
            entry["study_spans"] = scopes[s]
        out[s] = entry
    write_json(os.path.join(OUT_DIR, "words.json"), out)


def book_supplements(folder, slug, files):
    """Extra book tabs, in this order: book-supplement-<book>-<name>.html, then
    book-supplement1-<book>-<name>.html, book-supplement2-..., and so on.
    The tab name comes from <name> (the-journey -> The Journey)."""
    labels = {}
    meta = os.path.join(folder, "book-supplement.json")
    if os.path.exists(meta):
        try:
            with open(meta, encoding="utf-8-sig") as f:
                m = json.load(f)
            for item in (m if isinstance(m, list) else [m]):
                if isinstance(item, dict) and item.get("file"):
                    labels[item["file"]] = item.get("title") or ""
        except (OSError, ValueError):
            pass
    small = {"of", "the", "and", "a", "an", "in", "on", "to", "for"}
    found = []
    for f in files:
        m = re.match(r"^book-(?:supplement|special)(\d*)-%s-([a-z0-9-]+)\.html$" % re.escape(slug), f)
        if m:
            words = m.group(2).split("-")
            label = " ".join(w if (i and w in small) else w.capitalize() for i, w in enumerate(words)) or labels.get(f, "")
            num = int(m.group(1)) if m.group(1) else 0
            found.append((num, f, {"id": (m.group(1) or "") + "-" + m.group(2) if m.group(1) else m.group(2), "label": label, "file": f}))
    # An old unnumbered copy is left over when the same supplement is now numbered; skip it.
    numbered = {x[2]["label"] for x in found if x[0]}
    found = [x for x in found if x[0] or x[2]["label"] not in numbered]
    return [x[2] for x in sorted(found)]


def ranges(nums):
    """[1,2,3,5,7,8] -> '1–3, 5, 7–8'"""
    out, start, prev = [], None, None
    for n in sorted(nums) + [None]:
        if start is None:
            start = prev = n
        elif n is not None and n == prev + 1:
            prev = n
        else:
            out.append(str(start) if start == prev else "%d–%d" % (start, prev))
            start = prev = n
    return ", ".join(out)


PLACEHOLDERS = ("coming soon", "lorem ipsum", "[insert", "[tbd")


def placeholder_check(data):
    """Readers should never see placeholder text. Count verses that show it, by field."""
    hits = {}
    verses = data.get("verses") or {}
    for v, x in verses.items():
        for k, val in x.items():
            if isinstance(val, str) and any(ph in val.lower() for ph in PLACEHOLDERS):
                hits[k] = hits.get(k, 0) + 1
    names = {"brief": "Meaning", "explain": "Verse Explanation", "notes": "Study Notes"}
    if not hits:
        return []
    where = "; ".join("%s %d of %d verses" % (names.get(k, k), c, len(verses)) for k, c in sorted(hits.items()))
    return ["placeholder text (\"Coming soon\") shows to readers: %s. Finish it or remove the chapter from the Library" % where]


def build_word_popups():
    site = Path(SITE_ROOT)
    bridge = site.parents[1] / 'Scripts' / 'STEP_WordData' / 'site_bridge.py'
    subprocess.run([sys.executable, str(bridge), 'site-popups', str(site)], check=True)


def main():
    build_word_popups()
    gaps = {}
    problems = []
    notes = []
    lib = {"generated": datetime.now().strftime("%Y-%m-%d %H:%M"), "testaments": []}
    totals = {"chapters": 0, "complete": 0, "books": 0}

    for t_key, t_name, groups in CANON:
        t_out = {"key": t_key, "name": t_name, "groups": []}
        for g_key, g_name, books in groups:
            g_out = {"key": g_key, "name": g_name, "context": "sections/%s/%s/" % (t_key, g_key), "books": []}
            for slug, name, nchap in books:
                book_dir = os.path.join(BOOKS_DIR, t_key, slug)
                b = {"slug": slug, "name": name, "chapters": nchap, "ready": [], "overview": False,
                     "resources": False, "special": []}
                if os.path.isdir(book_dir):
                    bk = os.path.join(book_dir, "000-book")
                    if os.path.isdir(bk):
                        files = os.listdir(bk)
                        b["overview"] = ("book-overview-%s.html" % slug) in files
                        res = "%s-0-book-resources.html" % slug
                        if res in files:
                            # Only count it when the resources list actually links to something.
                            with open(os.path.join(bk, res), encoding="utf-8", errors="replace") as rf:
                                b["resources"] = "<a " in rf.read()
                        b["outline"] = ("book-outline-%s.html" % slug) in files
                        b["special"] = book_supplements(bk, slug, files)
                    for n in range(1, nchap + 1):
                        layers, stray = chapter_layers(book_dir, slug, n)
                        for s in stray:
                            notes.append("%s %d: extra file ignored: %s" % (name, n, s))
                        # An old "orientation" file on its own is a leftover, not a chapter study.
                        if set(layers) - {"scripture", "outline"} == {"overview"} and layers["overview"].endswith("-orientation.html"):
                            notes.append("%s %d: only an old orientation file is here, so the chapter is not listed: %s" % (name, n, layers["overview"]))
                            continue
                        if "study" not in layers and "overview" not in layers:
                            continue
                        have = [l for l in LAYER_ORDER if l in layers]
                        missing = [l for l in CORE_LAYERS if l not in layers]
                        complete = not missing
                        b["ready"].append({"n": n, "layers": have, "complete": complete})
                        nv = verse_count(t_key, slug, n)
                        if not nv:
                            problems.append("%s %d: no NKJV text found, chapter page skipped" % (name, n))
                        else:
                            try:
                                data, warn = mtb_convert.build_chapter(SITE_ROOT, t_key, slug, name, n, layers, nv)
                                write_json(os.path.join(OUT_DIR, "chapters", "%s-%d.json" % (slug, n)), data)
                                for w in warn:
                                    problems.append("%s %d: %s" % (name, n, w))
                                for w in placeholder_check(data):
                                    problems.append("%s %d: %s" % (name, n, w))
                            except Exception as e:  # keep going; report it
                                problems.append("%s %d: could not convert (%s)" % (name, n, e))
                        totals["chapters"] += 1
                        if complete:
                            totals["complete"] += 1
                        else:
                            gaps.setdefault((name, ", ".join(missing)), []).append(n)
                    # Folders for chapters that don't exist in this book.
                    for d in os.listdir(book_dir):
                        if re.match(r"^\d{3}$", d) and int(d) > nchap:
                            notes.append("%s: folder %s is beyond the book's %d chapters" % (name, d, nchap))
                    gen = os.path.join(book_dir, "generated")
                    if os.path.isdir(gen):
                        for f in os.listdir(gen):
                            if os.path.isfile(os.path.join(gen, f)) and not f.startswith(slug):
                                notes.append("%s: 'generated' folder holds a file for another book: %s" % (name, f))
                for (bname, miss), nums in gaps.items():
                    problems.append("%s %s: missing %s" % (bname, ranges(nums), miss))
                gaps.clear()
                if b["ready"]:
                    totals["books"] += 1
                    if not b["overview"]:
                        problems.append("%s: has ready chapters but no Book Overview" % name)
                g_out["books"].append(b)
            t_out["groups"].append(g_out)
        lib["testaments"].append(t_out)

    os.makedirs(OUT_DIR, exist_ok=True)
    write_json(os.path.join(OUT_DIR, "library.json"), lib)
    stamp_versions()
    build_pages()
    build_word_index(notes)
    try:
        build_wisdom(problems, notes)
    except Exception as e:  # never stop the whole build for this
        problems.append("Proverbs Wisdom export failed (%s)" % e)
    try:
        import build_loc  # The Life of Jesus: loc/data from mtb-source/source/loc-head
        build_loc.build(SITE_ROOT, problems, notes)
    except Exception as e:  # never stop the whole build for this
        problems.append("Life of Jesus export failed (%s)" % e)

    lines = []
    lines.append("MTB site build - %s" % lib["generated"])
    lines.append("")
    lines.append("Ready: %d chapters in %d books (%d complete with all core layers)."
                 % (totals["chapters"], totals["books"], totals["complete"]))
    lines.append("")
    lines.append("NEEDS ATTENTION (%d)" % len(problems))
    lines += ["  - " + p for p in problems] or ["  none"]
    lines.append("")
    lines.append("FYI, NOT SHOWN ON THE SITE (%d)" % len(notes))
    lines += ["  - " + n for n in notes] or ["  none"]
    report = "\n".join(lines)
    with open(os.path.join(OUT_DIR, "build-report.txt"), "w", encoding="utf-8") as f:
        f.write(report + "\n")
    print(report)


if __name__ == "__main__":
    sys.exit(build_word_popups() if sys.argv[1:] == ['--word-popups-only'] else main())
