@echo off
:: Navigate to your project folder
cd /d "C:\Users\Mike\Documents\MTB\GitHub\mtb-site"

:: Display your local network info for your tablet
echo ========================================================
echo To view this site on your Samsung tablet, make sure it 
echo is on the same Wi-Fi network, then open its browser and go to:
echo.
echo    http://192.168.1.15:8000
echo.
echo ========================================================
echo.

:: Open the URL in Chrome on your laptop
start chrome "http://localhost:8000"

:: Start the Python server (Listening on all network interfaces)
python -m http.server 8000 --bind 0.0.0.0

pause