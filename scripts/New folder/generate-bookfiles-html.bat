@echo off
echo.
echo Mastering the Bible - Book Generator
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0generate-bookfiles-html.ps1"

echo.
echo Done. Press any key to close.
pause >nul
