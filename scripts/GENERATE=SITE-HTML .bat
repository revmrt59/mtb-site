@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ------------------------------------------------------------
REM MTB Site Generator Menu
REM One batch file that prompts for mode and runs generate-site-html.ps1
REM ------------------------------------------------------------

REM Set the folder this BAT lives in (so paths work no matter where you run it)
set "BAT_DIR=%~dp0"

REM If your PS1 is in the same folder as the BAT, this will work.
REM If not, change PS1 to the correct full path.
set "PS1=%BAT_DIR%generate-site-html.ps1"

if not exist "%PS1%" (
  echo ERROR: Cannot find generate-site-html.ps1 at:
  echo   "%PS1%"
  echo Update the PS1 path in this BAT file.
  pause
  exit /b 1
)

:MENU
cls
echo ==========================================
echo   Mastering the Bible - Site Generator
echo ==========================================
echo.
echo Choose what to generate:
echo   1^) BOOK
echo   2^) ABOUT
echo   3^) RESOURCES
echo   4^) SECTIONS (Canonical Context)
echo.
echo   Q^) Quit
echo.

set "CHOICE="
set /p CHOICE=Enter choice (1-4, Q): 

if /i "%CHOICE%"=="Q" goto :EOF

set "MODE="
if "%CHOICE%"=="1" set "MODE=BOOK"
if "%CHOICE%"=="2" set "MODE=ABOUT"
if "%CHOICE%"=="3" set "MODE=RESOURCES"
if "%CHOICE%"=="4" set "MODE=SECTIONS"

if "%MODE%"=="" (
  echo.
  echo Invalid choice. Try again.
  pause
  goto MENU
)

echo.
echo Running Mode: %MODE%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Mode %MODE%
echo.
pause
goto MENU
