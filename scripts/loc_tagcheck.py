"""
Life of Jesus - Gospel tag check.

In a woven Story, a tag such as {Lk} says which Gospel the words before it
come from (back to the previous tag or the start of the paragraph). This check
reads each tagged clause and compares it with that Gospel's passage for the
event (NKJV).

  ERROR    a quotation inside the clause is not in the tagged Gospel's passage,
           or the event has no passage from the tagged Gospel.
  CHECK A  a name or number in the clause is missing from the tagged Gospel's
           passage but present in another Gospel's (likely the wrong tag, as
           Bartimaeus tagged to Luke in event 127).
  CHECK B  a name or number in the clause is in none of the event's passages
           (usually scene-setting; sometimes a summary that says more than the
           text, as "The four forsook all" tagged to Luke in event 31).

Errors go to the build report. CHECK items are listed in
data/loc-tag-check.txt for a person or the reviewer to look at; some will be
fine (a paraphrase, or a name supplied for clarity).
"""

import re

TAGS = {"Mt": "matthew", "Mk": "mark", "Lk": "luke", "Jn": "john"}
NAMES = {"matthew": "Matthew", "mark": "Mark", "luke": "Luke", "john": "John"}
NUMBER_WORDS = set("""two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen
sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy hundred thousand
second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth both""".split())
# Capitalized words that are not details a Gospel "supplies"
COMMON = set("""I He Him His Himself You Your Yours Me My Mine We Us Our They Them Their She Her It
God LORD Lord Jesus Christ Father Son Spirit Holy Ghost Heaven Amen Then When And But So Now As After
Before While There The A An In On At Of To For With From By Into Out Up Down Again Also Yet Even
Truly Assuredly Behold Why What Who How Where Which Whoever If Do Does Did Is Are Was Were Be Not No
Yes Oh O Then This That These Those All Some Many One Each Every Let Go Come Rabbi Teacher Master
Matthew Mark Luke Gospel Gospels Scripture Scriptures Instead Once Man Jewish Old New Testament""".split())


def _norm(s):
    s = s.replace("’", "'").replace("‘", "'").lower()
    s = re.sub(r"[^a-z0-9' ]+", " ", s).replace("'", "")
    return " " + re.sub(r"\s+", " ", s).strip() + " "


def _segments(paragraph):
    """Yield (gospel, clause) for every tagged clause in a paragraph."""
    pos = 0
    for m in re.finditer(r"\{(Mt|Mk|Lk|Jn)\}", paragraph):
        clause = paragraph[pos:m.start()].strip()
        pos = m.end()
        if clause:
            yield TAGS[m.group(1)], clause


def _details(clause):
    """Names and numbers mentioned outside quotations."""
    bare = re.sub(r"“[^”]*”", " ", clause)
    out = []
    for sent in re.split(r"(?<=[.!?;:])\s+", bare):
        words = re.findall(r"[A-Za-z][A-Za-z’']*", sent)
        for i, w in enumerate(words):
            w = re.sub(r"[’']s?$", "", w)
            lw = w.lower()
            if lw in NUMBER_WORDS:
                out.append(w)
            elif w[0].isupper() and i > 0 and w not in COMMON:
                out.append(w)
    for d in re.findall(r"\b\d[\d,]*\b", bare):
        out.append(d)
    seen, res = set(), []
    for w in out:
        if w.lower() not in seen:
            seen.add(w.lower())
            res.append(w)
    return res


def check_tags(ev, row, bible):
    """Return (errors, checks) for one event's Story."""
    errors, checks = [], []
    text = {}
    for g, spec in row["refs"].items():
        try:
            text[g] = _norm(" ".join(bible.verses(g, spec)))
        except Exception:
            pass  # check_event already reports unreadable references
    # passages from outside the Gospels (Acts 1, 1 Corinthians 15) count as "another source"
    other_books = {"Acts": ("acts", "Acts"), "1 Cor": ("1-corinthians", "1 Corinthians"),
                   "1 Corinthians": ("1-corinthians", "1 Corinthians")}
    for o in (row.get("other") or "").split(";"):
        m = re.match(r"^(\d?\s?[A-Za-z]+)\s+([\d:,\-]+)$", o.strip())
        if m and m.group(1) in other_books:
            book, label = other_books[m.group(1)]
            try:
                text[label] = _norm(" ".join(bible.verses(book, m.group(2))))
                NAMES.setdefault(label, label)
            except Exception:
                pass
    for i, p in enumerate(ev.get("story") or []):
        for g, clause in _segments(p):
            short = clause if len(clause) <= 90 else clause[:87] + "..."
            if g not in text:
                errors.append("Story paragraph %d: tagged %s, but this event has no %s passage: \"%s\""
                              % (i + 1, NAMES[g], NAMES[g], short))
                continue
            for q in re.findall(r"“([^”]+)”", clause):
                if _norm(q).strip() and _norm(q) not in text[g] and _norm(q).strip() not in text[g]:
                    elsewhere = [NAMES[o] for o in text if o != g and _norm(q).strip() in text[o]]
                    errors.append("Story paragraph %d: quotation tagged %s is not in %s's passage%s: \"%s\""
                                  % (i + 1, NAMES[g], NAMES[g],
                                     (" (it is in " + " and ".join(elsewhere) + ")") if elsewhere else "",
                                     q[:70]))
            for d in _details(clause):
                nd = _norm(d).rstrip()          # " andrew" also matches "andrew's" / "andrews"
                if nd in text[g]:
                    continue
                elsewhere = [NAMES[o] for o in text if o != g and nd in text[o]]
                if elsewhere:
                    checks.append(("A", "Story paragraph %d, tagged %s: \"%s\" comes from %s, not %s. Clause: \"%s\""
                                   % (i + 1, NAMES[g], d, " and ".join(elsewhere), NAMES[g], short)))
                else:
                    checks.append(("B", "Story paragraph %d, tagged %s: \"%s\" is in none of this event's passages. Clause: \"%s\""
                                   % (i + 1, NAMES[g], d, short)))
    return errors, checks
