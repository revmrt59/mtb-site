"""
Mastering the Bible - turns one chapter's layer files (the web files your generator
writes) into a single clean data file for the new chapter page.

Uses only Python's built-in library, so nothing extra needs installing.
Called by build_site.py; not meant to be run on its own.
"""

import html
import json
import os
import re
from html.parser import HTMLParser

VOID = {"br", "img", "hr", "meta", "link", "input", "col", "area", "base", "wbr", "source"}


# ---------------------------------------------------------------- tiny DOM
class Node:
    __slots__ = ("tag", "attrs", "children", "parent", "text")

    def __init__(self, tag=None, attrs=None, text=None):
        self.tag, self.attrs, self.children, self.parent, self.text = tag, dict(attrs or {}), [], None, text

    def classes(self):
        return (self.attrs.get("class") or "").split()

    def has(self, cls):
        return cls in self.classes()

    def walk(self):
        for c in self.children:
            if c.tag:
                yield c
                yield from c.walk()

    def all(self, cls=None, tag=None):
        return [n for n in self.walk() if (cls is None or n.has(cls)) and (tag is None or n.tag == tag)]

    def first(self, cls=None, tag=None):
        for n in self.walk():
            if (cls is None or n.has(cls)) and (tag is None or n.tag == tag):
                return n
        return None

    def kids(self, tag=None):
        return [c for c in self.children if c.tag and (tag is None or c.tag == tag)]

    def get_text(self):
        out = []
        def rec(n):
            for c in n.children:
                if c.tag is None:
                    out.append(c.text)
                elif c.tag == "br":
                    out.append(" ")
                else:
                    rec(c)
        rec(self)
        return re.sub(r"\s+", " ", "".join(out)).strip()

    def remove(self):
        if self.parent:
            self.parent.children = [c for c in self.parent.children if c is not self]


class _Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root")
        self.cur = self.root
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("style", "script"):
            self.skip += 1
            return
        if self.skip:
            return
        n = Node(tag, attrs)
        n.parent = self.cur
        self.cur.children.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        if self.skip or tag in ("style", "script"):
            return
        n = Node(tag, attrs)
        n.parent = self.cur
        self.cur.children.append(n)

    def handle_endtag(self, tag):
        if tag in ("style", "script"):
            self.skip = max(0, self.skip - 1)
            return
        if self.skip or tag in VOID:
            return
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None and n.parent is not None:
            self.cur = n.parent

    def handle_data(self, data):
        if self.skip:
            return
        t = Node(text=data)
        t.parent = self.cur
        self.cur.children.append(t)


def parse(path):
    b = _Builder()
    with open(path, encoding="utf-8", errors="replace") as f:
        b.feed(f.read())
    b.close()
    return b.root


# ---------------------------------------------------------------- clean HTML out
KEEP = {"p", "strong", "b", "em", "i", "ul", "ol", "li", "blockquote", "br", "sup", "sub", "a", "span", "h3", "h4", "h5", "table", "thead", "tbody", "tr", "th", "td"}


def clean_html(node, drop_first_heading=False):
    """Inner HTML of node with only simple formatting kept (paragraphs, bold, italics, lists, word-study links)."""
    parts = []

    def rec(n):
        for c in n.children:
            if c.tag is None:
                parts.append(html.escape(c.text, quote=False))
                continue
            t = c.tag
            if t not in KEEP:
                rec(c)            # unwrap divs, sections, etc.
                continue
            if t == "span":
                if c.has("ws") and c.attrs.get("data-strong"):
                    parts.append('<span class="ws" data-s="%s">' % html.escape(c.attrs["data-strong"].lower()))
                    rec(c)
                    parts.append("</span>")
                else:
                    rec(c)
                continue
            if t == "a":
                href = c.attrs.get("href") or ""
                if href.startswith("http"):
                    parts.append('<a href="%s" target="_blank" rel="noopener">' % html.escape(href))
                    rec(c)
                    parts.append("</a>")
                else:
                    rec(c)
                continue
            if t in ("h3", "h4", "h5"):
                t = "h4"
            if t == "b":
                t = "strong"
            if t == "i":
                t = "em"
            if t == "br":
                parts.append("<br>")
                continue
            parts.append("<%s>" % t)
            rec(c)
            parts.append("</%s>" % t)

    if drop_first_heading:
        for c in node.kids():
            if c.tag in ("h1", "h2", "h3", "h4"):
                c.remove()
                break
    rec(node)
    s = "".join(parts)
    s = re.sub(r"<p>\s*(<br>\s*)+", "<p>", s)
    s = re.sub(r"(<br>\s*)+</p>", "</p>", s)
    s = re.sub(r"<p>\s*</p>", "", s)
    s = re.sub(r"[ \t]*\n[ \t]*", " ", s)
    s = re.sub(r" {2,}", " ", s)
    return s.strip()


