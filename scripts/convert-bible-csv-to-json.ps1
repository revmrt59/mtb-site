<# =========================================================
   MTB Bible CSV -> JSON Converter (Robust + Canon-locked)

   Input:
     C:\Users\Mike\Documents\MTB\mtb-bible-translations\csv_for_json\*.csv
     Example: NKJV_Bible.csv, NLT_Bible.csv, KJV_Bible.csv, AMP_Bible.csv

   Required CSV Columns:
     Book,Chapter,Verse,Text

   Output:
     C:\Users\Mike\Documents\MTB\GitHub\mtb-site\assets\js\bibles-json\<translationKey>\<bookSlug>.json
     plus _manifest.json per translation

   Key behaviors:
   - Assumes Book names are already MTB-standard in CSV.
   - DOES NOT mojibake-clean Book (prevents blanking Genesis, etc.)
   - Mojibake cleaning is applied ONLY to verse Text.
   - Enforces MTB canon (66 books). Skips Apocrypha/extra books (KJV 80 -> 66).
   - Guards against blank bookSlug so ".json" is never written.
   - Writes UTF-8 (no BOM) JSON files.
   ========================================================= #>

[CmdletBinding()]
param(
  [string]$InputDir  = "C:\Users\Mike\Documents\MTB\mtb-bible-translations\csv_for_json",
  [string]$OutDir    = "C:\Users\Mike\Documents\MTB\GitHub\mtb-site\assets\js\bibles-json",
  # e.g. nkjv, nlt, esv, niv, nasb, ylt, tlv, amp, kjv or ALL
  [string]$VersionKey = "ALL",
  [switch]$VerboseStats
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$path) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
  }
}

