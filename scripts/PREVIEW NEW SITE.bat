@echo off
:: Mastering the Bible - preview the site on this computer
cd /d "C:\Users\Mike\Documents\MTB\GitHub\mtb-site"
python scripts\build_site.py
start "" "http://localhost:8000/"
python -m http.server 8000
pause
