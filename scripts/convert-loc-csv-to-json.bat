@echo off
setlocal

echo ===================================================
echo   Converting Life of Christ CSV to JSON
echo ===================================================
echo.

set SCRIPT_PATH=C:\Users\Mike\Documents\MTB\GitHub\mtb-site\scripts\convert-loc-csv-to-json.ps1

if not exist "%SCRIPT_PATH%" (
    echo ERROR: Script not found:
    echo %SCRIPT_PATH%
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%"

echo.
echo ===================================================
echo   Done.
echo ===================================================
echo.
pause
