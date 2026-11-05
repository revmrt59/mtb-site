@echo off
:: Mastering the Bible - preview the new site on this computer
cd /d "C:\Users\Mike\Documents\MTB\GitHub\mtb-site"
python scripts\build_site.py
start "" "http://localhost:8000/next/"
python -m http.server 8000
pause
