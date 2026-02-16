@echo off
setlocal

echo.
echo ==================================================
echo MTB Bible CSV to JSON Converter
echo Input:  C:\Users\Mike\Documents\MTB\mtb-bible-translations\csv_for_json\*.csv
echo Output: C:\Users\Mike\Documents\MTB\GitHub\mtb-site\assets\js\bibles-json\
echo ==================================================
echo.

set /p VERSION=Enter bible version key (e.g., nkjv, nlt, esv, niv, nasb, ylt, tlv, amp, kjv) or ALL:
if "%VERSION%"=="" set VERSION=ALL

powershell -NoProfile -ExecutionPolicy Bypass ^
  -File "%~dp0convert-bible-csv-to-json.ps1" ^
  -VersionKey "%VERSION%" ^
  -VerboseStats

echo.
echo Done. Press any key to close.
pause >nul
