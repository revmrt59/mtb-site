"""
Mastering the Bible - The Life of Jesus builder.

Reads the web source in  MTB\\mtb-source\\source\\loc-head :
  life-of-jesus-master.csv        the 184 events: order, titles, places, references, status
  life-of-jesus-meta.json         movements and threads
  life-of-jesus-movements.json    movement intros and "The Whole Story"
  events\\###-<slug>.json          the written events (Event Standard v1)

and writes the site data in  mtb-site\\loc\\data :
  loc.json                        everything the Life of Jesus pages list
  events\\<n>.json                 one file per written event

It also checks every quotation in each event's Story against the NKJV text
of that event's passages, and reports anything that does not match.

build_site.py runs this automatically. To run it alone:
  python scripts/build_loc.py
"""

import csv
import json
import os
import re
import sys
from datetime import datetime

LOC_INCLUDE_DRAFTS = True     # show Draft events on the site (with a Draft badge); set False to show only Approved

GOSPELS = ("matthew", "mark", "luke", "john")
CONFIDENCE = ("Stated", "Strong likelihood", "Reasonable possibility", "Views differ")


def paths(site_root):
    mtb = os.path.dirname(os.path.dirname(site_root))
    return {
        "src": os.path.join(mtb, "mtb-source", "source", "loc-head"),
        "out": os.path.join(site_root, "loc", "data"),
        "nkjv": os.path.join(site_root, "assets", "js", "bibles-json", "nkjv"),
    }


def _norm(s):
    s = s.replace("’", "'").replace("‘", "'").lower()
    s = re.sub(r"[^a-z0-9' ]+", " ", s).replace("'", "")
    return re.sub(r"\s+", " ", s).strip()


class Bible:
    def __init__(self, folder):
        self.folder, self.cache = folder, {}

    def chapters(self, book):
        if book not in self.cache:
            with open(os.path.join(self.folder, book + ".json"), encoding="utf-8") as f:
                self.cache[book] = json.load(f)["chapters"]
        return self.cache[book]

    def verses(self, book, spec):
        out, ch = [], None
        for part in spec.split(","):
            part = part.strip()
            if not part:
                continue
            m = re.fullmatch(r"(\d+):(\d+)-(\d+):(\d+)", part)
            if m:
                c1, v1, c2, v2 = map(int, m.groups())
                for c in range(c1, c2 + 1):
                    vs = self.chapters(book).get(str(c), {})
                    lo = v1 if c == c1 else 1
                    hi = v2 if c == c2 else max(int(k) for k in vs)
                    out += [vs[str(v)] for v in range(lo, hi + 1) if str(v) in vs]
                ch = c2
                continue
            m = re.fullmatch(r"(?:(\d+):)?(\d+)(?:-(\d+))?", part)
            if not m:
                raise ValueError("cannot read reference %s %s" % (book, spec))
            if m.group(1):
                ch = int(m.group(1))
            v1, v2 = int(m.group(2)), int(m.group(3) or m.group(2))
            vs = self.chapters(book).get(str(ch), {})
            out += [vs[str(v)] for v in range(v1, v2 + 1) if str(v) in vs]
        return out


