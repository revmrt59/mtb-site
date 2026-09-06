import csv

# Mapping typographic characters to standard ASCII
CHAR_REPLACEMENTS = {
    "“": '"',
    "”": '"',
    "‘": "'",
    "’": "'",
    "´": "'",
    "—": " - ",
    "–": "-",
    "Ē": "E",
    "é": "e",
}


def sanitize_text(text):
    for orig, repl in CHAR_REPLACEMENTS.items():
        text = text.replace(orig, repl)
    return text


with open("NKJV_Bible.csv", "r", encoding="utf-8") as infile, open(
    "NKJV_Bible_ASCII.csv", "w", newline="", encoding="utf-8"
) as outfile:

    reader = csv.reader(infile)
    writer = csv.writer(outfile)

    for row in reader:
        writer.writerow([sanitize_text(col) for col in row])

print("Saved ASCII-normalized file as NKJV_Bible_ASCII.csv")