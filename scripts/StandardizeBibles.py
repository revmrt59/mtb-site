import pandas as pd
import os
import glob
import unicodedata
from datetime import datetime

# --- Configuration ---
# Hardcoded absolute paths for your MTB environment
RAW_DIR = r"C:\Users\Mike\Documents\MTB\mtb-bible-translations\raw"
OUTPUT_DIR = r"C:\Users\Mike\Documents\MTB\mtb-bible-translations\csv_for_json"
XREF_FILE = os.path.join(RAW_DIR, "BIBLE BOOK NAME XREF.xlsx")
# Creating a timestamped log file in the output directory
LOG_FILE = os.path.join(OUTPUT_DIR, f"cleaning_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

def clean_mojibake(text):
    """Normalizes Unicode and fixes specific encoding artifacts."""
    if not isinstance(text, str):
        return text, False
    
    original = text
    
    # Normalize unicode to NFKC (Standardizes characters like fractions and accents)
    text = unicodedata.normalize('NFKC', text)
    
    # Dictionary of specific artifacts to hunt and replace
    # Includes the 'â€ ' sequence found in your earlier test
    replacements = {
        'â€œ': '"',  # Left double quote
        'â€': '"',  # Right double quote
        'â€ ': '"',   # Alternative right double quote
        'â€™': "'",  # Apostrophe/Right single quote
        'â€˜': "'",  # Left single quote
        'â€”': '—',  # Em dash
        'â€“': '-',  # En dash
        'Â': '',      # Often appears before non-breaking spaces
        'â€¦': '...' # Ellipsis
    }
    
    for bad, good in replacements.items():
        text = text.replace(bad, good)
        
    return text.strip(), text != original

def process_bibles():
    # Open the log file for writing
    with open(LOG_FILE, "w", encoding="utf-8") as log:
        log.write(f"MTB Cleaning Log - {datetime.now()}\n")
        log.write("="*50 + "\n")

        # 1. Load the X-REF file
        print(f"Loading X-REF from: {XREF_FILE}")
        try:
            # Reads the specific sheet name from your Excel workbook
            mapping_df = pd.read_excel(XREF_FILE, sheet_name='STANDARD_BOOK_LIST')
        except Exception as e:
            msg = f"FATAL ERROR: Could not read X-REF file. Ensure it is not open in Excel. {e}"
            log.write(msg + "\n")
            print(msg)
            return

        # 2. Identify all CSV files in the raw folder
        csv_files = glob.glob(os.path.join(RAW_DIR, "*.csv"))
        
        if not csv_files:
            print(f"No CSV files found in {RAW_DIR}")
            return

        for file_path in csv_files:
            filename = os.path.basename(file_path)
            # Assumes format: 'NKJV_Bible.csv' -> 'NKJV'
            trans_code = filename.split('_')[0]
            
            print(f"Processing: {trans_code}")
            log.write(f"\nTranslation: {trans_code}\n")
            
            # Load CSV with 'utf-8-sig' to handle Windows/Excel encoding quirks
            try:
                df = pd.read_csv(file_path, encoding='utf-8-sig')
            except Exception as e:
                log.write(f"  [ERROR] Could not read file: {e}\n")
                continue
            
            # 3. Standardize Book Names using the X-REF mapping
            if trans_code in mapping_df.columns:
                rename_map = dict(zip(mapping_df[trans_code], mapping_df['STANDARD']))
                
                # Check for books in the CSV that are missing from the X-REF
                unique_books = df['Book'].unique()
                for b in unique_books:
                    if b in rename_map:
                        if b != rename_map[b]:
                            log.write(f"  [RENAME] '{b}' -> '{rename_map[b]}'\n")
                    else:
                        log.write(f"  [MISSING X-REF] '{b}' not found in Excel mapping.\n")
                
                df['Book'] = df['Book'].map(rename_map).fillna(df['Book'])
            else:
                log.write(f"  [WARNING] No column named '{trans_code}' found in X-REF sheet.\n")

            # 4. Clean Mojibake in the 'Text' field
            clean_count = 0
            if 'Text' in df.columns:
                def apply_cleaning(val):
                    nonlocal clean_count
                    txt, changed = clean_mojibake(val)
                    if changed: clean_count += 1
                    return txt
                
                df['Text'] = df['Text'].apply(apply_cleaning)
            
            log.write(f"  [MOJIBAKE] Cleaned {clean_count} verses.\n")

            # 5. Save the cleaned file
            # This logic ensures the data is written to the csv_for_json folder
            save_path = os.path.join(OUTPUT_DIR, filename)
            df.to_csv(save_path, index=False, encoding='utf-8')
            log.write(f"  [SUCCESS] Saved to: {save_path}\n")

    print(f"\n--- Process Complete ---")
    print(f"Cleaned Files: {OUTPUT_DIR}")
    print(f"Log File: {LOG_FILE}")

if __name__ == "__main__":
    process_bibles()