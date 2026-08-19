import csv
import json
import os
import re
import shutil
from datetime import datetime


# ============================================================
# CONFIGURATION
# ============================================================

CSV_PATH = r"C:\Users\Mike\Documents\MTB\mtb-bible-translations\csv_for_json\KJV.Bible.csv"

# CHANGE THIS ONLY IF YOUR SITE ROOT IS SOMEWHERE ELSE.
OUTPUT_DIR = r"C:\Users\Mike\Documents\MTB\GitHub\mtb-site\assets\js\bibles-json\kjv"


# ============================================================
# BOOK NAME -> MTB SLUG
# ============================================================

BOOK_SLUGS = {
    "Genesis": "genesis",
    "Exodus": "exodus",
    "Leviticus": "leviticus",
    "Numbers": "numbers",
    "Deuteronomy": "deuteronomy",
    "Joshua": "joshua",
    "Judges": "judges",
    "Ruth": "ruth",
    "1 Samuel": "1-samuel",
    "2 Samuel": "2-samuel",
    "1 Kings": "1-kings",
    "2 Kings": "2-kings",
    "1 Chronicles": "1-chronicles",
    "2 Chronicles": "2-chronicles",
    "Ezra": "ezra",
    "Nehemiah": "nehemiah",
    "Esther": "esther",
    "Job": "job",
    "Psalms": "psalms",
    "Psalm": "psalms",
    "Proverbs": "proverbs",
    "Ecclesiastes": "ecclesiastes",
    "Song of Solomon": "song-of-solomon",
    "Isaiah": "isaiah",
    "Jeremiah": "jeremiah",
    "Lamentations": "lamentations",
    "Ezekiel": "ezekiel",
    "Daniel": "daniel",
    "Hosea": "hosea",
    "Joel": "joel",
    "Amos": "amos",
    "Obadiah": "obadiah",
    "Jonah": "jonah",
    "Micah": "micah",
    "Nahum": "nahum",
    "Habakkuk": "habakkuk",
    "Zephaniah": "zephaniah",
    "Haggai": "haggai",
    "Zechariah": "zechariah",
    "Malachi": "malachi",

    "Matthew": "matthew",
    "Mark": "mark",
    "Luke": "luke",
    "John": "john",
    "Acts": "acts",
    "Romans": "romans",
    "1 Corinthians": "1-corinthians",
    "2 Corinthians": "2-corinthians",
    "Galatians": "galatians",
    "Ephesians": "ephesians",
    "Philippians": "philippians",
    "Colossians": "colossians",
    "1 Thessalonians": "1-thessalonians",
    "2 Thessalonians": "2-thessalonians",
    "1 Timothy": "1-timothy",
    "2 Timothy": "2-timothy",
    "Titus": "titus",
    "Philemon": "philemon",
    "Hebrews": "hebrews",
    "James": "james",
    "1 Peter": "1-peter",
    "2 Peter": "2-peter",
    "1 John": "1-john",
    "2 John": "2-john",
    "3 John": "3-john",
    "Jude": "jude",
    "Revelation": "revelation",
}


# ============================================================
# HELPERS
# ============================================================

def normalize_header(value):
    """Normalize CSV column names for flexible matching."""
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def find_column(fieldnames, possible_names):
    """
    Find a CSV column even if capitalization or spacing differs.
    Example: 'Book Name', 'book_name', 'BOOK' etc.
    """
    normalized = {
        normalize_header(name): name
        for name in fieldnames
        if name is not None
    }

    for possible in possible_names:
        key = normalize_header(possible)
        if key in normalized:
            return normalized[key]

    return None


