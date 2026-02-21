# =========================================================
# Mastering the Bible - site Generator (FULL, VERIFIED)
# Modes: BOOK / ABOUT / RESOURCES
# PowerShell: Windows PowerShell 5.1 compatible
# =========================================================

# -----------------------------
# EDIT THESE CONSTANTS (ONCE)
# -----------------------------
# Your website repo root (folder containing index.html, book.html, assets, books, about, resources)
$SITE_ROOT = "C:\Users\Mike\Documents\MTB\GitHub\mtb-site"

# MTB source root (folder containing about, resources, books\old-testament, books\new-testament)
$MTB_SOURCE_ROOT = "C:\Users\Mike\Documents\MTB\mtb-source\source"

$DEFAULT_ABOUT_SRC     = Join-Path $MTB_SOURCE_ROOT "about"
$DEFAULT_RESOURCES_SRC = Join-Path $MTB_SOURCE_ROOT "resources"
$DEFAULT_BOOKS_SRC     = Join-Path $MTB_SOURCE_ROOT "books"

# Pandoc must be on PATH (or set full path to pandoc.exe)
$PANDOC = "pandoc"

# -----------------------------
# HELPERS
# -----------------------------
function Fail($msg) {
  Write-Host ""
  Write-Host "ERROR: $msg" -ForegroundColor Red
  exit 1
}

function Ensure-Path($p) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null }
}

function Prompt-NonEmpty($label, $default) {
  $prompt = $label
  if (-not [string]::IsNullOrWhiteSpace($default)) { $prompt = "$label [$default]" }
  while ($true) {
    $v = Read-Host $prompt
    if ([string]::IsNullOrWhiteSpace($v)) { $v = $default }
    if (-not [string]::IsNullOrWhiteSpace($v)) { return $v.Trim() }
    Write-Host "Please enter a value." -ForegroundColor Yellow
  }
}

function Slugify($s) {
  if ($null -eq $s) { return "" }
  if ($s -is [System.Array]) { $s = ($s -join " ") }

  $t = ([string]$s).Trim().ToLowerInvariant()
  $t = $t -replace "[’‘`´]", "'"
  $t = $t -replace "[\u2013\u2014]", "-"   # en/em dash -> hyphen (no literal dash chars)
  $t = $t -replace "[^a-z0-9\-\s']", ""
  $t = $t -replace "\s+", "-"
  $t = $t -replace "-{2,}", "-"
  $t = $t.Trim("-")
  return $t
}
function Convert-DocxToHtmlFragment($docxPath) {
  if (-not (Test-Path $docxPath)) { throw "DOCX not found: $docxPath" }

  # Lua filter path (expects mtb-custom-styles.lua in the same folder as this script)
  $LUA_FILTER = Join-Path $PSScriptRoot "mtb-custom-styles.lua"
  if (-not (Test-Path $LUA_FILTER)) {
    throw "Lua filter not found: $LUA_FILTER"
  }

  # IMPORTANT:
  # - docx+styles is required for Pandoc to emit the `custom-style` attribute
  # - lua filter converts those custom styles into HTML classes
  $args = @(
    "--from=docx+styles",
    "--to=html",
    "--standalone=false",
    "--wrap=none",
    "--quiet",
    ("--lua-filter=" + $LUA_FILTER),
    $docxPath
  )

  $errFile = [System.IO.Path]::GetTempFileName()
  try {
    $stdout = & $PANDOC @args 2> $errFile
    $exitCode = $LASTEXITCODE
    $stderr = ""
    if (Test-Path $errFile) { $stderr = Get-Content -Path $errFile -Raw }

    if ($exitCode -ne 0) { throw "Pandoc failed ($exitCode):`n$stderr" }

    if ($stdout -is [System.Array]) { return ($stdout -join "`n") }
    return [string]$stdout
  }
  finally {
    if (Test-Path $errFile) { Remove-Item $errFile -Force -ErrorAction SilentlyContinue }
  }
}
function Get-MtbDocType([string]$outName) {
  $n = ""
if ($null -ne $outName) { $n = [string]$outName }
$n = $n.ToLowerInvariant()

  if ($n -match '-chapter-explanation\.html$') { return "chapter-explanation" }
  if ($n -match '-chapter-orientation\.html$') { return "chapter-orientation" }
  if ($n -match '-chapter-insights\.html$') { return "chapter-insights" }
  if ($n -match '-chapter-introduction\.html$') { return "chapter-introduction" }
  if ($n -match '-book-introduction\.html$') { return "book-introduction" }
  if ($n -match '-chapter-eg-culture\.html$') { return "chapter-eg-culture" }

  # keep these as-is (they already have their own structure)
  if ($n -match '-chapter-scripture\.html$') { return "chapter-scripture" }

  return "generic"
}