function Write-Utf8NoBom([string]$path, [string]$text) {
  [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

function Slugify([string]$name) {
  if ([string]::IsNullOrWhiteSpace($name)) { return "" }
  $s = $name.Trim().ToLowerInvariant()
  $s = [regex]::Replace($s, "[^a-z0-9\s]", "")
  $s = [regex]::Replace($s, "\s+", "-")
  return $s
}

function Get-TranslationKeyFromFile([string]$baseName) {
  # NKJV_Bible -> nkjv
  # AMP_Bible  -> amp
  # KJV_Bible  -> kjv
  $bn = $baseName.Trim()
  if ($bn -match "^(?<t>[^_]+)_") {
    return $Matches["t"].ToLowerInvariant()
  }
  $bn = $bn -replace "(?i)Bible$", ""
  $bn = $bn.Trim("_","-"," ")
  return $bn.ToLowerInvariant()
}

function Fix-MojibakeText([string]$input) {
  if ($null -eq $input) { return $input }
  $s = [string]$input

  # Normalize NBSP (U+00A0) -> space
  $s = $s.Replace([char]0x00A0, ' ')

  # If plain ASCII, just normalize whitespace and return
  if ($s -notmatch '[^\x00-\x7F]') {
    return ([regex]::Replace($s, "\s+", " ").Trim())
  }

  # Try to repair common UTF-8 bytes mis-decoded as Windows-1252
  function Try-Recode1252ToUtf8([string]$t) {
    try {
      $enc1252 = [System.Text.Encoding]::GetEncoding(1252)
      $bytes = $enc1252.GetBytes($t)
      $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)

      # If replacement char appears, reject
      if ($fixed -match [char]0xFFFD) { return $t }
      return $fixed
    } catch {
      return $t
    }
  }

  # Once, then again for double-encoded cases
  $s = Try-Recode1252ToUtf8 $s
  $s = Try-Recode1252ToUtf8 $s

  # Remove stray U+00C2 if present
  $s = $s.Replace([string][char]0x00C2, "")

  # Handle html-ish NBSP text
  $s = $s -replace "&nbsp;", " "

  # Collapse whitespace
  $s = [regex]::Replace($s, "\s+", " ").Trim()

  return $s
}

# =========================================================
# MTB Canon (66 books) - enforce for all translations
# This excludes Apocrypha/Deuterocanon automatically (KJV 80 -> 66)
# =========================================================
$CANON = @(
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy",
  "Joshua","Judges","Ruth",
  "1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles",
  "Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Songs",
  "Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel",
  "Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi",
  "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians",
  "1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter",
  "1 John","2 John","3 John","Jude","Revelation"
)

$CANON_SET = @{}
foreach ($b in $CANON) { $CANON_SET[$b] = $true }

# --- Validate folders ---
if (-not (Test-Path $InputDir)) { throw "InputDir not found: $InputDir" }
Ensure-Dir $OutDir

$csvFiles = @(Get-ChildItem -Path $InputDir -Filter "*.csv" | Sort-Object Name)
if ($csvFiles.Count -eq 0) { throw "No CSV files found in: $InputDir" }

# Filter by VersionKey if not ALL
if ($VersionKey -and $VersionKey.ToUpperInvariant() -ne "ALL") {
  $vk = $VersionKey.ToLowerInvariant()
  $csvFiles = @($csvFiles | Where-Object { (Get-TranslationKeyFromFile $_.BaseName) -eq $vk })
  if ($csvFiles.Count -eq 0) {
    $available = (@(Get-ChildItem -Path $InputDir -Filter "*.csv") |
      ForEach-Object { Get-TranslationKeyFromFile $_.BaseName } |
      Sort-Object -Unique) -join ", "
    throw "No CSV matched VersionKey '$vk'. Available: $available"
  }
}

foreach ($file in $csvFiles) {

  $translationKey  = Get-TranslationKeyFromFile $file.BaseName
  $translationName = $translationKey.ToUpperInvariant()

  Write-Host ""
  Write-Host ("=== Converting {0} ({1}) ===" -f $file.Name, $translationKey)

  $rows = @(Import-Csv -Path $file.FullName)
  if ($rows.Count -eq 0) { throw "CSV appears empty: $($file.FullName)" }

  if ($VerboseStats) {
    Write-Host ("Rows detected: {0}" -f $rows.Count)
    Write-Host ("First row book: {0}" -f $rows[0].Book)
    Write-Host ("Last row book:  {0}" -f $rows[$rows.Count-1].Book)
  }

  # Header validation
  $first = $rows[0]
  foreach ($col in @("Book","Chapter","Verse","Text")) {
    if (-not ($first.PSObject.Properties.Name -contains $col)) {
      throw "CSV missing required column '$col' in file: $($file.FullName)"
    }
  }

  # Build: Book -> Chapter -> Verse -> Text
  $byBook = @{}

  $kept = 0
  $skipBook = 0
  $skipChap = 0
  $skipVerse = 0
  $skipNonCanon = 0

  foreach ($r in $rows) {

  # Book: do NOT mojibake-clean. Just normalize NBSP and trim.
  $book = ([string]$r.Book)
  $book = $book.Replace([char]0x00A0,' ').Trim()

  if ([string]::IsNullOrWhiteSpace($book)) { $skipBook++; continue }

  # Enforce MTB canon: skip Apocrypha + any non-canon books
  if (-not $CANON_SET.ContainsKey($book)) { $skipNonCanon++; continue }

  # Chapter/Verse should be numeric
  $chStr = ([string]$r.Chapter).Trim()
  $vsStr = ([string]$r.Verse).Trim()

  $chNum = 0
  $vsNum = 0
  if (-not [int]::TryParse($chStr, [ref]$chNum)) { $skipChap++; continue }
  if (-not [int]::TryParse($vsStr, [ref]$vsNum)) { $skipVerse++; continue }

  $ch = [string]$chNum
  $vs = [string]$vsNum

  # Verse text: normalize NBSP + trim (no mojibake cleaning for now)
  $text = ([string]$r.Text).Replace([char]0x00A0,' ').Trim()


  if (-not $byBook.ContainsKey($book)) { $byBook[$book] = @{} }
  if (-not $byBook[$book].ContainsKey($ch)) { $byBook[$book][$ch] = @{} }

  $byBook[$book][$ch][$vs] = $text
  $kept++
}




  Write-Host ("Books detected: {0}" -f $byBook.Keys.Count)

  if ($VerboseStats) {
    Write-Host ("Kept rows: {0}" -f $kept)
    Write-Host ("Skipped book blank: {0}" -f $skipBook)
    Write-Host ("Skipped chapter parse: {0}" -f $skipChap)
    Write-Host ("Skipped verse parse: {0}" -f $skipVerse)
    Write-Host ("Skipped non-canon: {0}" -f $skipNonCanon)
    Write-Host ("Sample books: {0}" -f (($byBook.Keys | Sort-Object | Select-Object -First 5) -join ", "))
  }

  # Output per translation
  $outTranslationDir = Join-Path $OutDir $translationKey
  Ensure-Dir $outTranslationDir

  $booksOut = @()

  foreach ($bookName in ($byBook.Keys | Sort-Object)) {

    $bookSlug = Slugify $bookName

    # Guard: never write ".json"
    if ([string]::IsNullOrWhiteSpace($bookSlug)) { continue }

    $obj = [ordered]@{
      translationKey = $translationKey
      translation    = $translationName
      book           = $bookName
      bookSlug       = $bookSlug
      chapters       = $byBook[$bookName]
    }

    $json = $obj | ConvertTo-Json -Depth 25 -Compress
    $outFile = Join-Path $outTranslationDir ("{0}.json" -f $bookSlug)
    Write-Utf8NoBom $outFile $json

    $booksOut += [ordered]@{ book = $bookName; bookSlug = $bookSlug }
  }

  # Manifest
  $manifest = [ordered]@{
    translationKey = $translationKey
    translation    = $translationName
    generatedAt    = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    inputFile      = $file.FullName
    outputDir      = $outTranslationDir
    rowCount       = $rows.Count
    keptRowCount   = $kept
    bookCount      = $booksOut.Count
    books          = $booksOut
    skippedNonCanonRows = $skipNonCanon
  }

  $manifestJson = $manifest | ConvertTo-Json -Depth 10 -Compress
  Write-Utf8NoBom (Join-Path $outTranslationDir "_manifest.json") $manifestJson

  Write-Host ("Wrote {0} books to {1}" -f $booksOut.Count, $outTranslationDir)
}

Write-Host ""
Write-Host "Done."