def text_of_html(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


# ---------------------------------------------------------------- references
RANGE_RE = re.compile(r"(\d+):(\d+)(?:\s*[–-]\s*(?:(\d+):)?(\d+))?")


def parse_range(label, chapter):
    """'Psalm 23:1–3 — The LORD Is My Shepherd' -> (1, 3, 'The LORD Is My Shepherd')"""
    m = RANGE_RE.search(label)
    if not m:
        return None
    c1, v1, c2, v2 = int(m.group(1)), int(m.group(2)), m.group(3), m.group(4)
    if c1 != chapter:
        return None
    a = v1
    b = int(v2) if v2 and (c2 is None or int(c2) == chapter) else (v1 if not v2 else 999)
    title = re.split(r"\s+[—–-]+\s+", label, maxsplit=1)
    title = title[1].strip() if len(title) > 1 else ""
    return a, b, title


# ---------------------------------------------------------------- layers
def read_overview(path):
    root = parse(path)
    out = {"glance": [], "cards": []}
    for it in root.all("mtb-overview-glance-item"):
        lab = it.first("mtb-overview-glance-label")
        con = it.first("mtb-overview-glance-content")
        if lab and con:
            out["glance"].append({"label": lab.get_text().rstrip(":"), "html": clean_html(con)})
    deeper = root.first("mtb-overview-deeper") or root
    seen = set()
    for card in deeper.all("mtb-overview-card"):
        h = card.first("mtb-overview-card-header")
        b = card.first("mtb-overview-card-body")
        if not (h and b):
            continue
        title = h.get_text()
        if title in seen:
            continue
        seen.add(title)
        out["cards"].append({"title": title, "html": clean_html(b)})
    outline = []
    for g in out["glance"]:
        if "outline" in g["label"].lower():
            for li in re.findall(r"<li>(.*?)</li>", g["html"], flags=re.S):
                outline.append(text_of_html(li))
    out["outline"] = outline
    return out


def verse_num(node):
    v = node.attrs.get("data-verse")
    if v and v.isdigit():
        return int(v)
    ref = node.first("mtb-study-summary-reference") or node.first("mtb-hearing-summary-reference")
    if ref:
        m = re.search(r":(\d+)", ref.get_text())
        if m:
            return int(m.group(1))
    return None


def read_study(path, chapter=None):
    root = parse(path)
    verses = {}
    # Some study files carry section headings ("Ruth 1:8–14 — Naomi Releases…") inside the verse panels.
    # Pull them out so they don't show inside Study Notes, and keep them as the chapter's sections.
    headings = []
    if chapter:
        for h in [n for n in root.walk() if n.tag in ("h1", "h2", "h3")]:
            r = parse_range(h.get_text(), chapter)
            if r and r[2]:
                headings.append({"start": r[0], "end": r[1], "title": r[2]})
                h.remove()
    for v in root.all("mtb-study-verse"):
        n = verse_num(v)
        if n is None:
            continue
        d = {"words": []}
        nk = v.first("mtb-study-scripture-nkjv")
        if nk:
            for ws in nk.all("ws"):
                s = (ws.attrs.get("data-strong") or "").lower()
                if s:
                    d["words"].append([ws.get_text(), s])
        for panel in v.all("mtb-study-verse-panel"):
            h = panel.first(tag="h4")
            label = h.get_text().lower() if h else ""
            content = panel.first("mtb-study-verse-panel-content") or panel
            for inline in content.all("mtb-study-brief-inline"):
                inline.remove()
            body = clean_html(content)
            if "main idea" in label or "brief" in label:
                d["brief"] = text_of_html(body)
            elif "explanation" in label:
                d["explain"] = body
            elif "note" in label:
                d["notes"] = body
        verses[n] = d
    if chapter is None:
        return verses
    seen, out = set(), []
    for h in sorted(headings, key=lambda x: x["start"]):
        if h["start"] not in seen:
            seen.add(h["start"])
            out.append(h)
    return verses, out


def read_hearing(path):
    root = parse(path)
    verses = {}
    for v in root.all("mtb-hearing-verse"):
        n = verse_num(v)
        if n is None:
            continue
        pairs, cur = [], None
        for panel in v.all("mtb-hearing-panel"):
            content = panel.first("mtb-hearing-panel-content") or panel
            body = clean_html(content)
            if panel.has("mtb-hearing-notice"):
                cur = {"observe": body, "hear": ""}
                pairs.append(cur)
            elif panel.has("mtb-hearing-hear"):
                if cur is None or cur["hear"]:
                    cur = {"observe": "", "hear": body}
                    pairs.append(cur)
                else:
                    cur["hear"] = body
        if pairs:
            verses[n] = pairs
    return verses


def read_reflection_level(level):
    items = []
    for el in level.kids():
        if el.tag == "h3":
            continue
        lead = [c for c in el.children if c.tag or c.text.strip()] if el.tag == "p" else []
        st = lead[0] if lead and lead[0].tag in ("strong", "b") else None
        cat_node = st.first("mtb-spirit-life-category") if st else None
        if st is not None:
            cat = cat_node.get_text().strip("[] ") if cat_node else ""
            if cat_node:
                cat_node.remove()
            title = st.get_text().strip().rstrip(".").strip()
            st.remove()
            body = clean_html(el)
            items.append({"cat": cat or "Reflection", "title": title, "html": "<p>" + body + "</p>" if body else ""})
        elif items:
            items[-1]["html"] += "<%s>%s</%s>" % (el.tag if el.tag in ("p", "ul", "ol", "blockquote") else "p", clean_html(el), el.tag if el.tag in ("p", "ul", "ol", "blockquote") else "p")
    for it in items:
        t = text_of_html(it["html"])
        qs = re.findall(r"([^.?!”]*\?)[”’]?\s*$", t)
        it["q"] = qs[0].strip() if qs else re.split(r"(?<=[.!?”])\s+(?=[A-Z“])", t)[0] if t else ""
    return items


def read_reflections(path, chapter, nverses):
    root = parse(path)
    out = {"verses": {}, "sections": [], "whole": []}
    secs = root.all("mtb-reflection-section")
    containers = []
    if secs:
        for s in secs:
            summ = s.first(tag="summary")
            containers.append((summ.get_text() if summ else "", s))
    else:
        containers.append(("", root))
    for label, cont in containers:
        rng = parse_range(label, chapter) if label else None
        sec_items = []
        for level in cont.all("mtb-reflection-level"):
            h = level.first(tag="h3")
            ht = h.get_text() if h else ""
            items = read_reflection_level(level)
            m = re.search(r":(\d+)\s*$", ht)
            if m and level.has("mtb-reflection-level-verse"):
                out["verses"].setdefault(int(m.group(1)), []).extend(items)
            else:
                sec_items.extend(items)
        if not sec_items:
            continue
        whole = (rng is None) or (rng[0] <= 1 and rng[1] >= nverses and len(containers) > 1) or ("whole" in label.lower())
        if whole and not (rng and len(containers) == 1 and rng[1] < nverses):
            out["whole"].extend(sec_items)
        else:
            out["sections"].append({"start": rng[0], "end": min(rng[1], nverses), "title": rng[2], "items": sec_items})
    return out


def read_culture(path):
    root = parse(path)
    cards = []
    for c in root.all("mtb-culture-card"):
        t = c.first("mtb-culture-card-title")
        st = c.first("mtb-culture-standard-content")
        ap = c.first("mtb-culture-application")
        card = {"title": t.get_text() if t else "", "statement": "", "label": "", "html": ""}
        if st:
            card["statement"] = clean_html(st, drop_first_heading=True)
        if ap:
            lab = ap.first("mtb-culture-application-label")
            card["label"] = lab.get_text() if lab else ""
            con = ap.first("mtb-culture-application-content") or ap
            card["html"] = clean_html(con, drop_first_heading=True)
        if card["statement"] or card["html"]:
            cards.append(card)
    return cards


def read_chapter_outline(path, chapter, nverses):
    """Read the approved section headings and require exact chapter coverage."""
    headings = [node for node in parse(path).walk() if node.tag in ("h1", "h2", "h3", "h4")]
    sections = []
    section_heading = None
    for node in headings:
        text = node.get_text()
        if section_heading is None:
            if text.casefold() == "chapter sections":
                section_heading = node.tag
            continue
        if node.tag <= section_heading:
            break
        parsed = parse_range(text, chapter)
        if parsed and parsed[2]:
            sections.append(dict(start=parsed[0], end=parsed[1], title=parsed[2]))
    covered = [verse for section in sections for verse in range(section["start"], section["end"] + 1)]
    if covered != list(range(1, nverses + 1)):
        raise ValueError("published outline sections do not cover the chapter exactly once")
    return sections


# ---------------------------------------------------------------- one chapter
def build_chapter(site_root, testament, slug, name, n, files, nverses):
    """files: dict layer -> filename inside books/<t>/<slug>/<###>/"""
    folder = os.path.join(site_root, "books", testament, slug, "%03d" % n)
    data = {"book": name, "slug": slug, "chapter": n, "testament": testament, "verseCount": nverses,
            "layers": sorted(k for k in files if k in ("overview", "study", "hearing", "reflections", "culture"))}
    warn = []

    def p(layer):
        return os.path.join(folder, files[layer])

    if "overview" in files:
        try:
            data["overview"] = read_overview(p("overview"))
        except Exception as e:
            warn.append("overview could not be read (%s)" % e)
    study, study_heads = read_study(p("study"), n) if "study" in files else ({}, [])
    hearing = read_hearing(p("hearing")) if "hearing" in files else {}
    refl = read_reflections(p("reflections"), n, nverses) if "reflections" in files else {"verses": {}, "sections": [], "whole": []}
    if "culture" in files:
        data["culture"] = read_culture(p("culture"))

    # Sections: from the overview outline; else from reflection sections; else the whole chapter.
    sections = []
    for line in (data.get("overview") or {}).get("outline", []):
        r = parse_range(line, n)
        if r:
            sections.append({"start": r[0], "end": min(r[1], nverses), "title": r[2]})
    if "outline" in files:
        try:
            sections = read_chapter_outline(p("outline"), n, nverses)
            data["outline"] = f"books/{testament}/{slug}/{n:03d}/{files['outline']}"
        except ValueError as e:
            warn.append(str(e))
    if not sections and study_heads:
        sections = [{"start": h["start"], "end": min(h["end"], nverses), "title": h["title"]} for h in study_heads]
    if not sections:
        sections = [{"start": s["start"], "end": s["end"], "title": s["title"]} for s in refl["sections"]]
    if not sections:
        sections = [{"start": 1, "end": nverses, "title": ""}]
    # Make sure every verse belongs to exactly one section (no gaps, no overlaps).
    sections = sorted(sections, key=lambda x: x["start"])
    fixed = []
    for i, sec in enumerate(sections):
        nxt = sections[i + 1]["start"] if i + 1 < len(sections) else nverses + 1
        start = max(sec["start"], fixed[-1]["end"] + 1 if fixed else 1)
        if not fixed and start > 1:
            fixed.append({"start": 1, "end": start - 1, "title": ""})
        if start <= min(nverses, nxt - 1):
            fixed.append({"start": start, "end": min(nverses, nxt - 1), "title": sec["title"]})
    sections = fixed or [{"start": 1, "end": nverses, "title": ""}]
    for s in sections:
        s["groups"] = []
    # Each group of section reflections goes after the last outline section it covers.
    for rs in refl["sections"]:
        target = None
        for s in sections:
            if s["end"] <= rs["end"] and s["end"] >= rs["start"]:
                target = s
        if target is None:
            target = sections[-1]
        rng = "%d" % rs["start"] if rs["start"] == rs["end"] else "%d–%d" % (rs["start"], rs["end"])
        target["groups"].append({"range": rng, "title": rs["title"], "items": rs["items"]})
    data["sections"] = sections
    data["whole"] = refl["whole"]

    verses = {}
    for v in range(1, nverses + 1):
        d = dict(study.get(v, {}))
        if v in hearing:
            d["hearing"] = hearing[v]
        if v in refl["verses"]:
            d["reflections"] = refl["verses"][v]
        if d:
            verses[str(v)] = d
    data["verses"] = verses
    if "study" in files and not study:
        warn.append("study file has no verses the converter recognizes")
    return data, warn
