@echo off
title MTB Google Drive Backup
echo Starting backup of MTB Word Study files...

:: This runs the PowerShell script and bypasses the execution policy
powershell.exe -ExecutionPolicy Bypass -File "C:\Users\Mike\Documents\MTB\MTB_Backup.ps1"

echo.
echo Backup process finished.
timeout /t 3
exit