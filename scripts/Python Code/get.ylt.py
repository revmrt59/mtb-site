import requests
import csv
import time
import re

# Configuration
API_BASE = "https://bolls.life"
TRANSLATION = "YLT"  # This pulls the New Living Translation
CSV_FILENAME = "YLT_Bible.csv"

def clean_html(text):
    """Removes HTML tags from the verse text."""
    return re.sub(r'<[^>]*>', '', text)

def fetch_bible():
    print(f"Connecting to {API_BASE} for {TRANSLATION}...")
    
    books_url = f"{API_BASE}/get-books/{TRANSLATION}/"
    response = requests.get(books_url)
    
    if not response.ok:
        print(f"Error: Could not reach API. Status code: {response.status_code}")
        return
    
    books_data = response.json()
    
    with open(CSV_FILENAME, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(["Book", "Chapter", "Verse", "Text"])
        
        for book in books_data:
            book_id = book['bookid']
            book_name = book['name']
            chapters_count = book['chapters']
            
            print(f"Downloading {book_name} ({chapters_count} chapters)...")
            
            for chapter_num in range(1, chapters_count + 1):
                chapter_url = f"{API_BASE}/get-chapter/{TRANSLATION}/{book_id}/{chapter_num}/"
                ch_response = requests.get(chapter_url)
                
                if ch_response.ok:
                    verses = ch_response.json()
                    for verse in verses:
                        writer.writerow([
                            book_name,
                            chapter_num,
                            verse['verse'],
                            clean_html(verse['text'])
                        ])
                time.sleep(0.1) # Respectful delay

    print(f"\nSuccess! Your Bible is saved in {CSV_FILENAME}")

if __name__ == "__main__":
    fetch_bible()