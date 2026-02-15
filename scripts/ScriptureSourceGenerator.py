import csv
import os
from docx import Document

# Configuration
NKJV_CSV = r"C:\Users\Mike\Documents\MTB\mtb-bible-translations\NKJV_Bible.csv"
NLT_CSV = r"C:\Users\Mike\Documents\MTB\mtb-bible-translations\NLT_Bible.csv"
BASE_PATH = r"C:\Users\Mike\Documents\MTB\mtb-source\source\books"

# Master Convention
BOOK_SLUG = "2-timothy" 
TESTAMENT = "new-testament"

def get_bible_data_by_id(filename):
    """Matches 2 Timothy by checking for common naming markers in different translations."""
    data = {}
    with open(filename, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            book_name = row['Book'].lower()
            # Identifies 2 Timothy regardless of formal or short naming
            if ("second epistle" in book_name and "timothy" in book_name) or ("2 timothy" in book_name):
                chap = int(row['Chapter'])
                if chap not in data: data[chap] = []
                data[chap].append(row)
    return data

def generate_docx_source():
    print(f"Starting .docx generation for: {BOOK_SLUG}...")
    
    nkjv_data = get_bible_data_by_id(NKJV_CSV)
    nlt_data = get_bible_data_by_id(NLT_CSV)

    if not nkjv_data or not nlt_data:
        print(f"Error: Could not find 2 Timothy data in the CSV files.")
        return

    for chap_num in sorted(nkjv_data.keys()):
        # Three-digit padding for the folder: 001, 002, etc.
        chap_folder = str(chap_num).zfill(3)
        
        # Exact directory path: ...\2-timothy\001
        target_dir = os.path.join(BASE_PATH, TESTAMENT, BOOK_SLUG, chap_folder)
        os.makedirs(target_dir, exist_ok=True)
        
        # Filename: 2-timothy-1-chapter-scripture.docx
        filename = f"{BOOK_SLUG}-{chap_num}-chapter-scripture.docx"
        save_path = os.path.join(target_dir, filename)

        doc = Document()
        
        # Create Table with columns: Verse, NKJV, NLT
        table = doc.add_table(rows=1, cols=3)
        table.style = 'Table Grid'
        hdr_cells = table.rows[0].cells
        hdr_cells[0].text = 'Verse'
        hdr_cells[1].text = 'NKJV'
        hdr_cells[2].text = 'NLT'

        for i, v_nkjv in enumerate(nkjv_data[chap_num]):
            v_nlt = nlt_data[chap_num][i] if i < len(nlt_data[chap_num]) else {"Text": ""}
            row_cells = table.add_row().cells
            row_cells[0].text = str(v_nkjv['Verse'])
            row_cells[1].text = v_nkjv['Text']
            row_cells[2].text = v_nlt['Text']

        doc.save(save_path)
        print(f"Created: {save_path}")

if __name__ == "__main__":
    generate_docx_source()