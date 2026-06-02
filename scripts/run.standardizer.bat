@echo off
title MTB Bible Standardizer
echo -------------------------------------------------------
echo Running Bible Standardizer and Cleaning Tool...
echo -------------------------------------------------------

:: Navigate to the scripts directory
cd /d "C:\Users\Mike\Documents\MTB\GitHub\mtb-site\scripts"

:: Check for dependencies
pip show pandas >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing required libraries...
    pip install pandas openpyxl
)

:: Run the script
python StandardizeBibles.py

echo -------------------------------------------------------
echo Finished! Check the output folder for your cleaned CSVs.
pause