function Wrap-MtbDocHtml([string]$html, [string]$docType) {
  if ([string]::IsNullOrWhiteSpace($html)) { return $html }

  # do not double-wrap chapter scripture stubs (already wrapped)
  if ($docType -eq "chapter-scripture") { return $html }

  $classes = @("mtb-doc")

  # marker used to scope Read/Explain/Dwell mode toggles
  if ($docType -eq "chapter-explanation") {
    $classes += "mtb-doc--chapter-explanation"
  }

  
# apply Read skin by default to these teaching docs
  if ($docType -in @(
    "book-introduction",
    "chapter-introduction",
    "chapter-orientation",
    "chapter-eg-culture",
    "chapter-insights"
  )) {
  $classes += "mtb-doc--read"
}

  $classAttr = ($classes -join " ")

@"
<section class="$classAttr" data-doc-type="$docType">
$html
</section>
"@
}
function New-MtbChapterScriptureStubHtml {
  param(
    [Parameter(Mandatory)] [string] $BookSlug,
    [Parameter(Mandatory)] [int]    $Chapter
  )

@"
<section class="mtb-doc mtb-chapter-scripture">
  <div class="scripture-controls"></div>

  <div
    class="mtb-scripture-root"
    data-book="$BookSlug"
    data-chapter="$Chapter"
    data-left="nkjv"
    data-right="nlt"
  ></div>
</section>
"@
}

function Write-MtbChapterScriptureStubFile {
  param(
    [Parameter(Mandatory)] [string] $OutDir,
    [Parameter(Mandatory)] [string] $BookSlug,
    [Parameter(Mandatory)] [int]    $Chapter
  )

  $fileName = "{0}-{1}-chapter-scripture.html" -f $BookSlug, $Chapter
  $outFile  = Join-Path $OutDir $fileName

  $html = New-MtbChapterScriptureStubHtml -BookSlug $BookSlug -Chapter $Chapter

  Set-Content -Path $outFile -Value $html -Encoding UTF8
}

