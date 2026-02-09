@echo off
:: Navigate to your project folder
cd /d "C:\Users\Mike\Documents\MTB\GitHub\mtb-site"

:: Open the URL in Chrome
:: This command will find Chrome automatically if it's your default browser.
start chrome "http://localhost:8000"

:: Start the Python server
python -m http.server 8000

pause