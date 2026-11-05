@echo off
:: Mastering the Bible - rebuild the new site's data (Library list + problem report)
:: Run this after "GENERATE=SITE-HTML" whenever chapters are added or changed.
cd /d "C:\Users\Mike\Documents\MTB\GitHub\mtb-site"
python scripts\build_site.py
echo.
echo The report above is also saved in data\build-report.txt
pause
