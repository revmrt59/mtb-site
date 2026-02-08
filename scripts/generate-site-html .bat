@echo off
echo.
echo Mastering the Bible - site Generator
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0generate-site-html.ps1"

echo.
echo Done. Press any key to close.
pause >nul
