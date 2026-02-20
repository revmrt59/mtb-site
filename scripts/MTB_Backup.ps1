# MTB Manual Google Drive Backup
$SourceFolder = "C:\Users\Mike\Documents\MTB\"
$BackupFolder = "C:\Users\Mike\Google Drive\MTB_Backups" 
$Timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"

# Create backup folder if it doesn't exist
if (!(Test-Path $BackupFolder)) { New-Item -ItemType Directory -Path $BackupFolder }

# Copy all .docx files with a timestamp to preserve versions
Get-ChildItem -Path $SourceFolder -Filter "*.docx" | ForEach-Object {
    $NewFileName = $_.BaseName + "_" + $Timestamp + $_.Extension
    Copy-Item -Path $_.FullName -Destination (Join-Path $BackupFolder $NewFileName)
}

Write-Host "Backup to Google Drive Complete!" -ForegroundColor Green
Start-Sleep -Seconds 2