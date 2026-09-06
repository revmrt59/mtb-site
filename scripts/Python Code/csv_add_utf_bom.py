# Reads your current file and saves it with UTF-8 BOM
with open("NKJV_Bible.csv", "r", encoding="utf-8") as infile:
    content = infile.read()

with open("NKJV_Bible_clean.csv", "w", encoding="utf-8-sig") as outfile:
    outfile.write(content)

print("Saved clean file with UTF-8 BOM as NKJV_Bible_clean.csv")