def normalize_book_name(book):
    """Handle a few common alternate book-name conventions."""
    book = str(book).strip()

    replacements = {
        "Psalms": "Psalms",
        "Psalm": "Psalms",

        "I Samuel": "1 Samuel",
        "II Samuel": "2 Samuel",
        "I Kings": "1 Kings",
        "II Kings": "2 Kings",
        "I Chronicles": "1 Chronicles",
        "II Chronicles": "2 Chronicles",

        "I Corinthians": "1 Corinthians",
        "II Corinthians": "2 Corinthians",
        "I Thessalonians": "1 Thessalonians",
        "II Thessalonians": "2 Thessalonians",
        "I Timothy": "1 Timothy",
        "II Timothy": "2 Timothy",
        "I Peter": "1 Peter",
        "II Peter": "2 Peter",
        "I John": "1 John",
        "II John": "2 John",
        "III John": "3 John",

        "Song of Songs": "Song of Solomon",
        "Canticles": "Song of Solomon",
        "Revelation of John": "Revelation",
    }

    return replacements.get(book, book)


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 70)
    print("MTB KJV JSON GENERATOR")
    print("=" * 70)

    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(
            f"\nKJV CSV not found:\n{CSV_PATH}"
        )

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # --------------------------------------------------------
    # Back up existing KJV JSON files
    # --------------------------------------------------------

    existing_json = [
        f for f in os.listdir(OUTPUT_DIR)
        if f.lower().endswith(".json")
    ]

    if existing_json:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

        backup_dir = os.path.join(
            os.path.dirname(OUTPUT_DIR),
            f"kjv-backup-{timestamp}"
        )

        os.makedirs(backup_dir, exist_ok=True)

        for filename in existing_json:
            shutil.copy2(
                os.path.join(OUTPUT_DIR, filename),
                os.path.join(backup_dir, filename)
            )

        print(f"\nBacked up {len(existing_json)} existing JSON files to:")
        print(backup_dir)

    # --------------------------------------------------------
    # Read CSV
    # --------------------------------------------------------

    print(f"\nReading:")
    print(CSV_PATH)

    with open(CSV_PATH, "r", encoding="utf-8-sig", newline="") as f:

        reader = csv.DictReader(f)

        if not reader.fieldnames:
            raise ValueError("CSV does not contain a header row.")

        print("\nCSV columns found:")
        for field in reader.fieldnames:
            print(f"  - {field}")

        book_col = find_column(
            reader.fieldnames,
            ["Book", "Book Name", "BookName"]
        )

        chapter_col = find_column(
            reader.fieldnames,
            ["Chapter", "Chapter Number", "ChapterNumber"]
        )

        verse_col = find_column(
            reader.fieldnames,
            ["Verse", "Verse Number", "VerseNumber"]
        )

        text_col = find_column(
            reader.fieldnames,
            [
                "Text",
                "Verse Text",
                "VerseText",
                "Scripture",
                "KJV",
                "KJV Text"
            ]
        )

        missing = []

        if not book_col:
            missing.append("Book")
        if not chapter_col:
            missing.append("Chapter")
        if not verse_col:
            missing.append("Verse")
        if not text_col:
            missing.append("Text")

        if missing:
            raise ValueError(
                "\nCould not identify required CSV columns: "
                + ", ".join(missing)
                + "\n\nColumns actually found:\n"
                + ", ".join(reader.fieldnames)
            )

        print("\nUsing columns:")
        print(f"  Book:    {book_col}")
        print(f"  Chapter: {chapter_col}")
        print(f"  Verse:   {verse_col}")
        print(f"  Text:    {text_col}")

        # ----------------------------------------------------
        # Build Bible structure
        # ----------------------------------------------------

        bible = {}
        verse_count = 0
        skipped_rows = 0

        for row_number, row in enumerate(reader, start=2):

            raw_book = row.get(book_col, "")
            raw_chapter = row.get(chapter_col, "")
            raw_verse = row.get(verse_col, "")
            raw_text = row.get(text_col, "")

            book = normalize_book_name(raw_book)
            chapter = str(raw_chapter).strip()
            verse = str(raw_verse).strip()
            text = str(raw_text).strip()

            if not book or not chapter or not verse or not text:
                skipped_rows += 1
                print(
                    f"WARNING: Skipping incomplete row {row_number}"
                )
                continue

            if book not in BOOK_SLUGS:
                raise ValueError(
                    f"\nUnknown book name at CSV row {row_number}:\n"
                    f"'{book}'\n\n"
                    "Add this book-name variation to BOOK_SLUGS "
                    "or normalize_book_name()."
                )

            try:
                chapter_num = str(int(float(chapter)))
                verse_num = str(int(float(verse)))
            except ValueError:
                raise ValueError(
                    f"Invalid chapter/verse at row {row_number}: "
                    f"{book} {chapter}:{verse}"
                )

            if book not in bible:
                bible[book] = {}

            if chapter_num not in bible[book]:
                bible[book][chapter_num] = {}

            if verse_num in bible[book][chapter_num]:
                raise ValueError(
                    f"Duplicate verse found at row {row_number}: "
                    f"{book} {chapter_num}:{verse_num}"
                )

            bible[book][chapter_num][verse_num] = text
            verse_count += 1

    # --------------------------------------------------------
    # Write one JSON file per book
    # --------------------------------------------------------

    print("\nGenerating KJV JSON files...\n")

    generated = 0

    for book, chapters in bible.items():

        slug = BOOK_SLUGS[book]

        output = {
            "translationKey": "kjv",
            "translation": "KJV",
            "book": book,
            "bookSlug": slug,
            "chapters": chapters
        }

        output_path = os.path.join(
            OUTPUT_DIR,
            f"{slug}.json"
        )

        with open(
            output_path,
            "w",
            encoding="utf-8",
            newline=""
        ) as f:
            json.dump(
                output,
                f,
                ensure_ascii=False,
                separators=(",", ":")
            )

        generated += 1
        print(f"Created: {slug}.json")

    # --------------------------------------------------------
    # QC
    # --------------------------------------------------------

    print("\n" + "=" * 70)
    print("QC")
    print("=" * 70)

    expected_books = set(BOOK_SLUGS.values())
    generated_books = {
        BOOK_SLUGS[b]
        for b in bible.keys()
    }

    missing_books = expected_books - generated_books

    print(f"Books generated: {generated}")
    print(f"Verses loaded:   {verse_count}")
    print(f"Rows skipped:    {skipped_rows}")

    if missing_books:
        print("\nWARNING - These expected books were not generated:")
        for slug in sorted(missing_books):
            print(f"  - {slug}")
    else:
        print("\nPASS: All 66 Bible books were generated.")

    # Specific check for the verse that exposed the problem
    john2 = bible.get("2 John", {})
    john2_ch1 = john2.get("1", {})
    john2_v1 = john2_ch1.get("1")

    print("\n2 John 1:1 QC:")

    if john2_v1:
        print(john2_v1)

        # Detect obvious old Strong's contamination:
        # word immediately followed by 1-5 digits
        strong_pattern = re.compile(r"[A-Za-z'’]+\d{1,5}\b")

        if strong_pattern.search(john2_v1):
            print(
                "\nWARNING: 2 John 1:1 still appears to contain "
                "Strong's numbers."
            )
        else:
            print("\nPASS: No attached Strong's numbers detected.")
    else:
        print("WARNING: 2 John 1:1 was not found.")

    print("\nOutput folder:")
    print(OUTPUT_DIR)

    print("\nDone.")


if __name__ == "__main__":
    main()