# =========================================================
# Mastering the Bible - Beta Site Generator
# Foundational Version for Navigation and Manifesting
# =========================================================

# -----------------------------
# DYNAMIC PATHS & CONFIG
# -----------------------------
$BETA_MODE = $true 
$REPO_ROOT = Split-Path $PSScriptRoot -Parent
$MTB_SOURCE_ROOT = Join-Path $REPO_ROOT "..\..\mtb-source\source"

if ($BETA_MODE) {
    $SITE_ROOT = Join-Path $REPO_ROOT "..\beta-build"
    Write-Host ">>> BETA MODE: Targeting $SITE_ROOT" -ForegroundColor Cyan
} else {
    $SITE_ROOT = $REPO_ROOT
}

$DEFAULT_BOOKS_SRC = Join-Path $MTB_SOURCE_ROOT "books"
$PANDOC = "pandoc"
$MANIFEST_PATH = Join-Path $SITE_ROOT "manifest.json"
$Global:ManifestData = @()

# -----------------------------
# HELPERS
# -----------------------------
function Ensure-Path($p) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null }
}

function Slugify($s) {
  if ($null -eq $s) { return "" }
  $t = ([string]$s).Trim().ToLowerInvariant()
  $t = $t -replace "[’‘`´]", "'"
  $t = $t -replace "[\u2013\u2014]", "-"
  $t = $t -replace "[^a-z0-9\-\s']", ""
  $t = $t -replace "\s+", "-"
  $t = $t -replace "-{2,}", "-"
  return $t.Trim("-")
}

# -----------------------------
# FOUNDATION: MANIFEST LOGIC
# -----------------------------
function Add-To-Manifest($title, $slug, $category, $relativeUrl) {
    $entry = [PSCustomObject]@{
        Title    = $title
        Slug     = $slug
        Category = $category
        Url      = $relativeUrl
        Date     = (Get-Date).ToString("yyyy-MM-dd")
    }
    $Global:ManifestData += $entry
}

function Save-Manifest() {
    $Global:ManifestData | ConvertTo-Json -Depth 4 | Set-Content -Path $MANIFEST_PATH -Encoding UTF8
    Write-Host "Manifest saved to $MANIFEST_PATH" -ForegroundColor Green
}

# -----------------------------
# CORE CONVERSION (Your Verified Logic)
# -----------------------------
function Convert-DocxToHtmlFragment($docxPath) {
  $args = @("--from=docx", "--to=html", "--standalone=false", "--wrap=none", "--quiet", $docxPath)
  $stdout = & $PANDOC @args
  if ($stdout -is [System.Array]) { return ($stdout -join "`n") }
  return [string]$stdout
}

# -----------------------------
# MAIN: BOOK MODE
# -----------------------------
Write-Host "MTB Foundation Generator"
$rawBook = Read-Host "Enter Book (e.g., titus)"
$BOOK_SLUG = Slugify $rawBook

# Find Testament
$testament = ""
$bookSource = Join-Path $DEFAULT_BOOKS_SRC "new-testament\$BOOK_SLUG"
if (Test-Path $bookSource) { $testament = "new-testament" }
else { 
    $bookSource = Join-Path $DEFAULT_BOOKS_SRC "old-testament\$BOOK_SLUG"
    $testament = "old-testament"
}

$outDir = Join-Path $SITE_ROOT ("books\" + $testament + "\" + $BOOK_SLUG)
Ensure-Path $outDir

$docxFiles = Get-ChildItem $bookSource -Filter "*.docx" -Recurse

foreach ($docx in $docxFiles) {
    Write-Host "Processing $($docx.Name)..."
    $html = Convert-DocxToHtmlFragment $docx.FullName
    
    # Use your slugging logic
    $base = [System.IO.Path]::GetFileNameWithoutExtension($docx.Name)
    $outName = (Slugify $base) + ".html"
    
    # Determine Subfolder (000-book, 001, etc.)
    $targetSub = ""
    if ($outName -match '^[a-z0-9-]+-0-') { $targetSub = "000-book" }
    elseif ($outName -match '^[a-z0-9-]+-(\d+)-') {
        $n = [int]$Matches[1]
        if ($n -gt 0) { $targetSub = ("{0:D3}" -f $n) }
    }

    $targetDir = if ($targetSub) { Join-Path $outDir $targetSub } else { $outDir }
    Ensure-Path $targetDir
    $outPath = Join-Path $targetDir $outName

    # Save HTML
    Set-Content -Path $outPath -Value $html -Encoding UTF8 -Force

    # Add to Manifest for future navigation
    $webPath = "books/$testament/$BOOK_SLUG/" + (if ($targetSub) { "$targetSub/$outName" } else { $outName })
    Add-To-Manifest -title $base -slug $outName -category "book-$BOOK_SLUG" -relativeUrl $webPath
}

Save-Manifest
Write-Host "Beta build complete." -ForegroundColor Green