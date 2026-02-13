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

  # Intentionally NOT using --extract-media to avoid permission/lock issues.
  $args = @(
    "--from=docx",
    "--to=html",
    "--standalone=false",
    "--wrap=none",
    "--quiet",
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
  $rx = [regex]('^(?<book>' + [regex]::Escape($bookSlug) + ')-(?<ch>\d+)-(?<strong>[gh]\d+)(?:-.+)?\.html$')

  Get-ChildItem -Path $outDir -Filter "*.html" | ForEach-Object {
    $name = $_.Name.ToLowerInvariant()
    if (-not $rx.IsMatch($name)) { return }

    $m = $rx.Match($name)
    $ch = $m.Groups["ch"].Value
    $strong = $m.Groups["strong"].Value

    $letter = $strong.Substring(0,1)
    $digits = $strong.Substring(1)
    $n = [int]$digits

    $canonical = "$bookSlug-$ch-$letter$n.html"
    $destPath = Join-Path $outDir $canonical

    if ($_.FullName -ieq $destPath) { return }

    if (Test-Path $destPath) {
      Write-Host "WARN: canonical exists, keeping '$($_.Name)' (collision on $canonical)" -ForegroundColor Yellow
      return
    }

    Rename-Item -Path $_.FullName -NewName $canonical
  }
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