def read_master(src):
    rows = []
    with open(os.path.join(src, "life-of-jesus-master.csv"), encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            rows.append({
                "n": int(r["n"]), "slug": r["slug"], "title": r["title"], "movement": int(r["movement"]),
                "when": r["when"], "day": r["day"], "place": r["place"], "region": r["region"], "kind": r["kind"],
                "refs": {g: r[g].strip() for g in GOSPELS if r[g].strip()}, "other": r["other"].strip(),
                "grouping": r["grouping"], "passover": r["passover"],
                "threads": r["threads"].split(), "status": (r["status"] or "planned").strip().lower(),
            })
    return rows


def check_event(ev, row, bible):
    """Return a list of problems with one event file."""
    errs = []
    hay = []
    for g, spec in row["refs"].items():
        try:
            hay += bible.verses(g, spec)
        except Exception as e:
            errs.append("reference %s %s could not be read (%s)" % (g, spec, e))
    hay = _norm(" ".join(hay))
    for i, p in enumerate(ev.get("story") or []):
        for q in re.findall(r"“([^”]+)”", p):
            if _norm(q) not in hay:
                errs.append("Story paragraph %d: quotation not found in the NKJV passages: “%s”" % (i + 1, q[:70]))
    for f in ev.get("fit") or []:
        if f.get("confidence") not in CONFIDENCE:
            errs.append("How the Accounts Fit: confidence must be one of %s" % ", ".join(CONFIDENCE))
        if not f.get("short"):
            errs.append("How the Accounts Fit: missing the one-line short answer")
    for k in ("summary", "story", "seeing", "preaching"):
        if not ev.get(k):
            errs.append("missing %s" % k)
    return errs


def build(site_root, problems, notes):
    p = paths(site_root)
    if not os.path.isdir(p["src"]):
        notes.append("Life of Jesus: source folder not found at %s; loc data not updated" % p["src"])
        return
    bible = Bible(p["nkjv"])
    rows = read_master(p["src"])
    with open(os.path.join(p["src"], "life-of-jesus-meta.json"), encoding="utf-8") as f:
        meta = json.load(f)
    mv_text = {}
    mv_path = os.path.join(p["src"], "life-of-jesus-movements.json")
    intro, story_status = "", "draft"
    if os.path.exists(mv_path):
        with open(mv_path, encoding="utf-8") as f:
            mvj = json.load(f)
        intro, story_status = mvj.get("intro", ""), mvj.get("status", "draft")
        mv_text = {m["n"]: m for m in mvj.get("movements", [])}

    ev_dir = os.path.join(p["src"], "events")
    files = {}
    if os.path.isdir(ev_dir):
        for name in sorted(os.listdir(ev_dir)):
            m = re.match(r"^(\d{3})-.*\.json$", name)
            if m:
                files[int(m.group(1))] = name
            elif name.lower().endswith(".json"):
                notes.append("Life of Jesus: file name not recognized, ignored: events/%s" % name)

    out_events = os.path.join(p["out"], "events")
    os.makedirs(out_events, exist_ok=True)
    for old in os.listdir(out_events):
        if old.endswith(".json"):
            os.remove(os.path.join(out_events, old))

    by_n = {r["n"]: r for r in rows}
    written = {"approved": 0, "draft": 0}
    events_out = []
    for r in rows:
        e = {k: r[k] for k in ("n", "slug", "title", "movement", "when", "day", "place", "region", "kind",
                               "refs", "other", "grouping", "passover", "threads")}
        e["status"] = "planned"
        name = files.get(r["n"])
        if name:
            try:
                with open(os.path.join(ev_dir, name), encoding="utf-8") as f:
                    ev = json.load(f)
            except Exception as ex:
                problems.append("Life of Jesus %d: could not read %s (%s)" % (r["n"], name, ex))
                ev = None
            if ev is not None:
                status = (ev.get("status") or "draft").lower()
                for err in check_event(ev, r, bible):
                    problems.append("Life of Jesus %d %s: %s" % (r["n"], r["title"], err))
                if status == "approved" or LOC_INCLUDE_DRAFTS:
                    e["status"] = status
                    e["summary"] = ev.get("summary", "")
                    e["fit"] = [{"q": f.get("question", ""), "short": f.get("short", ""), "c": f.get("confidence", "")}
                                for f in (ev.get("fit") or [])]
                    full = dict(ev)
                    full.update({k: e[k] for k in ("n", "slug", "title", "movement", "when", "day", "place", "region",
                                                   "kind", "refs", "other", "passover", "threads", "status")})
                    full["related"] = [{"n": n, "title": by_n[n]["title"]} for n in (ev.get("preaching", {}).get("related") or []) if n in by_n]
                    full.pop("notes_internal", None)
                    with open(os.path.join(out_events, "%d.json" % r["n"]), "w", encoding="utf-8") as f:
                        json.dump(full, f, ensure_ascii=False, separators=(",", ":"))
                    written[status if status in written else "draft"] += 1
        events_out.append(e)

    movements = []
    for m in meta["movements"]:
        t = mv_text.get(m["n"], {})
        movements.append(dict(m, summary=t.get("summary", ""), intro=t.get("intro", ""),
                              order_note=t.get("order_note", ""), story=t.get("story", []),
                              count=m["last"] - m["first"] + 1))
    data = {"generated": datetime.now().strftime("%Y-%m-%d %H:%M"), "drafts": LOC_INCLUDE_DRAFTS,
            "intro": intro, "story_status": story_status, "movements": movements,
            "threads": meta["threads"], "events": events_out}
    with open(os.path.join(p["out"], "loc.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    notes.append("Life of Jesus: %d events listed; %d approved, %d draft written%s"
                 % (len(events_out), written["approved"], written["draft"],
                    "" if LOC_INCLUDE_DRAFTS else " (drafts hidden)"))


if __name__ == "__main__":
    site = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    probs, nts = [], []
    build(site, probs, nts)
    print("NEEDS ATTENTION (%d)" % len(probs))
    for x in probs:
        print("  - " + x)
    for x in nts:
        print("  " + x)