# ---------------------------------------------------------
# Mojibake cleanup BEFORE saving HTML (no non-ASCII literals)
# - Fixes ΓÇö / ΓÇô / ΓÇò dashes
# - Fixes NBSP junk (┬á, Â)
# - Strips box-drawing / block-element garbage (╬┤╬¡╧ë etc.)
# ---------------------------------------------------------
function Fix-MojibakeHtml([string]$html) {
  if ([string]::IsNullOrEmpty($html)) { return $html }

  $Gamma = [char]0x0393
  $Cced  = [char]0x00C7
  $Atil  = [char]0x00C2
  $BoxT  = [char]0x252C
  $aAc   = [char]0x00E1
  $u     = "u"

  # Bad sequences (constructed safely)
  $bad_GC_o_grave   = "$Gamma$Cced$([char]0x00F2)"
  $bad_GC_o_circ    = "$Gamma$Cced$([char]0x00F4)"
  $bad_GC_o_umlaut  = "$Gamma$Cced$([char]0x00F6)"
  $bad_GC_u_circ    = "$Gamma$Cced$([char]0x00FB)"
  $bad_u_GC_o_grave   = "$u$bad_GC_o_grave"
  $bad_u_GC_o_circ    = "$u$bad_GC_o_circ"
  $bad_u_GC_o_umlaut  = "$u$bad_GC_o_umlaut"

  # Common smart-quote mojibake sequences (ΓÇÖ etc.)
  $bad_GC_O_umlaut  = "$Gamma$Cced$([char]0x00D6)"  # ΓÇÖ -> ’
  $bad_GC_A3        = "$Gamma$Cced$([char]0x00A3)"  # ΓÇ£ -> “
  $bad_GC_A5        = "$Gamma$Cced$([char]0x00A5)"  # ΓÇ¥ -> ”

  $bad_Box_aAc     = "$BoxT$aAc"   # ┬á
  $bad_Atil_space  = "$Atil "      # Â<space>
  $bad_Atil        = "$Atil"       # Â

  $emdash = [char]0x2014
  $endash = [char]0x2013

  $out = $html

  # Exact replaces
  $out = $out.Replace($bad_u_GC_o_umlaut, $emdash)
  $out = $out.Replace($bad_u_GC_o_circ,   $emdash)
  $out = $out.Replace($bad_u_GC_o_grave,  $emdash)

  $out = $out.Replace($bad_GC_o_umlaut, $emdash)
  $out = $out.Replace($bad_GC_o_circ,   $emdash)
  $out = $out.Replace($bad_GC_o_grave,  $emdash)
  $out = $out.Replace($bad_GC_u_circ,   $endash)

  # Smart quotes / apostrophes
  $out = $out.Replace($bad_GC_O_umlaut, ([string][char]0x2019))  # ’
  $out = $out.Replace($bad_GC_A3,       ([string][char]0x201C))  # “
  $out = $out.Replace($bad_GC_A5,       ([string][char]0x201D))  # ”


  $out = $out.Replace($bad_Box_aAc, " ")
  $out = $out.Replace($bad_Atil_space, " ")
  $out = $out.Replace($bad_Atil, "")

  # Normalize real NBSP and HTML NBSP entity
  $out = $out.Replace([char]0x00A0, " ")
  $out = $out -replace "&nbsp;", " "

  # Regex safety net for ANY remaining ΓÇ + (ò ô ö û)
  $gcPrefix = [regex]::Escape("$Gamma$Cced")
  $out = [regex]::Replace($out, ($gcPrefix + "[\u00F2\u00F4\u00F6]"), ([string]$emdash))
  $out = [regex]::Replace($out, ($gcPrefix + "[\u00FB]"), ([string]$endash))

  # Strip box-drawing + block elements (CP437-style mojibake such as ╬┤╬¡╧ë)
  $out = [regex]::Replace($out, "[\u2500-\u257F\u2580-\u259F]", "")

  # Tidy multiple spaces/tabs
  $out = $out -replace "[ \t]{2,}", " "

  return $out
}
function Remove-PandocDecorations([string]$html) {
  if ([string]::IsNullOrEmpty($html)) { return $html }

  $out = $html

  # 1) Remove the common “top bar” artifact:
  # Pandoc often emits a first <p><img ...></p> for a thin horizontal line/shape.
  # We remove very short images (height in px/in/cm/mm that indicates “rule/line”).
  $out = [regex]::Replace(
    $out,
    '^\s*<p>\s*<img\b[^>]*?(?:style="[^"]*?\bheight:\s*(?:0\.\d+(?:in|cm|mm)|[0-8]px)[^"]*?"|height="(?:[0-8])")?[^>]*>\s*</p>\s*',
    '',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )

  # 2) As a safety net, remove ANY remaining “thin rule” images anywhere in the document.
  $out = [regex]::Replace(
    $out,
    '<p>\s*<img\b[^>]*?(?:style="[^"]*?\bheight:\s*(?:0\.\d+(?:in|cm|mm)|[0-8]px)[^"]*?"|height="(?:[0-8])")[^>]*>\s*</p>\s*',
    '',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )

  return $out
}
function Remove-PandocDecorationsKeepImages([string]$html) {
  if ([string]::IsNullOrEmpty($html)) { return $html }

  $out = $html

  # Remove figure blocks that contain a "thin" image (rule/line/shape)
  # We consider "thin" as height <= 12px OR height <= 0.2in OR <= 0.5cm/mm equivalent.
  $out = [regex]::Replace(
    $out,
    '(?is)<figure\b[^>]*>[\s\S]*?<img\b[^>]*?(?:height\s*=\s*"(?:\d{1,2})"|style\s*=\s*"[^"]*?\bheight\s*:\s*(?:\d{1,2}px|0\.\d+(?:in|cm|mm))[^"]*")[^>]*>[\s\S]*?</figure>\s*',
    ''
  )

  # Remove <p> wrappers that contain a thin image
  $out = [regex]::Replace(
    $out,
    '(?is)<p>\s*<img\b[^>]*?(?:height\s*=\s*"(?:\d{1,2})"|style\s*=\s*"[^"]*?\bheight\s*:\s*(?:\d{1,2}px|0\.\d+(?:in|cm|mm))[^"]*")[^>]*>\s*</p>\s*',
    ''
  )

  # Remove standalone thin <img> tags (just in case)
  $out = [regex]::Replace(
    $out,
    '(?is)<img\b[^>]*?(?:height\s*=\s*"(?:\d{1,2})"|style\s*=\s*"[^"]*?\bheight\s*:\s*(?:\d{1,2}px|0\.\d+(?:in|cm|mm))[^"]*")[^>]*>\s*',
    ''
  )

  return $out
}

