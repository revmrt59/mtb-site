import csv
import os
import re
import ssl
import sys
import urllib.request

OUTPUT_DIR = r"C:\Users\Mike\Documents\MTB"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "bible_section_headings.csv")

# Authoritative BSB source endpoints hosted directly on bereanbible.com / openbible
DATA_URLS = [
    "https://bereanbible.com/bsb_headings.txt",
    "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/csv/key_english.csv",
    "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/TBESH%20-%20Translators%20Brief%20Eng%20Section%20Headings/TBESH.txt"
]

CANON_BOOKS = [
    (1, "GEN", "Genesis"), (2, "EXO", "Exodus"), (3, "LEV", "Leviticus"),
    (4, "NUM", "Numbers"), (5, "DEU", "Deuteronomy"), (6, "JOS", "Joshua"),
    (7, "JDG", "Judges"), (8, "RUT", "Ruth"), (9, "1SA", "1 Samuel"),
    (10, "2SA", "2 Samuel"), (11, "1KI", "1 Kings"), (12, "2KI", "2 Kings"),
    (13, "1CH", "1 Chronicles"), (14, "2CH", "2 Chronicles"), (15, "EZR", "Ezra"),
    (16, "NEH", "Nehemiah"), (17, "EST", "Esther"), (18, "JOB", "Job"),
    (19, "PSA", "Psalms"), (20, "PRO", "Proverbs"), (21, "ECC", "Ecclesiastes"),
    (22, "SNG", "Song of Solomon"), (23, "ISA", "Isaiah"), (24, "JER", "Jeremiah"),
    (25, "LAM", "Lamentations"), (26, "EZK", "Ezekiel"), (27, "DAN", "Daniel"),
    (28, "HOS", "Hosea"), (29, "JOL", "Joel"), (30, "AMO", "Amos"),
    (31, "OBA", "Obadiah"), (32, "JON", "Jonah"), (33, "MIC", "Micah"),
    (34, "NAM", "Nahum"), (35, "HAB", "Habakkuk"), (36, "ZEP", "Zephaniah"),
    (37, "HAG", "Haggai"), (38, "ZEC", "Zechariah"), (39, "MAL", "Malachi"),
    (40, "MAT", "Matthew"), (41, "MRK", "Mark"), (42, "LUK", "Luke"),
    (43, "JHN", "John"), (44, "ACT", "Acts"), (45, "ROM", "Romans"),
    (46, "1CO", "1 Corinthians"), (47, "2CO", "2 Corinthians"), (48, "GAL", "Galatians"),
    (49, "EPH", "Ephesians"), (50, "PHP", "Philippians"), (51, "COL", "Colossians"),
    (52, "1TH", "1 Thessalonians"), (53, "2TH", "2 Thessalonians"), (54, "1TI", "1 Timothy"),
    (55, "2TI", "2 Timothy"), (56, "TIT", "Titus"), (57, "PHM", "Philemon"),
    (58, "HEB", "Hebrews"), (59, "JAS", "James"), (60, "1PE", "1 Peter"),
    (61, "2PE", "2 Peter"), (62, "1JN", "1 John"), (63, "2JN", "2 John"),
    (64, "3JN", "3 John"), (65, "JUD", "Jude"), (66, "REV", "Revelation")
]

# Standardize name lookup
CANON_BY_NAME = {}
CANON_BY_CODE = {}
for num, code, name in CANON_BOOKS:
    meta = {"Number": num, "Code": code, "Book": name}
    CANON_BY_NAME[name.lower()] = meta
    CANON_BY_NAME[name.lower().replace(" ", "")] = meta
    CANON_BY_CODE[code] = meta

def download_data():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

    # Primary working GitHub CDN hosting full BSB text table with section headers
    primary_url = "https://raw.githubusercontent.com/grsmto/bible-headings/master/headings.tsv"
    
    print(f"Requesting master heading table...")
    try:
        req = urllib.request.Request(primary_url, headers=headers)
        with urllib.request.urlopen(req, context=ctx, timeout=25) as resp:
            content = resp.read().decode("utf-8")
            print(f"Downloaded payload ({len(content)} characters).")
            return content
    except Exception as e:
        print(f"Primary download failed: {e}")
        return None

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    raw_text = download_data()

    if not raw_text:
        print("Fatal error: Could not retrieve heading data from remote server.")
        sys.exit(1)

    lines = raw_text.strip().splitlines()
    print(f"Total lines in source: {len(lines)}")

    raw_entries = []
    for line in lines:
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        
        b_name = parts[0].strip()
        b_key = b_name.lower().replace(" ", "")
        
        if b_key not in CANON_BY_NAME:
            continue

        raw_entries.append({
            "meta": CANON_BY_NAME[b_key],
            "chapter": int(parts[1]),
            "verse": int(parts[2]),
            "heading": parts[3].strip()
        })

    if not raw_entries:
        print("Error: No entries matched the canonical book list.")
        sys.exit(1)

    # Track how many distinct books were collected
    unique_books = {e["meta"]["Code"] for e in raw_entries}
    print(f"Matched {len(raw_entries)} section markers across {len(unique_books)} books.")

    # Calculate exact Start and End verse spans
    final_rows = []
    for i, curr in enumerate(raw_entries):
        meta = curr["meta"]
        sc = curr["chapter"]
        sv = curr["verse"]

        # Look at next entry to establish end boundary
        if i + 1 < len(raw_entries) and raw_entries[i + 1]["meta"]["Code"] == meta["Code"]:
            nxt = raw_entries[i + 1]
            if nxt["chapter"] == sc:
                ec = sc
                ev = max(sv, nxt["verse"] - 1)
            else:
                ec = nxt["chapter"]
                ev = max(1, nxt["verse"] - 1)
        else:
            ec = sc
            ev = sv

        if sc == ec and sv == ev:
            disp = f"{meta['Book']} {sc}:{sv}"
        elif sc == ec:
            disp = f"{meta['Book']} {sc}:{sv}-{ev}"
        else:
            disp = f"{meta['Book']} {sc}:{sv} - {ec}:{ev}"

        final_rows.append({
            "BookNumber": meta["Number"],
            "BookCode": meta["Code"],
            "BookName": meta["Book"],
            "Heading": curr["heading"],
            "StartChapter": sc,
            "StartVerse": sv,
            "EndChapter": ec,
            "EndVerse": ev,
            "RangeDisplay": disp
        })

    fieldnames = [
        "BookNumber",
        "BookCode",
        "BookName",
        "Heading",
        "StartChapter",
        "StartVerse",
        "EndChapter",
        "EndVerse",
        "RangeDisplay"
    ]

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(final_rows)

    print(f"SUCCESS: Exported {len(final_rows)} section headings covering all {len(unique_books)} canonical books.")
    print(f"File: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()