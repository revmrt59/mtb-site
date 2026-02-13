@echo off
echo.
echo Mastering the Bible - BETA Site Generator
echo (Foundational Development Version)
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\beta-html-generator.ps1"

echo.
echo Beta Generation Done.
pause >nul