# -----------------------------
# FIXED: Resolve testament using Contains (no regex)
# -----------------------------
function Resolve-BookSource($bookSlug, [ref]$testamentOut) {
  $bookSlug = [string](@($bookSlug)[0])

  $candidates = @(
    (Join-Path $DEFAULT_BOOKS_SRC ("new-testament\" + $bookSlug)),
    (Join-Path $DEFAULT_BOOKS_SRC ("old-testament\" + $bookSlug))
  )

  foreach ($c in $candidates) {
    if (Test-Path $c) {
      if ($c.ToLowerInvariant().Contains("\new-testament\")) {
        $testamentOut.Value = "new-testament"
      } else {
        $testamentOut.Value = "old-testament"
      }
      return $c
    }
  }

  $found = Get-ChildItem $DEFAULT_BOOKS_SRC -Directory -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ieq $bookSlug } |
    Select-Object -First 1

  if ($null -ne $found) {
    if ($found.FullName.ToLowerInvariant().Contains("\new-testament\")) {
      $testamentOut.Value = "new-testament"
    } else {
      $testamentOut.Value = "old-testament"
    }
    return $found.FullName
  }

  return $null
}

function Canonicalize-WordStudyNames($outDir, $bookSlug) {
  # Canonical word study filename format:
  #   {bookSlug}-{chapter}-{g|h}{number}.html
  # This intentionally strips the English gloss portion to avoid multi-word / punctuation issues.
  # Applies recursively under the book output directory.
  $rx = [regex]('^(?<book>' + [regex]::Escape($bookSlug) + ')-(?<ch>\d+)-(?<strong>[gh]\d+)(?:-.+)?\.html$')

  Get-ChildItem -Path $outDir -Recurse -File -Filter "*.html" | ForEach-Object {
    $nameLower = $_.Name.ToLowerInvariant()
    if (-not $rx.IsMatch($nameLower)) { return }

    $m = $rx.Match($nameLower)
    $ch = $m.Groups["ch"].Value
    $strong = $m.Groups["strong"].Value

    $letter = $strong.Substring(0,1)
    $digits = $strong.Substring(1)
    $n = [int]$digits

    $canonical = "$bookSlug-$ch-$letter$n.html"
    $destPath = Join-Path $_.Directory.FullName $canonical

    if ($_.FullName -ieq $destPath) { return }

    if (Test-Path $destPath) {
      Write-Host "WARN: canonical exists, keeping '$($_.FullName)' (collision on $canonical)" -ForegroundColor Yellow
      return
    }

    Rename-Item -LiteralPath $_.FullName -NewName $canonical
  }
}
function Group-MtbDwellRuns([string]$html) {
  if ([string]::IsNullOrWhiteSpace($html)) { return $html }

  # First Dwell block
  $rxFirstDwell = [regex]::new('(?is)<(?<tag>p|div)\b[^>]*\bclass\s*=\s*"[^"]*\bMTB-Dwell\b[^"]*"[^>]*>.*?</\k<tag>>')

  # Next piece in a run: either another Dwell block OR a UL/OL that contains MTB-Dwell somewhere inside
  $rxNextPiece = [regex]::new('(?is)^\s*(?:' +
    '<(?<tag1>p|div)\b[^>]*\bclass\s*=\s*"[^"]*\bMTB-Dwell\b[^"]*"[^>]*>.*?</\k<tag1>>' +
    '|' +
    '<(?<tag2>ul|ol)\b[^>]*>.*?\bMTB-Dwell\b.*?</\k<tag2>>' +
    ')')

  $sb = New-Object System.Text.StringBuilder
  $i = 0

  while ($i -lt $html.Length) {
    $m = $rxFirstDwell.Match($html, $i)
    if (-not $m.Success) {
      [void]$sb.Append($html.Substring($i))
      break
    }

    # Append everything before the dwell run
    if ($m.Index -gt $i) {
      [void]$sb.Append($html.Substring($i, $m.Index - $i))
    }

    # Consume dwell run
    $runPos = $m.Index
    $runText = ""

    while ($true) {
      $segment = $html.Substring($runPos)
      $m2 = $rxNextPiece.Match($segment)
      if (-not $m2.Success) { break }

      $runText += $m2.Value
      $runPos += $m2.Value.Length
    }

    # Wrap
    [void]$sb.Append("<div class=""MTB-Dwell-Group"">`n")
    [void]$sb.Append($runText)
    [void]$sb.Append("`n</div>")

    $i = $runPos
  }

  return $sb.ToString()
}
function Clear-BookOutput($bookOutDir) {
  if (-not (Test-Path $bookOutDir)) { return }

  Write-Host ("Cleaning HTML under: " + $bookOutDir) -ForegroundColor Yellow

  $htmlFiles = Get-ChildItem $bookOutDir -Recurse -File -Filter "*.html" -ErrorAction SilentlyContinue
  Write-Host ("Found HTML files to delete: " + $htmlFiles.Count) -ForegroundColor Yellow

  foreach ($f in $htmlFiles) {
    try {
      Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop
    } catch {
      Write-Host ("Could not delete: " + $f.FullName) -ForegroundColor Red
      Write-Host ($_.Exception.Message) -ForegroundColor Red
    }
  }

  # Verify cleanup
  $remaining = Get-ChildItem $bookOutDir -Recurse -File -Filter "*.html" -ErrorAction SilentlyContinue
  Write-Host ("Remaining HTML after cleanup: " + $remaining.Count) -ForegroundColor Yellow
}

function Write-ChapterAvailabilityManifest([string]$SiteRoot) {
  if ([string]::IsNullOrWhiteSpace($SiteRoot)) { return }

  $booksRoot = Join-Path $SiteRoot "books"
  if (-not (Test-Path $booksRoot)) { return }

  $dataDir = Join-Path $SiteRoot "assets\data"
  Ensure-Path $dataDir

  $manifest = @{}  # bookSlug -> HashSet[int]

  $rx = [regex]::new(
  "^(?<book>.+?)-(?<ch>\d+)-chapter-scripture\.html$",
  [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)


  Get-ChildItem $booksRoot -Recurse -Filter "*-chapter-scripture.html" -File -ErrorAction SilentlyContinue | ForEach-Object {
    $name = $_.Name
    $m = $rx.Match($name)
    if ($m.Success) {
      $b = $m.Groups["book"].Value
      $c = [int]$m.Groups["ch"].Value

      if (-not $manifest.ContainsKey($b)) {
        $manifest[$b] = New-Object "System.Collections.Generic.HashSet[int]"
      }
      $null = $manifest[$b].Add($c)
    }
  }

  # Build ordered output object (stable JSON)
  $outObj = [ordered]@{}
  foreach ($k in ($manifest.Keys | Sort-Object)) {
    $outObj[$k] = @($manifest[$k] | Sort-Object)
  }

  $json = $outObj | ConvertTo-Json -Depth 5
  $outPath = Join-Path $dataDir "chapter-availability.json"
  Set-Content -Path $outPath -Value $json -Encoding UTF8 -Force
  Write-Host ("WROTE: assets/data/chapter-availability.json") -ForegroundColor Cyan
}




# -----------------------------
# MAIN
# -----------------------------
Write-Host ""
Write-Host "Mastering the Bible - site Generator"
Write-Host ""

$Mode = Prompt-NonEmpty "Mode (BOOK / ABOUT / RESOURCES)" "BOOK"
$Mode = $Mode.Trim().ToUpperInvariant()

if ($Mode -eq "BOOK") {

  Write-Host ""
  Write-Host "Mode: BOOK"

  $rawBook = Prompt-NonEmpty "Book (example: titus, obadiah)" ""
  $BOOK_SLUG = [string](@(Slugify $rawBook)[0])
  if ([string]::IsNullOrWhiteSpace($BOOK_SLUG)) { Fail "Invalid book name." }

  $testament = ""
  $bookSource = Resolve-BookSource $BOOK_SLUG ([ref]$testament)
  if ($null -eq $bookSource) { Fail "Book source folder not found for '$rawBook' (slug '$BOOK_SLUG'). Expected under: $DEFAULT_BOOKS_SRC" }

$outDir = Join-Path $SITE_ROOT ("books\" + $testament + "\" + $BOOK_SLUG)
  Ensure-Path $outDir

  Clear-BookOutput $outDir

  # Print resolved output dir
  $resolvedOut = (Resolve-Path $outDir).Path
  Write-Host "Source: $bookSource"
  Write-Host "Output: $resolvedOut"
  Write-Host ""

  $docxFiles = Get-ChildItem $bookSource -Filter "*.docx" -Recurse -ErrorAction SilentlyContinue
  if ($null -eq $docxFiles -or $docxFiles.Count -eq 0) { Fail "No DOCX files found under: $bookSource" }

  $debugShown = 0

  foreach ($docx in $docxFiles) {
    try {
      Write-Host ("Processing " + $docx.Name + "...")
      $html = Convert-DocxToHtmlFragment $docx.FullName
      $html = Fix-MojibakeHtml $html

      $base = [System.IO.Path]::GetFileNameWithoutExtension($docx.Name)
      $outName = (Slugify $base) + ".html"
      # Route output based on slugged filename:
      # - <book>-0-*              -> 000-book
      # - <book>-<n>-* (n > 0)    -> <n as 3 digits> (001, 002, ...)
      # - otherwise               -> book root
      $targetSub = ""
      if ($outName -match '^[a-z0-9-]+-0-') {
        $targetSub = "000-book"
      }
      elseif ($outName -match '^[a-z0-9-]+-(\d+)-') {
        $n = [int]$Matches[1]
        if ($n -gt 0) { $targetSub = ("{0:D3}" -f $n) }
      }

      $targetDir = if ($targetSub) { Join-Path $outDir $targetSub } else { $outDir }
      Ensure-Path $targetDir

   $outPath = Join-Path $targetDir $outName

$docType = Get-MtbDocType $outName

# If this is a chapter scripture page, override Pandoc output with the JSON stub
if ($outName -match '^(?<book>[a-z0-9-]+)-(?<ch>\d+)-chapter-scripture\.html$') {
  $b  = $Matches['book']
  $ch = [int]$Matches['ch']
  $html = New-MtbChapterScriptureStubHtml -BookSlug $b -Chapter $ch
  $docType = "chapter-scripture"
}

# Wrap everything else in a consistent MTB doc root
# Group consecutive MTB-Dwell blocks (chapter explanation only)
if ($docType -eq "chapter-explanation") {
  $html = Group-MtbDwellRuns $html
}

# Wrap everything else in a consistent MTB doc root
$html = Wrap-MtbDocHtml $html $docType
Set-Content -Path $outPath -Value $html -Encoding UTF8 -Force

      if ($debugShown -lt 3) {
        Write-Host ("WROTE: " + (Resolve-Path $outPath).Path) -ForegroundColor Cyan
        $debugShown++
      }

      Write-Host ("OK   " + $docx.Name + "  ->  " + $outName) -ForegroundColor Green
    }
    catch {
      Write-Host ("FAIL " + $docx.Name) -ForegroundColor Red
      Write-Host ($_.Exception.Message) -ForegroundColor Red
    }
  }

  Canonicalize-WordStudyNames $outDir $BOOK_SLUG
# ---------------------------------------------------------
# Ensure chapter scripture stub exists for EVERY chapter
# (even if no DOCX was authored for that chapter)
# Source of truth: NKJV JSON chapter list (if present)
# ---------------------------------------------------------
try {
  $nkjvJsonPath = Join-Path $SITE_ROOT ("assets\js\bibles-json\nkjv\" + $BOOK_SLUG + ".json")

  if (Test-Path $nkjvJsonPath) {
    $j = Get-Content -Path $nkjvJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json

    $chapNums = @()
    if ($j -and $j.chapters) {
      $chapNums = $j.chapters.PSObject.Properties.Name | ForEach-Object { [int]$_ } | Sort-Object
    }

    foreach ($ch in $chapNums) {
      $folder = "{0:D3}" -f $ch
      $chDir  = Join-Path $outDir $folder
      Ensure-Path $chDir

      $stubPath = Join-Path $chDir ("{0}-{1}-chapter-scripture.html" -f $BOOK_SLUG, $ch)
      if (-not (Test-Path $stubPath)) {
        Write-MtbChapterScriptureStubFile -OutDir $chDir -BookSlug $BOOK_SLUG -Chapter $ch
        Write-Host ("WROTE STUB: " + (Resolve-Path $stubPath).Path) -ForegroundColor Cyan
      }
    }
  }
  else {
    Write-Host ("WARN: NKJV JSON not found for stub generation: " + $nkjvJsonPath) -ForegroundColor Yellow
  }
}
catch {
  Write-Host "WARN: Failed to auto-generate chapter scripture stubs." -ForegroundColor Yellow
  Write-Host ($_.Exception.Message) -ForegroundColor Yellow
}

  # ----------------------------
  # Build chapter resources index pages
  # Creates: <book>-<ch>-chapter-resources.html
  # Links all: <book>-<ch>-resources-*.html
  # Output location: same chapter folder (e.g., 001)
  # ----------------------------
  try {
    $chapterResourcePages = Get-ChildItem $outDir -Recurse -File -Filter "*-resources-*.html" -ErrorAction SilentlyContinue

    # Group by "<book>-<ch>" extracted from basename "<book>-<ch>-resources-<topic>"
    $groups = $chapterResourcePages | Group-Object {
      if ($_.BaseName -match "^(?<book>[a-z0-9-]+)-(?<ch>\d+)-resources-") {
        "$($Matches.book)-$($Matches.ch)"
      } else {
        ""
      }
    }

    foreach ($g in $groups) {
      if ([string]::IsNullOrWhiteSpace($g.Name)) { continue }

      if ($g.Name -notmatch "^(?<book>[a-z0-9-]+)-(?<ch>\d+)$") { continue }
      $book = $Matches.book
      $ch = [int]$Matches.ch

      $folder = "{0:D3}" -f $ch
      $targetDir = Join-Path $outDir $folder
      Ensure-Path $targetDir

      $indexName = "$book-$ch-chapter-resources.html"
      $indexPath = Join-Path $targetDir $indexName

$links = $g.Group | Sort-Object Name | ForEach-Object {
    $file = $_.Name
    $title = $_.BaseName -replace "^[a-z0-9-]+-\d+-resources-", "" -replace "-", " "
    '  <li><a href="book.html?doc=' + $file + '">' + $title + '</a></li>'
}


      $html = @"
<h2>Chapter Resources</h2>
<ul>
$($links -join "`n")
</ul>
"@

      Set-Content -Path $indexPath -Value $html -Encoding UTF8 -Force
      Write-Host ("WROTE: " + $indexName) -ForegroundColor Cyan
    }
  }
  catch {
    Write-Host "WARN: Failed to build chapter resources indexes." -ForegroundColor Yellow
    Write-Host ($_.Exception.Message) -ForegroundColor Yellow
  }
  # ----------------------------
  # Build BOOK resources landing page
  # Creates: <book>-0-book-resources.html in 000-book
  # Links all: <book>-0-resources-*.html
  # ----------------------------
  try {
    $outBookDir = Join-Path $outDir "000-book"
    Ensure-Path $outBookDir
# =========================================================
# AUTO-GENERATE BOOK-LEVEL RESOURCE INDEX
# =========================================================
function New-BookResourcesIndexHtml {
    param(
        [string]$OutBookDir,
        [string]$TestamentSlug,
        [string]$BookSlug
    )

    $topicFiles = Get-ChildItem -Path $OutBookDir -Filter "$BookSlug-0-resources-*.html" -File |
                  Sort-Object Name

    $indexFile = Join-Path $OutBookDir "$BookSlug-0-book-resources.html"

    $itemsHtml = ""

    if ($topicFiles.Count -gt 0) {
        $li = foreach ($f in $topicFiles) {

            $name = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
            $topic = $name -replace "^$([regex]::Escape($BookSlug))-0-resources-", ""

            $title = ($topic -split "-" | ForEach-Object {
                if ($_ -match '^\d+$') { $_ }
                else { $_.Substring(0,1).ToUpper() + $_.Substring(1) }
            }) -join " "

            $href = "/books/$TestamentSlug/$BookSlug/000-book/$($f.Name)"
            "      <li><a href=""$href"">$title</a></li>"
        }

        $itemsHtml = ($li -join "`r`n")
    }
    else {
        $itemsHtml = "      <li>No book resources found yet.</li>"
    }

    $bookTitle = ($BookSlug -split "-" | ForEach-Object {
        if ($_ -match '^\d+$') { $_ }
        else { $_.Substring(0,1).ToUpper() + $_.Substring(1) }
    }) -join " "
    $html = @"
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Book Resources - $bookTitle</title>
<link rel="stylesheet" href="/assets/css/style.css" />
</head>
<body>
<main class="doc-content">
<h1>Book Resources</h1>
<p>$bookTitle</p>
<ul>
$itemsHtml
</ul>
</main>
</body>
</html>
"@

    Set-Content -Path $indexFile -Value $html -Encoding UTF8
}

    New-BookResourcesIndexHtml -OutBookDir $outBookDir -TestamentSlug $testament -BookSlug $BOOK_SLUG
    Write-Host ("WROTE: " + $BOOK_SLUG + "-0-book-resources.html") -ForegroundColor Cyan
  }
  catch {
    Write-Host "WARN: Failed to build book resources index page." -ForegroundColor Yellow
    Write-Host ($_.Exception.Message) -ForegroundColor Yellow
  }



  
# ----------------------------
# Write chapter availability manifest (for non-sequential rollout)
# assets/data/chapter-availability.json
# ----------------------------
try {
  Write-ChapterAvailabilityManifest -SiteRoot $SITE_ROOT
}
catch {
  Write-Host "WARN: Failed to write chapter availability manifest." -ForegroundColor Yellow
  Write-Host ($_.Exception.Message) -ForegroundColor Yellow
}

$count = (Get-ChildItem $outDir -Filter "*.html" -ErrorAction SilentlyContinue | Measure-Object).Count
  Write-Host ""
  Write-Host ("BOOK generation complete. HTML files in output: " + $count) -ForegroundColor Green
  exit 0
}

if ($Mode -eq "ABOUT") {

  Write-Host ""
  Write-Host "Mode: ABOUT"
  if (-not (Test-Path $DEFAULT_ABOUT_SRC)) { Fail "About source not found: $DEFAULT_ABOUT_SRC" }

  $outDir = Join-Path $SITE_ROOT "about"
  Ensure-Path $outDir

  $docxFiles = Get-ChildItem $DEFAULT_ABOUT_SRC -Filter "*.docx" -ErrorAction SilentlyContinue
  foreach ($docx in $docxFiles) {
    try {
      Write-Host ("Processing " + $docx.Name + "...")
      $html = Convert-DocxToHtmlFragment $docx.FullName
      $html = Fix-MojibakeHtml $html

      $base = [System.IO.Path]::GetFileNameWithoutExtension($docx.Name)
      $slug = Slugify $base
      $outPath = Join-Path $outDir ($slug + ".html")

      Set-Content -Path $outPath -Value $html -Encoding UTF8 -Force
      Write-Host ("OK   " + $docx.Name + "  ->  " + ([System.IO.Path]::GetFileName($outPath))) -ForegroundColor Green
    }
    catch {
      Write-Host ("FAIL " + $docx.Name) -ForegroundColor Red
      Write-Host ($_.Exception.Message) -ForegroundColor Red
    }
  }

  Write-Host ""
  Write-Host "ABOUT generation complete." -ForegroundColor Green
  exit 0
}

if ($Mode -eq "RESOURCES") {

  Write-Host ""
  Write-Host "Mode: RESOURCES"
  if (-not (Test-Path $DEFAULT_RESOURCES_SRC)) { Fail "Resources source not found: $DEFAULT_RESOURCES_SRC" }

  $outDir = Join-Path $SITE_ROOT "resources"
  Ensure-Path $outDir

  $docxFiles = Get-ChildItem $DEFAULT_RESOURCES_SRC -Filter "*.docx" -ErrorAction SilentlyContinue
  foreach ($docx in $docxFiles) {
    try {
      Write-Host ("Processing " + $docx.Name + "...")
      $html = Convert-DocxToHtmlFragment $docx.FullName
      $html = Fix-MojibakeHtml $html

      $base = [System.IO.Path]::GetFileNameWithoutExtension($docx.Name)
      $slug = Slugify $base
      $outPath = Join-Path $outDir ($slug + ".html")

      Set-Content -Path $outPath -Value $html -Encoding UTF8 -Force
      Write-Host ("OK   " + $docx.Name + "  ->  " + ([System.IO.Path]::GetFileName($outPath))) -ForegroundColor Green
    }
    catch {
      Write-Host ("FAIL " + $docx.Name) -ForegroundColor Red
      Write-Host ($_.Exception.Message) -ForegroundColor Red
    }
  }

  Write-Host ""
  Write-Host "RESOURCES generation complete." -ForegroundColor Green
  exit 0
}

Fail "Unknown mode '$Mode'. Use BOOK, ABOUT, or RESOURCES."