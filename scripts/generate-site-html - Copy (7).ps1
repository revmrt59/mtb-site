# =========================================================
# Mastering the Bible - site Generator (FULL, VERIFIED)
# Modes: BOOK / ABOUT / RESOURCES
# PowerShell: Windows PowerShell 5.1 compatible
# =========================================================

# -----------------------------
# EDIT THESE CONSTANTS (ONCE)
# -----------------------------
param(
  [string]$Mode = ""
)

# If Mode wasn't passed in, ask interactively (keeps your current behavior)
if ([string]::IsNullOrWhiteSpace($Mode)) {
  $Mode = Read-Host "Mode (BOOK / ABOUT / RESOURCES / SECTIONS) [BOOK]"
  if ([string]::IsNullOrWhiteSpace($Mode)) { $Mode = "BOOK" }
}
$Mode = $Mode.Trim().ToUpperInvariant()
# Your website repo root (folder containing index.html, book.html, assets, books, about, resources)
$SITE_ROOT = "C:\Users\Mike\Documents\MTB\GitHub\mtb-site"

# MTB source root (folder containing about, resources, books\old-testament, books\new-testament)
$MTB_SOURCE_ROOT = "C:\Users\Mike\Documents\MTB\mtb-source\source"

$DEFAULT_ABOUT_SRC     = Join-Path $MTB_SOURCE_ROOT "about"
$DEFAULT_RESOURCES_SRC = Join-Path $MTB_SOURCE_ROOT "resources"
$DEFAULT_BOOKS_SRC     = Join-Path $MTB_SOURCE_ROOT "books"

# --------------------------------------------------
# Canonical Section Mapping (Scalable)
# --------------------------------------------------

$BOOK_TO_SECTION = @{
  # Law
  "genesis"="law"; "exodus"="law"; "leviticus"="law"; "numbers"="law"; "deuteronomy"="law"

  # History
  "joshua"="history"; "judges"="history"; "ruth"="history"
  "1-samuel"="history"; "2-samuel"="history"
  "1-kings"="history"; "2-kings"="history"
  "1-chronicles"="history"; "2-chronicles"="history"
  "ezra"="history"; "nehemiah"="history"; "esther"="history"

  # Wisdom
  "job"="wisdom"; "psalms"="wisdom"; "proverbs"="wisdom"
  "ecclesiastes"="wisdom"; "song-of-solomon"="wisdom"

  # Major Prophets
  "isaiah"="major-prophets"; "jeremiah"="major-prophets"
  "lamentations"="major-prophets"; "ezekiel"="major-prophets"; "daniel"="major-prophets"

  # Minor Prophets
  "hosea"="minor-prophets"; "joel"="minor-prophets"; "amos"="minor-prophets"
  "obadiah"="minor-prophets"; "jonah"="minor-prophets"; "micah"="minor-prophets"
  "nahum"="minor-prophets"; "habakkuk"="minor-prophets"; "zephaniah"="minor-prophets"
  "haggai"="minor-prophets"; "zechariah"="minor-prophets"; "malachi"="minor-prophets"

  # Gospels
  "matthew"="gospels"; "mark"="gospels"; "luke"="gospels"; "john"="gospels"

  # Acts
  "acts"="acts"

  # Pauline Epistles
  "romans"="pauline-epistles"; "1-corinthians"="pauline-epistles"
  "2-corinthians"="pauline-epistles"; "galatians"="pauline-epistles"
  "ephesians"="pauline-epistles"; "philippians"="pauline-epistles"
  "colossians"="pauline-epistles"; "1-thessalonians"="pauline-epistles"
  "2-thessalonians"="pauline-epistles"

  # Pastoral Epistles
  "1-timothy"="pastoral-epistles"; "2-timothy"="pastoral-epistles"
  "titus"="pastoral-epistles"; "philemon"="pastoral-epistles"

  # General Epistles
  "hebrews"="general-epistles"; "james"="general-epistles"
  "1-peter"="general-epistles"; "2-peter"="general-epistles"
  "1-john"="general-epistles"; "2-john"="general-epistles"
  "3-john"="general-epistles"; "jude"="general-epistles"

  # Revelation
  "revelation"="revelation"
}

# Pandoc must be on PATH (or set full path to pandoc.exe)
$PANDOC = "pandoc"

# -----------------------------
# HELPERS
# -----------------------------
function Enrich-MtbReadStrongSpans([string]$html, [string]$bookSlug) {
  if ([string]::IsNullOrWhiteSpace($html)) { return $html }

   # Only process <div class="MTB-Read"><p> ... </p></div> blocks
  $rx = [regex]::new('(?is)(?<open><div\s+class="MTB-Read">\s*<p>)(?<p>.*?)(?<close></p>\s*</div>)')

  return $rx.Replace($html, {
    param($m)

    $open  = $m.Groups["open"].Value
    $phtml = $m.Groups["p"].Value
    $close = $m.Groups["close"].Value

    $newP = Enrich-MtbReadStrongTokens $phtml $bookSlug

    return $open + $newP + $close
  })
}

function Enrich-MtbReadStrongTokens([string]$pInnerHtml, [string]$bookSlug) {
  if ([string]::IsNullOrWhiteSpace($pInnerHtml)) { return $pInnerHtml }

  $BR = "__MTB_BR__"
  $work = [regex]::Replace($pInnerHtml, '(?is)<br\s*/?>', $BR)

  # Pattern A: "2:3-5 (NKJV)" — NKJV immediately after reference
$hdr = [regex]::Match(
  $work,
  '(?is)\b(?<ch>\d+):(?<v1>\d+)(?:-(?<v2>\d+))?\s*\(NKJV\)'
)

$nkAtEnd = $false

# Pattern B: "2:1 ... (NKJV)" — NKJV appears at the end
if (-not $hdr.Success) {

  $hdr = [regex]::Match(
    $work,
    '(?is)\b(?<ch>\d+):(?<v1>\d+)(?:-(?<v2>\d+))?\b'
  )

  if ($hdr.Success -and ($work -match '(?is)\(NKJV\)\s*$')) {
    $nkAtEnd = $true
  }
}

if (-not $hdr.Success) {
  return ($work -replace [regex]::Escape($BR), '<br />')
}

  $ch = [int]$hdr.Groups["ch"].Value
  $v1 = [int]$hdr.Groups["v1"].Value
  $v2 = if ($hdr.Groups["v2"].Success) { [int]$hdr.Groups["v2"].Value } else { $v1 }

  $splitPos = $hdr.Index + $hdr.Length
  $prefix = $work.Substring(0, $splitPos)
  $rest   = $work.Substring($splitPos)

$rest = [regex]::Replace($rest, "^(?:\s|$BR|&nbsp;|\u201C|`"|')+", ' ')

  $currentV = $v1

  $scan = [regex]::new('(?is)\((?<L>[GH])\s*(?<N>\d+)\)|\b(?<VM>\d{1,3})\b')

  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append($prefix)

  $idx = 0
  foreach ($m in $scan.Matches($rest)) {

    if ($m.Index -gt $idx) {
      [void]$sb.Append($rest.Substring($idx, $m.Index - $idx))
    }

    if ($m.Groups["VM"].Success -and -not $m.Groups["L"].Success) {
      $vm = [int]$m.Groups["VM"].Value
      if ($vm -ge $v1 -and $vm -le $v2) { $currentV = $vm }
      [void]$sb.Append($m.Value)
      $idx = $m.Index + $m.Length
      continue
    }

    if ($m.Groups["L"].Success -and $m.Groups["N"].Success) {
      $L = $m.Groups["L"].Value.ToLowerInvariant()
      $N = $m.Groups["N"].Value
      $strong = "$L$N"
      $token = $m.Value

      $wsDoc = "$bookSlug-$ch-$currentV-$strong.html"

      $span = "<span class=""ws"" data-ws-doc=""$wsDoc"" data-book=""$bookSlug"" data-ch=""$ch"" data-v=""$currentV"" data-strong=""$strong"">$token</span>"
      [void]$sb.Append($span)

      $idx = $m.Index + $m.Length
      continue
    }

    [void]$sb.Append($m.Value)
    $idx = $m.Index + $m.Length
  }

  if ($idx -lt $rest.Length) {
    [void]$sb.Append($rest.Substring($idx))
  }

  $out = $sb.ToString()
  $out = $out -replace [regex]::Escape($BR), '<br />'
  return $out
}

function Enrich-OneMtbReadParagraph([string]$phtml, [string]$bookSlug) {
  if ([string]::IsNullOrWhiteSpace($phtml)) { return $phtml }

  # Keep <br> tags intact while we scan text
  $BR = "__MTB_BR__"
  $work = [regex]::Replace($phtml, '(?is)<br\s*/?>', $BR)

  # Parse header like: "Titus 2:1" or "Titus 2:3-5"
  $hdr = [regex]::Match($work, '^\s*(?<book>.+?)\s+(?<ch>\d+):(?<v1>\d+)(?:-(?<v2>\d+))?', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if (-not $hdr.Success) {
    # No recognizable reference at start; restore <br> and exit
    return ($work -replace [regex]::Escape($BR), '<br />')
  }

  $ch = [int]$hdr.Groups["ch"].Value
  $v1 = [int]$hdr.Groups["v1"].Value
  $v2 = if ($hdr.Groups["v2"].Success) { [int]$hdr.Groups["v2"].Value } else { $v1 }
  $currentV = $v1

  # Scan for either verse markers (standalone numbers) or Strong tokens "(G####)/(H####)"
  $scan = [regex]::new('(?is)\((?<L>[GH])\s*(?<N>\d+)\)|\b(?<VM>\d{1,3})\b')
  $sb = New-Object System.Text.StringBuilder
  $idx = 0

  foreach ($m in $scan.Matches($work)) {
    # append text before match
    if ($m.Index -gt $idx) {
      [void]$sb.Append($work.Substring($idx, $m.Index - $idx))
    }

    # verse marker?
    if ($m.Groups["VM"].Success -and -not $m.Groups["L"].Success) {
      $vm = [int]$m.Groups["VM"].Value
      if ($vm -ge $v1 -and $vm -le $v2) { $currentV = $vm }
      [void]$sb.Append($m.Value)
      $idx = $m.Index + $m.Length
      continue
    }

    # Strong token
    if ($m.Groups["L"].Success -and $m.Groups["N"].Success) {
      $L = $m.Groups["L"].Value.ToLowerInvariant()     # g or h
      $N = $m.Groups["N"].Value                        # digits
      $strong = "$L$N"
      $token = $m.Value                                # "(G1319)"

      $span = "<span class=""ws"" data-book=""$bookSlug"" data-ch=""$ch"" data-v=""$currentV"" data-strong=""$strong"">$token</span>"
      [void]$sb.Append($span)
      $idx = $m.Index + $m.Length
      continue
    }

    # fallback
    [void]$sb.Append($m.Value)
    $idx = $m.Index + $m.Length
  }

  # append remainder
  if ($idx -lt $work.Length) {
    [void]$sb.Append($work.Substring($idx))
  }

  $out = $sb.ToString()
  # restore <br>
  $out = $out -replace [regex]::Escape($BR), '<br />'
  return $out
}
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

  $LUA_FILTER = Join-Path $PSScriptRoot "mtb-custom-styles.lua"
  if (-not (Test-Path $LUA_FILTER)) {
    throw "Lua filter not found: $LUA_FILTER"
  }

  $outFile = [System.IO.Path]::ChangeExtension([System.IO.Path]::GetTempFileName(), ".html")
  $errFile = [System.IO.Path]::GetTempFileName()

  $args = @(
    "--from=docx+styles",
    "--to=html",
    "--standalone=false",
    "--wrap=none",
    "--quiet",
    ("--lua-filter=" + $LUA_FILTER),
    ("--output=" + $outFile),
    $docxPath
  )

  try {
    & $PANDOC @args 2> $errFile
    $exitCode = $LASTEXITCODE
    $stderr = ""
    if (Test-Path $errFile) { $stderr = Get-Content -Path $errFile -Raw }

    if ($exitCode -ne 0) { throw "Pandoc failed ($exitCode):`n$stderr" }

    # Read Pandoc output as UTF-8 (this is the critical part)
    return Get-Content -Path $outFile -Raw -Encoding UTF8
  }
  finally {
    if (Test-Path $outFile) { Remove-Item $outFile -Force -ErrorAction SilentlyContinue }
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


# --------------------------------------------------
# Excel Book Introduction -> HTML
# --------------------------------------------------
function ConvertTo-HtmlEncoded([string]$text) {
  if ($null -eq $text) { return "" }
  return [System.Net.WebUtility]::HtmlEncode([string]$text)
}

function Convert-MtbIntroCellToHtml([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return "" }

  $normalized = ([string]$text) -replace "`r`n", "`n" -replace "`r", "`n"
  $blocks = [regex]::Split($normalized.Trim(), "`n\s*`n")
  $sb = New-Object System.Text.StringBuilder

  foreach ($block in $blocks) {
    $b = $block.Trim()
    if ([string]::IsNullOrWhiteSpace($b)) { continue }

    # Bullet block: one workbook bullet per line.
    $lines = $b -split "`n"
    $nonEmpty = @($lines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $bulletLines = @($nonEmpty | Where-Object { $_.Trim() -match '^[•\-]\s*' })

    if ($nonEmpty.Count -gt 0 -and $bulletLines.Count -eq $nonEmpty.Count) {
      [void]$sb.Append('<ul>')
      foreach ($line in $nonEmpty) {
        $item = $line.Trim() -replace '^[•\-]\s*', ''
        [void]$sb.Append('<li>' + (ConvertTo-HtmlEncoded $item) + '</li>')
      }
      [void]$sb.Append('</ul>')
      continue
    }

    if ($b -match '^(?is)Pastoral Insight:\s*(?<body>.*)$') {
      $body = ConvertTo-HtmlEncoded $Matches['body']
      $body = $body -replace "`n", '<br />'
      [void]$sb.Append('<div class="mtb-book-intro-insight"><strong>Pastoral Insight:</strong> ' + $body + '</div>')
      continue
    }

    $encoded = ConvertTo-HtmlEncoded $b
    $encoded = $encoded -replace "`n", '<br />'
    [void]$sb.Append('<p>' + $encoded + '</p>')
  }

  return $sb.ToString()
}

function Get-ExcelWorksheetValues {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $WorksheetName
  )

  if (-not (Test-Path $WorkbookPath)) { throw "Workbook not found: $WorkbookPath" }

  $excel = $null
  $workbook = $null
  $worksheet = $null
  $usedRange = $null

  try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    $workbook = $excel.Workbooks.Open($WorkbookPath, 0, $true)
    $worksheet = $workbook.Worksheets.Item($WorksheetName)
    $usedRange = $worksheet.UsedRange

    $rows = [int]$usedRange.Rows.Count
    $cols = [int]$usedRange.Columns.Count
    $values = @()

    for ($r = 1; $r -le $rows; $r++) {
      $row = @()
      for ($c = 1; $c -le $cols; $c++) {
        $v = $usedRange.Cells.Item($r, $c).Text
        $row += [string]$v
      }
      $values += ,$row
    }

    return ,$values
  }
  finally {
    if ($null -ne $workbook) { $workbook.Close($false) | Out-Null }
    if ($null -ne $excel) { $excel.Quit() }

    foreach ($obj in @($usedRange, $worksheet, $workbook, $excel)) {
      if ($null -ne $obj) {
        try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($obj) } catch {}
      }
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
  }
}

function Get-MtbIntroCardClass([string]$sectionClass, [string]$header) {
  $key = if ($null -eq $header) { '' } else { $header.Trim().ToLowerInvariant() }

  if ($sectionClass -eq 'background') {
    switch ($key) {
      'book'               { return 'mtb-span-3 mtb-card-book' }
      'author'             { return 'mtb-span-5 mtb-card-author' }
      'audience'           { return 'mtb-span-4 mtb-card-audience' }
      'date'               { return 'mtb-span-3 mtb-card-date' }
      'historical setting' { return 'mtb-span-6 mtb-card-historical-setting' }
      'occasion'           { return 'mtb-span-3 mtb-card-occasion' }
      default              { return 'mtb-span-4' }
    }
  }

  if ($sectionClass -eq 'message') {
    switch ($key) {
      'purpose'             { return 'mtb-span-5 mtb-card-purpose' }
      'theme(s)'            { return 'mtb-span-7 mtb-card-themes' }
      'themes'              { return 'mtb-span-7 mtb-card-themes' }
      'big idea'            { return 'mtb-span-7 mtb-card-big-idea' }
      'key verse(s)'        { return 'mtb-span-5 mtb-card-key-verses' }
      'key verses'          { return 'mtb-span-5 mtb-card-key-verses' }
      'outline'             { return 'mtb-span-7 mtb-card-outline' }
      'christ in this book' { return 'mtb-span-5 mtb-card-christ' }
      default               { return 'mtb-span-4' }
    }
  }

  return 'mtb-span-4'
}

function New-MtbBookIntroductionHtmlFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $BookSlug
  )

  $data = Get-ExcelWorksheetValues -WorkbookPath $WorkbookPath -WorksheetName 'Book Introduction'
  if ($data.Count -lt 9) { throw "The 'Book Introduction' worksheet does not contain the expected two-table layout." }

  # Canonical workbook layout:
  # Row 1: Book Introduction | Book name
  # Row 3: Background
  # Row 4: Background headers
  # Row 5: Background content
  # Row 7: Message
  # Row 8: Message headers
  # Row 9: Message content
  $pageTitle = if (-not [string]::IsNullOrWhiteSpace($data[0][0])) { [string]$data[0][0] } else { 'Book Introduction' }
  $bookTitle = if (-not [string]::IsNullOrWhiteSpace($data[0][1])) { [string]$data[0][1] } else { $BookSlug }

  $sections = @(
    @{ Title = $data[2][0]; Headers = $data[3]; Values = $data[4]; Class = 'background' },
    @{ Title = $data[6][0]; Headers = $data[7]; Values = $data[8]; Class = 'message' }
  )

  $sb = New-Object System.Text.StringBuilder

  # Scoped styles: workbook structure becomes a responsive web dashboard,
  # while the existing modal and all other generated documents remain unchanged.
  [void]$sb.Append(@'
<style>
.mtb-book-introduction-dashboard {
  --mtb-navy: #173a5e;
  --mtb-navy-2: #274f76;
  --mtb-gold: #b7832f;
  --mtb-gold-soft: #fbf4e7;
  --mtb-blue-soft: #eef4f9;
  --mtb-border: #d7e0e8;
  --mtb-text: #1d2935;
  --mtb-muted: #5f6f7d;
  width: 100%;
  max-width: 1380px;
  margin: 0 auto;
  padding: 2px 4px 28px;
  color: var(--mtb-text);
  font-family: Arial, Helvetica, sans-serif;
}
.mtb-book-introduction-dashboard * { box-sizing: border-box; }
.mtb-book-introduction-dashboard .mtb-intro-hero {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  margin: 0 0 24px;
  padding: 24px 28px;
  border: 1px solid #cbd8e3;
  border-radius: 14px;
  background: linear-gradient(135deg, #f7fafc 0%, #e8f0f7 100%);
}
.mtb-book-introduction-dashboard .mtb-intro-hero::after {
  content: '';
  position: absolute;
  right: -48px;
  top: -72px;
  width: 210px;
  height: 210px;
  border-radius: 50%;
  background: rgba(183, 131, 47, .10);
}
.mtb-book-introduction-dashboard .mtb-intro-eyebrow {
  margin: 0 0 5px;
  color: var(--mtb-gold);
  font-size: .78rem;
  font-weight: 800;
  letter-spacing: .13em;
  text-transform: uppercase;
}
.mtb-book-introduction-dashboard .mtb-intro-title {
  margin: 0;
  color: var(--mtb-navy);
  font-size: clamp(1.65rem, 3vw, 2.45rem);
  line-height: 1.08;
}
.mtb-book-introduction-dashboard .mtb-intro-book-badge {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  padding: 10px 17px;
  border: 1px solid rgba(23, 58, 94, .18);
  border-radius: 999px;
  background: #fff;
  color: var(--mtb-navy);
  font-size: 1rem;
  font-weight: 800;
  box-shadow: 0 4px 14px rgba(24, 48, 72, .08);
}
.mtb-book-introduction-dashboard .mtb-intro-section {
  margin: 0 0 27px;
}
.mtb-book-introduction-dashboard .mtb-intro-section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 13px;
}
.mtb-book-introduction-dashboard .mtb-intro-section-heading h2 {
  margin: 0;
  color: var(--mtb-navy);
  font-size: 1.18rem;
  letter-spacing: .055em;
  text-transform: uppercase;
}
.mtb-book-introduction-dashboard .mtb-intro-section-heading::after {
  content: '';
  height: 1px;
  flex: 1 1 auto;
  background: linear-gradient(to right, #c7d3de, transparent);
}
.mtb-book-introduction-dashboard .mtb-intro-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 15px;
}
.mtb-book-introduction-dashboard .mtb-intro-card {
  grid-column: span 4;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--mtb-border);
  border-top: 4px solid var(--mtb-navy-2);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 15px rgba(28, 48, 66, .055);
}
.mtb-book-introduction-dashboard .mtb-intro-card-header {
  margin: 0;
  padding: 12px 16px 10px;
  border-bottom: 1px solid #e5ebf0;
  background: var(--mtb-blue-soft);
  color: var(--mtb-navy);
  font-size: .92rem;
  font-weight: 800;
  letter-spacing: .025em;
}
.mtb-book-introduction-dashboard .mtb-intro-card-body {
  padding: 15px 17px 17px;
  font-size: 1rem;
  line-height: 1.48;
  overflow-wrap: anywhere;
}
.mtb-book-introduction-dashboard .mtb-intro-card-body p {
  margin: 0 0 .86em;
}
.mtb-book-introduction-dashboard .mtb-intro-card-body p:last-child { margin-bottom: 0; }
.mtb-book-introduction-dashboard .mtb-intro-card-body ul {
  margin: 0;
  padding-left: 1.24em;
}
.mtb-book-introduction-dashboard .mtb-intro-card-body li {
  margin: 0 0 .48em;
  padding-left: .1em;
}
.mtb-book-introduction-dashboard .mtb-intro-card-body li:last-child { margin-bottom: 0; }
.mtb-book-introduction-dashboard .mtb-book-intro-insight {
  margin: 14px 0 0;
  padding: 11px 13px;
  border-left: 4px solid var(--mtb-gold);
  border-radius: 0 8px 8px 0;
  background: var(--mtb-gold-soft);
  color: #45371f;
}
.mtb-book-introduction-dashboard .mtb-book-intro-insight strong {
  color: #79531b;
}
.mtb-book-introduction-dashboard .mtb-card-big-idea {
  border-top-color: var(--mtb-gold);
  background: linear-gradient(180deg, #fffdf8 0%, #fff 100%);
}
.mtb-book-introduction-dashboard .mtb-card-big-idea .mtb-intro-card-header {
  background: var(--mtb-gold-soft);
  color: #6f4b16;
}
.mtb-book-introduction-dashboard .mtb-card-christ {
  border-top-color: #8a5d25;
  background: linear-gradient(180deg, #fffaf0 0%, #fff 100%);
}
.mtb-book-introduction-dashboard .mtb-card-christ .mtb-intro-card-header {
  background: #f7ecd7;
  color: #684517;
}
.mtb-book-introduction-dashboard .mtb-card-key-verses .mtb-intro-card-body p {
  padding-left: 12px;
  border-left: 3px solid #b9cce0;
}
.mtb-book-introduction-dashboard .mtb-span-3 { grid-column: span 3; }
.mtb-book-introduction-dashboard .mtb-span-4 { grid-column: span 4; }
.mtb-book-introduction-dashboard .mtb-span-5 { grid-column: span 5; }
.mtb-book-introduction-dashboard .mtb-span-6 { grid-column: span 6; }
.mtb-book-introduction-dashboard .mtb-span-7 { grid-column: span 7; }
.mtb-book-introduction-dashboard .mtb-span-8 { grid-column: span 8; }
.mtb-book-introduction-dashboard .mtb-span-12 { grid-column: span 12; }
@media (max-width: 1050px) {
  .mtb-book-introduction-dashboard .mtb-intro-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mtb-book-introduction-dashboard .mtb-intro-card,
  .mtb-book-introduction-dashboard [class*='mtb-span-'] { grid-column: span 1; }
  .mtb-book-introduction-dashboard .mtb-card-historical-setting,
  .mtb-book-introduction-dashboard .mtb-card-big-idea,
  .mtb-book-introduction-dashboard .mtb-card-outline,
  .mtb-book-introduction-dashboard .mtb-card-christ { grid-column: 1 / -1; }
}
@media (max-width: 660px) {
  .mtb-book-introduction-dashboard { padding-left: 0; padding-right: 0; }
  .mtb-book-introduction-dashboard .mtb-intro-hero {
    align-items: flex-start;
    flex-direction: column;
    padding: 20px;
    border-radius: 10px;
  }
  .mtb-book-introduction-dashboard .mtb-intro-grid { grid-template-columns: 1fr; gap: 12px; }
  .mtb-book-introduction-dashboard .mtb-intro-card,
  .mtb-book-introduction-dashboard [class*='mtb-span-'] { grid-column: 1 / -1; }
  .mtb-book-introduction-dashboard .mtb-intro-card-body { padding: 14px 15px 16px; }
}
</style>
'@)

  [void]$sb.Append('<div class="mtb-book-introduction-dashboard">')
  [void]$sb.Append('<header class="mtb-intro-hero">')
  [void]$sb.Append('<div><p class="mtb-intro-eyebrow">Mastering the Bible</p>')
  [void]$sb.Append('<h1 class="mtb-intro-title">' + (ConvertTo-HtmlEncoded $pageTitle) + '</h1></div>')
  [void]$sb.Append('<div class="mtb-intro-book-badge">' + (ConvertTo-HtmlEncoded $bookTitle) + '</div>')
  [void]$sb.Append('</header>')

  foreach ($section in $sections) {
    $sectionTitle = [string]$section.Title
    if ([string]::IsNullOrWhiteSpace($sectionTitle)) { continue }

    $validColumns = @()
    for ($i = 0; $i -lt $section.Headers.Count; $i++) {
      if (-not [string]::IsNullOrWhiteSpace([string]$section.Headers[$i])) {
        $validColumns += $i
      }
    }
    if ($validColumns.Count -eq 0) { continue }

    [void]$sb.Append('<section class="mtb-intro-section mtb-intro-section-' + $section.Class + '">')
    [void]$sb.Append('<div class="mtb-intro-section-heading"><h2>' + (ConvertTo-HtmlEncoded $sectionTitle) + '</h2></div>')
    [void]$sb.Append('<div class="mtb-intro-grid">')

    foreach ($i in $validColumns) {
      $header = [string]$section.Headers[$i]
      $value = if ($i -lt $section.Values.Count) { [string]$section.Values[$i] } else { '' }
      $cardClass = Get-MtbIntroCardClass -sectionClass ([string]$section.Class) -header $header

      [void]$sb.Append('<article class="mtb-intro-card ' + $cardClass + '">')
      [void]$sb.Append('<h3 class="mtb-intro-card-header">' + (ConvertTo-HtmlEncoded $header) + '</h3>')
      [void]$sb.Append('<div class="mtb-intro-card-body">' + (Convert-MtbIntroCellToHtml $value) + '</div>')
      [void]$sb.Append('</article>')
    }

    [void]$sb.Append('</div></section>')
  }

  [void]$sb.Append('</div>')
  return $sb.ToString()
}

function Write-MtbBookIntroductionFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $OutBookDir,
    [Parameter(Mandatory)] [string] $BookSlug
  )

  $bookDir = Join-Path $OutBookDir '000-book'
  Ensure-Path $bookDir

  $outName = "$BookSlug-0-book-introduction.html"
  $outPath = Join-Path $bookDir $outName

  $html = New-MtbBookIntroductionHtmlFromExcel -WorkbookPath $WorkbookPath -BookSlug $BookSlug
  $html = Wrap-MtbDocHtml $html 'book-introduction'
  [System.IO.File]::WriteAllText($outPath, $html, [System.Text.UTF8Encoding]::new($false))

  Write-Host ("OK   " + (Split-Path $WorkbookPath -Leaf) + " [Book Introduction] -> " + $outName) -ForegroundColor Green
  return $outPath
}


# --------------------------------------------------
# Excel Chapter Overview -> HTML
# --------------------------------------------------
function Get-ExcelWorksheetNames {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath
  )

  if (-not (Test-Path $WorkbookPath)) { throw "Workbook not found: $WorkbookPath" }

  $excel = $null
  $workbook = $null
  try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $workbook = $excel.Workbooks.Open($WorkbookPath, 0, $true)

    $names = @()
    foreach ($sheet in $workbook.Worksheets) {
      $names += [string]$sheet.Name
      try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($sheet) } catch {}
    }
    return ,$names
  }
  finally {
    if ($null -ne $workbook) { $workbook.Close($false) | Out-Null }
    if ($null -ne $excel) { $excel.Quit() }
    foreach ($obj in @($workbook, $excel)) {
      if ($null -ne $obj) {
        try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($obj) } catch {}
      }
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
  }
}

function Convert-MtbOverviewCellToHtml([string]$text, [string]$header) {
  if ([string]::IsNullOrWhiteSpace($text)) { return '' }

  $normalized = ([string]$text) -replace "`r`n", "`n" -replace "`r", "`n"
  $trimmed = $normalized.Trim()

  # Key Words & Concepts: turn "Term: definition" lines into a readable glossary.
  if ($header.Trim().ToLowerInvariant() -eq 'key words & concepts') {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('<dl class="mtb-overview-glossary">')
    foreach ($line in ($trimmed -split "`n")) {
      $item = $line.Trim()
      if ([string]::IsNullOrWhiteSpace($item)) { continue }
      if ($item -match '^(?<term>[^:]+):\s*(?<definition>.*)$') {
        [void]$sb.Append('<div class="mtb-overview-glossary-item"><dt>' + (ConvertTo-HtmlEncoded $Matches['term'].Trim()) + '</dt><dd>' + (ConvertTo-HtmlEncoded $Matches['definition'].Trim()) + '</dd></div>')
      }
      else {
        [void]$sb.Append('<div class="mtb-overview-glossary-item"><dd>' + (ConvertTo-HtmlEncoded $item) + '</dd></div>')
      }
    }
    [void]$sb.Append('</dl>')
    return $sb.ToString()
  }

  # Purpose & Importance: preserve the two workbook labels as visual sub-sections.
  if ($header.Trim().ToLowerInvariant() -eq 'purpose & importance') {
    $blocks = [regex]::Split($trimmed, "`n\s*`n")
    $sb = New-Object System.Text.StringBuilder
    foreach ($block in $blocks) {
      $b = $block.Trim()
      if ([string]::IsNullOrWhiteSpace($b)) { continue }
      if ($b -match '^(?is)(?<label>Purpose|Why It Matters):\s*(?<body>.*)$') {
        [void]$sb.Append('<div class="mtb-overview-labeled-block"><strong>' + (ConvertTo-HtmlEncoded $Matches['label']) + '</strong><p>' + ((ConvertTo-HtmlEncoded $Matches['body'].Trim()) -replace "`n", '<br />') + '</p></div>')
      }
      else {
        [void]$sb.Append('<p>' + ((ConvertTo-HtmlEncoded $b) -replace "`n", '<br />') + '</p>')
      }
    }
    return $sb.ToString()
  }

  # All-bullet cells become proper lists.
  $lines = @($trimmed -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $bulletLines = @($lines | Where-Object { $_.Trim() -match '^[•\-]\s*' })
  if ($lines.Count -gt 0 -and $bulletLines.Count -eq $lines.Count) {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('<ul>')
    foreach ($line in $lines) {
      $item = $line.Trim() -replace '^[•\-]\s*', ''
      [void]$sb.Append('<li>' + (ConvertTo-HtmlEncoded $item) + '</li>')
    }
    [void]$sb.Append('</ul>')
    return $sb.ToString()
  }

  $blocks = [regex]::Split($trimmed, "`n\s*`n")
  $sb = New-Object System.Text.StringBuilder
  foreach ($block in $blocks) {
    $b = $block.Trim()
    if ([string]::IsNullOrWhiteSpace($b)) { continue }
    [void]$sb.Append('<p>' + ((ConvertTo-HtmlEncoded $b) -replace "`n", '<br />') + '</p>')
  }
  return $sb.ToString()
}

function Get-MtbOverviewCardClass([string]$header) {
  $key = if ($null -eq $header) { '' } else { $header.Trim().ToLowerInvariant() }
  switch ($key) {
    'chapter theme'          { return 'mtb-overview-card-theme' }
    'purpose & importance'   { return 'mtb-overview-card-purpose' }
    'chapter flow'           { return 'mtb-overview-card-flow' }
    'chapter summary'        { return 'mtb-overview-card-summary' }
    'key truths taught'      { return 'mtb-overview-card-truths' }
    'pastoral insights'      { return 'mtb-overview-card-pastoral' }
    'key words & concepts'   { return 'mtb-overview-card-words' }
    'christ in this chapter' { return 'mtb-overview-card-christ' }
    default                  { return '' }
  }
}

function New-MtbChapterOverviewHtmlFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $BookSlug,
    [Parameter(Mandatory)] [int] $Chapter,
    [Parameter(Mandatory)] [string] $WorksheetName
  )

  $data = Get-ExcelWorksheetValues -WorkbookPath $WorkbookPath -WorksheetName $WorksheetName
  if ($data.Count -lt 7) { throw "The '$WorksheetName' worksheet does not contain the expected chapter overview layout." }

  # Canonical layout:
  # Row 1: sheet type | display title
  # Row 3: first four headers
  # Row 4: first four values
  # Row 6: second four headers
  # Row 7: second four values
  $displayTitle = if (-not [string]::IsNullOrWhiteSpace([string]$data[0][1])) { [string]$data[0][1] } else { ((Get-Culture).TextInfo.ToTitleCase($BookSlug)) + " Chapter $Chapter" }
  $groups = @(
    @{ Label = 'Chapter at a Glance'; Headers = $data[2]; Values = $data[3]; Class = 'primary' },
    @{ Label = 'Study Foundations'; Headers = $data[5]; Values = $data[6]; Class = 'secondary' }
  )

  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append(@'
<style>
.mtb-chapter-overview-dashboard {
  --mtb-navy: #173a5e;
  --mtb-navy-2: #2b587f;
  --mtb-gold: #b7832f;
  --mtb-gold-soft: #fbf4e7;
  --mtb-blue-soft: #eef4f9;
  --mtb-border: #d7e0e8;
  --mtb-text: #1d2935;
  width: 100%; max-width: 1380px; margin: 0 auto; padding: 2px 4px 30px;
  color: var(--mtb-text); font-family: Arial, Helvetica, sans-serif;
}
.mtb-chapter-overview-dashboard * { box-sizing: border-box; }
.mtb-chapter-overview-dashboard .mtb-overview-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  margin: 0 0 24px; padding: 22px 26px; border: 1px solid #cbd8e3; border-radius: 14px;
  background: linear-gradient(135deg, #f7fafc 0%, #e8f0f7 100%);
}
.mtb-chapter-overview-dashboard .mtb-overview-eyebrow {
  margin: 0 0 5px; color: var(--mtb-gold); font-size: .78rem; font-weight: 800;
  letter-spacing: .13em; text-transform: uppercase;
}
.mtb-chapter-overview-dashboard .mtb-overview-title {
  margin: 0; color: var(--mtb-navy); font-size: clamp(1.55rem, 3vw, 2.25rem); line-height: 1.1;
}
.mtb-chapter-overview-dashboard .mtb-overview-badge {
  flex: 0 0 auto; padding: 10px 16px; border: 1px solid rgba(23,58,94,.18); border-radius: 999px;
  background: #fff; color: var(--mtb-navy); font-weight: 800; box-shadow: 0 4px 14px rgba(24,48,72,.08);
}
.mtb-chapter-overview-dashboard .mtb-overview-section { margin: 0 0 27px; }
.mtb-chapter-overview-dashboard .mtb-overview-section-heading {
  display: flex; align-items: center; gap: 12px; margin: 0 0 13px;
}
.mtb-chapter-overview-dashboard .mtb-overview-section-heading h2 {
  margin: 0; color: var(--mtb-navy); font-size: 1.08rem; letter-spacing: .055em; text-transform: uppercase;
}
.mtb-chapter-overview-dashboard .mtb-overview-section-heading::after {
  content: ''; height: 1px; flex: 1 1 auto; background: linear-gradient(to right,#c7d3de,transparent);
}
.mtb-chapter-overview-dashboard .mtb-overview-grid {
  display: grid; grid-template-columns: repeat(12,minmax(0,1fr)); gap: 15px;
}
.mtb-chapter-overview-dashboard .mtb-overview-card {
  grid-column: span 6; min-width: 0; overflow: hidden; border: 1px solid var(--mtb-border);
  border-top: 4px solid var(--mtb-navy-2); border-radius: 12px; background: #fff;
  box-shadow: 0 4px 15px rgba(28,48,66,.055);
}
.mtb-chapter-overview-dashboard .mtb-overview-card-header {
  margin: 0; padding: 12px 16px 10px; border-bottom: 1px solid #e5ebf0;
  background: var(--mtb-blue-soft); color: var(--mtb-navy); font-size: .94rem; font-weight: 800;
}
.mtb-chapter-overview-dashboard .mtb-overview-card-body {
  padding: 16px 18px 18px; font-size: 1rem; line-height: 1.5; overflow-wrap: anywhere;
}
.mtb-chapter-overview-dashboard .mtb-overview-card-body p { margin: 0 0 .9em; }
.mtb-chapter-overview-dashboard .mtb-overview-card-body p:last-child { margin-bottom: 0; }
.mtb-chapter-overview-dashboard .mtb-overview-card-body ul { margin: 0; padding-left: 1.25em; }
.mtb-chapter-overview-dashboard .mtb-overview-card-body li { margin: 0 0 .5em; }
.mtb-chapter-overview-dashboard .mtb-overview-card-body li:last-child { margin-bottom: 0; }
.mtb-chapter-overview-dashboard .mtb-overview-card-theme,
.mtb-chapter-overview-dashboard .mtb-overview-card-summary,
.mtb-chapter-overview-dashboard .mtb-overview-card-christ { grid-column: span 6; }
.mtb-chapter-overview-dashboard .mtb-overview-card-theme {
  border-top-color: var(--mtb-gold); background: linear-gradient(180deg,#fffdf8 0%,#fff 100%);
}
.mtb-chapter-overview-dashboard .mtb-overview-card-theme .mtb-overview-card-header {
  background: var(--mtb-gold-soft); color: #6f4b16;
}
.mtb-chapter-overview-dashboard .mtb-overview-card-christ {
  border-top-color: #8a5d25; background: linear-gradient(180deg,#fffaf0 0%,#fff 100%);
}
.mtb-chapter-overview-dashboard .mtb-overview-card-christ .mtb-overview-card-header {
  background: #f7ecd7; color: #684517;
}
.mtb-chapter-overview-dashboard .mtb-overview-labeled-block {
  margin: 0 0 12px; padding: 12px 13px; border-left: 4px solid #89a7c2; border-radius: 0 8px 8px 0; background: #f7fafc;
}
.mtb-chapter-overview-dashboard .mtb-overview-labeled-block:last-child { margin-bottom: 0; }
.mtb-chapter-overview-dashboard .mtb-overview-labeled-block strong { display: block; margin-bottom: 4px; color: var(--mtb-navy); }
.mtb-chapter-overview-dashboard .mtb-overview-labeled-block p { margin: 0; }
.mtb-chapter-overview-dashboard .mtb-overview-glossary { margin: 0; }
.mtb-chapter-overview-dashboard .mtb-overview-glossary-item { padding: 0 0 11px; margin: 0 0 11px; border-bottom: 1px solid #e5ebf0; }
.mtb-chapter-overview-dashboard .mtb-overview-glossary-item:last-child { padding-bottom: 0; margin-bottom: 0; border-bottom: 0; }
.mtb-chapter-overview-dashboard .mtb-overview-glossary dt { color: var(--mtb-navy); font-weight: 800; }
.mtb-chapter-overview-dashboard .mtb-overview-glossary dd { margin: 3px 0 0; }
@media (max-width: 900px) {
  .mtb-chapter-overview-dashboard .mtb-overview-grid { grid-template-columns: 1fr; }
  .mtb-chapter-overview-dashboard .mtb-overview-card,
  .mtb-chapter-overview-dashboard [class*='mtb-overview-card-'] { grid-column: 1 / -1; }
}
@media (max-width: 660px) {
  .mtb-chapter-overview-dashboard { padding-left: 0; padding-right: 0; }
  .mtb-chapter-overview-dashboard .mtb-overview-hero { align-items: flex-start; flex-direction: column; padding: 19px; border-radius: 10px; }
  .mtb-chapter-overview-dashboard .mtb-overview-card-body { padding: 14px 15px 16px; }
}
</style>
'@)

  [void]$sb.Append('<div class="mtb-chapter-overview-dashboard">')
  [void]$sb.Append('<header class="mtb-overview-hero"><div>')
  [void]$sb.Append('<p class="mtb-overview-eyebrow">Chapter Overview</p>')
  [void]$sb.Append('<h1 class="mtb-overview-title">' + (ConvertTo-HtmlEncoded $displayTitle) + '</h1>')
  [void]$sb.Append('</div><div class="mtb-overview-badge">Chapter ' + $Chapter + '</div></header>')

  foreach ($group in $groups) {
    [void]$sb.Append('<section class="mtb-overview-section mtb-overview-section-' + $group.Class + '">')
    [void]$sb.Append('<div class="mtb-overview-section-heading"><h2>' + (ConvertTo-HtmlEncoded ([string]$group.Label)) + '</h2></div>')
    [void]$sb.Append('<div class="mtb-overview-grid">')
    for ($i = 0; $i -lt $group.Headers.Count; $i++) {
      $header = [string]$group.Headers[$i]
      if ([string]::IsNullOrWhiteSpace($header)) { continue }
      $value = if ($i -lt $group.Values.Count) { [string]$group.Values[$i] } else { '' }
      $cardClass = Get-MtbOverviewCardClass $header
      [void]$sb.Append('<article class="mtb-overview-card ' + $cardClass + '">')
      [void]$sb.Append('<h3 class="mtb-overview-card-header">' + (ConvertTo-HtmlEncoded $header) + '</h3>')
      [void]$sb.Append('<div class="mtb-overview-card-body">' + (Convert-MtbOverviewCellToHtml $value $header) + '</div>')
      [void]$sb.Append('</article>')
    }
    [void]$sb.Append('</div></section>')
  }

  [void]$sb.Append('</div>')
  return $sb.ToString()
}

function Write-MtbChapterOverviewFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $OutBookDir,
    [Parameter(Mandatory)] [string] $BookSlug,
    [Parameter(Mandatory)] [int] $Chapter,
    [Parameter(Mandatory)] [string] $WorksheetName
  )

  $chapterDir = Join-Path $OutBookDir ("{0:D3}" -f $Chapter)
  Ensure-Path $chapterDir

  # Keep the established filename because chapter.html and related JavaScript may already reference it.
  # Only the visible button/heading changes from Orientation to Overview.
  $outName = "$BookSlug-$Chapter-chapter-orientation.html"
  $outPath = Join-Path $chapterDir $outName

  $html = New-MtbChapterOverviewHtmlFromExcel -WorkbookPath $WorkbookPath -BookSlug $BookSlug -Chapter $Chapter -WorksheetName $WorksheetName
  $html = Wrap-MtbDocHtml $html 'chapter-orientation'
  [System.IO.File]::WriteAllText($outPath, $html, [System.Text.UTF8Encoding]::new($false))

  Write-Host ("OK   " + (Split-Path $WorkbookPath -Leaf) + " [$WorksheetName] -> " + $outName) -ForegroundColor Green
  return $outPath
}

function Write-AllMtbChapterOverviewsFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $OutBookDir,
    [Parameter(Mandatory)] [string] $BookSlug
  )

  $writtenNames = New-Object 'System.Collections.Generic.List[string]'
  $sheetNames = Get-ExcelWorksheetNames -WorkbookPath $WorkbookPath
  foreach ($sheetName in $sheetNames) {
    if ($sheetName -match '^Overview\s+Chapter\s+(?<chapter>\d+)$') {
      $chapter = [int]$Matches['chapter']
      $path = Write-MtbChapterOverviewFromExcel -WorkbookPath $WorkbookPath -OutBookDir $OutBookDir -BookSlug $BookSlug -Chapter $chapter -WorksheetName $sheetName
      $writtenNames.Add((Split-Path $path -Leaf))
    }
  }
  return ,$writtenNames.ToArray()
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
  #   {bookSlug}-{chapter}-{verse}-{g|h}{number}.html
  # Strips the English gloss portion to avoid multi-word / punctuation issues.
  $rx = [regex]('^(?<book>' + [regex]::Escape($bookSlug) + ')-(?<ch>\d+)-(?<v>\d+)-(?<strong>[gh]\d+)(?:-.+)?\.html$')

  Get-ChildItem -Path $outDir -Recurse -File -Filter "*.html" | ForEach-Object {
    $nameLower = $_.Name.ToLowerInvariant()
    if (-not $rx.IsMatch($nameLower)) { return }

    $m = $rx.Match($nameLower)
    $ch = $m.Groups["ch"].Value
    $v  = $m.Groups["v"].Value
    $strong = $m.Groups["strong"].Value

    $letter = $strong.Substring(0,1)
    $digits = $strong.Substring(1)
    $n = [int]$digits
    $v = $m.Groups["v"].Value
    $canonical = "$bookSlug-$ch-$v-$letter$n.html"
    $destPath = Join-Path $_.Directory.FullName $canonical

    if ($_.FullName -ieq $destPath) { return }

    if (Test-Path $destPath) {
      Write-Host "WARN: canonical exists, keeping '$($_.FullName)' (collision on $canonical)" -ForegroundColor Yellow
      return
    }

    Rename-Item -LiteralPath $_.FullName -NewName $canonical
  }
}

function Enrich-WordStudyHtml([string]$html) {
  if ([string]::IsNullOrWhiteSpace($html)) { return $html }

  # Prevent double wrapping
  if ($html -match "id=['""]ws-summary-text['""]" -or $html -match "id=['""]ws-full-body['""]") {
    return $html
  }

  # We rely on stable anchors produced by Pandoc: h2#summary and h2#full-study
  $pattern = '(?is)(?<before>.*?<h2\b[^>]*\bid=["'']summary["''][^>]*>.*?</h2>)(?<summary>.*?)(?<fullh><h2\b[^>]*\bid=["'']full-study["''][^>]*>.*?</h2>)(?<full>.*)$'

  if ($html -match $pattern) {
    $before  = $Matches['before']
    $summary = $Matches['summary']
    $fullh   = $Matches['fullh']
    $full    = $Matches['full']

    return ($before +
      "<div id='ws-summary-text'>" + $summary + "</div>" +
      $fullh +
      "<div id='ws-full-body'>" + $full + "</div>"
    )
  }

  # If anchors aren't found, do nothing (avoid corrupting pages)
  return $html
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
# Excel Chapter Study -> responsive web study
# -----------------------------
function Get-MtbStudyHeaderParts([string]$header) {
  $normalized = if ($null -eq $header) { '' } else { ([string]$header) -replace "`r`n", "`n" -replace "`r", "`n" }
  $lines = @($normalized -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $title = if ($lines.Count -gt 0) { $lines[0] } else { '' }
  $prompt = if ($lines.Count -gt 1) { ($lines[1..($lines.Count - 1)] -join ' ') } else { '' }
  return @{ Title = $title; Prompt = $prompt }
}

function Convert-MtbStudyCellToHtml([string]$text, [string]$header, [switch]$EmphasizeLabels) {
  if ([string]::IsNullOrWhiteSpace($text)) { return '<p class="mtb-study-empty">No content added yet.</p>' }

  $normalized = ([string]$text) -replace "`r`n", "`n" -replace "`r", "`n"
  $trimmed = $normalized.Trim()
  $lines = @($trimmed -split "`n")
  $nonEmpty = @($lines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $bulletLines = @($nonEmpty | Where-Object { $_.Trim() -match '^[•\-]\s*' })

  if ($nonEmpty.Count -gt 0 -and $bulletLines.Count -eq $nonEmpty.Count) {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('<ul class="mtb-study-list">')
    foreach ($line in $nonEmpty) {
      $item = ($line.Trim() -replace '^[•\-]\s*', '').Trim()
      if ($EmphasizeLabels -and $item -match '^(?<label>[^:]{2,70}):\s*(?<body>.*)$') {
        [void]$sb.Append('<li><strong>' + (ConvertTo-HtmlEncoded $Matches['label'].Trim()) + ':</strong> ' + (ConvertTo-HtmlEncoded $Matches['body'].Trim()) + '</li>')
      }
      else {
        [void]$sb.Append('<li>' + (ConvertTo-HtmlEncoded $item) + '</li>')
      }
    }
    [void]$sb.Append('</ul>')
    return $sb.ToString()
  }

  # Observation rows commonly use one quoted phrase followed by a dash and explanation.
  if ($header -match '(?i)Observation') {
    $items = @($nonEmpty | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($items.Count -gt 0) {
      $sb = New-Object System.Text.StringBuilder
      [void]$sb.Append('<div class="mtb-study-observations">')
      foreach ($line in $items) {
        $item = $line.Trim()
        if ($item -match '^(?<phrase>[“"].+?[”"]|[^\-–—:]{2,90})\s*[\-–—:]\s*(?<body>.+)$') {
          [void]$sb.Append('<div class="mtb-study-observation"><strong>' + (ConvertTo-HtmlEncoded $Matches['phrase'].Trim()) + '</strong><span>' + (ConvertTo-HtmlEncoded $Matches['body'].Trim()) + '</span></div>')
        }
        else {
          [void]$sb.Append('<div class="mtb-study-observation"><span>' + (ConvertTo-HtmlEncoded $item) + '</span></div>')
        }
      }
      [void]$sb.Append('</div>')
      return $sb.ToString()
    }
  }

  $blocks = [regex]::Split($trimmed, "`n\s*`n")
  $sb = New-Object System.Text.StringBuilder
  foreach ($block in $blocks) {
    $b = $block.Trim()
    if ([string]::IsNullOrWhiteSpace($b)) { continue }
    if ($EmphasizeLabels -and $b -match '^(?s)(?<label>[^:`n]{2,70}):\s*(?<body>.*)$') {
      [void]$sb.Append('<p><strong>' + (ConvertTo-HtmlEncoded $Matches['label'].Trim()) + ':</strong> ' + ((ConvertTo-HtmlEncoded $Matches['body'].Trim()) -replace "`n", '<br />') + '</p>')
    }
    else {
      [void]$sb.Append('<p>' + ((ConvertTo-HtmlEncoded $b) -replace "`n", '<br />') + '</p>')
    }
  }
  return $sb.ToString()
}

function ConvertTo-MtbFileSlug([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return '' }

  $slug = $text.Trim().ToLowerInvariant()
  $slug = $slug -replace "[’']", ""
  $slug = $slug -replace '[^a-z0-9]+', '-'
  $slug = $slug.Trim('-')
  return $slug
}

function Convert-MtbStrongMarkedTextToHtml {
  param(
    [Parameter(Mandatory)] [string] $Text,
    [Parameter(Mandatory)] [string] $BookSlug,
    [Parameter(Mandatory)] [int] $Chapter,
    [Parameter(Mandatory)] [int] $Verse
  )

  if ([string]::IsNullOrWhiteSpace($Text)) { return '' }

  # A Strong's marker belongs to the immediately preceding word:
  #   Edom (h123) -> <span class="ws" ...>Edom</span>
  # The marker is removed from visible text.
  $rx = [regex]::new("(?i)(?<word>[\p{L}\p{N}’'-]+)\s*\((?<letter>[GH])\s*(?<number>\d{1,5})\)")
  $matches = $rx.Matches($Text)
  if ($matches.Count -eq 0) {
    return ((ConvertTo-HtmlEncoded $Text) -replace "`n", '<br />')
  }

  $sb = New-Object System.Text.StringBuilder
  $position = 0

  foreach ($match in $matches) {
    if ($match.Index -gt $position) {
      $plain = $Text.Substring($position, $match.Index - $position)
      [void]$sb.Append((ConvertTo-HtmlEncoded $plain))
    }

    $word = $match.Groups['word'].Value
    $letterUpper = $match.Groups['letter'].Value.ToUpperInvariant()
    $letterLower = $letterUpper.ToLowerInvariant()
    $number = ([int]$match.Groups['number'].Value).ToString()
    $strongUpper = $letterUpper + $number
    $strongLower = $letterLower + $number
    $wordSlug = ConvertTo-MtbFileSlug $word

    if ([string]::IsNullOrWhiteSpace($wordSlug)) {
      [void]$sb.Append((ConvertTo-HtmlEncoded $word))
    }
    else {
      $wsDoc = "$BookSlug-$Chapter-$Verse-$strongLower.html"
      [void]$sb.Append('<span class="ws" data-ws="' + (ConvertTo-HtmlEncoded $strongUpper) + '" data-ws-doc="' + (ConvertTo-HtmlEncoded $wsDoc) + '">' + (ConvertTo-HtmlEncoded $word) + '</span>')
    }

    $position = $match.Index + $match.Length
  }

  if ($position -lt $Text.Length) {
    [void]$sb.Append((ConvertTo-HtmlEncoded $Text.Substring($position)))
  }

  return ($sb.ToString() -replace "`n", '<br />')
}

function Convert-MtbStudyScriptureToHtml {
  param(
    [Parameter(Mandatory)] [string] $Text,
    [Parameter(Mandatory)] [string] $BookSlug,
    [Parameter(Mandatory)] [int] $Chapter,
    [Parameter(Mandatory)] [int] $Verse
  )

  if ([string]::IsNullOrWhiteSpace($Text)) { return '' }
  $normalized = ([string]$Text) -replace "`r`n", "`n" -replace "`r", "`n"
  $blocks = [regex]::Split($normalized.Trim(), "`n\s*`n")
  $sb = New-Object System.Text.StringBuilder

  foreach ($block in $blocks) {
    $b = $block.Trim()
    if ([string]::IsNullOrWhiteSpace($b)) { continue }

    $translation = ''
    if ($b -match '\((NKJV|NLT|ESV|NASB|CSB|KJV)\)\s*$') { $translation = $Matches[1] }

    [void]$sb.Append('<blockquote class="mtb-study-scripture-block">')
    if (-not [string]::IsNullOrWhiteSpace($translation)) {
      [void]$sb.Append('<span class="mtb-study-translation">' + (ConvertTo-HtmlEncoded $translation) + '</span>')
    }

    $enriched = Convert-MtbStrongMarkedTextToHtml -Text $b -BookSlug $BookSlug -Chapter $Chapter -Verse $Verse
    [void]$sb.Append('<p>' + $enriched + '</p></blockquote>')
  }

  return $sb.ToString()
}

function Get-MtbStudyVerseReference([string]$scripture, [string]$fallbackBook, [int]$chapter) {
  if ($scripture -match '^\s*(?<ref>[1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d+:\d+)') { return $Matches['ref'].Trim() }
  return ((Get-Culture).TextInfo.ToTitleCase($fallbackBook)) + " $chapter"
}

function New-MtbChapterStudyHtmlFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $BookSlug,
    [Parameter(Mandatory)] [int] $Chapter,
    [Parameter(Mandatory)] [string] $WorksheetName
  )

  $data = Get-ExcelWorksheetValues -WorkbookPath $WorkbookPath -WorksheetName $WorksheetName
  if ($data.Count -lt 10) { throw "The '$WorksheetName' worksheet does not contain the expected chapter study layout." }

  $bookDisplay = if (-not [string]::IsNullOrWhiteSpace([string]$data[0][0])) { [string]$data[0][0] } else { (Get-Culture).TextInfo.ToTitleCase($BookSlug) }
  $sections = New-Object 'System.Collections.Generic.List[object]'
  $i = 2
  while ($i -lt $data.Count) {
    $marker = ([string]$data[$i][0]).Trim()
    if ($marker -notmatch '^(?i)Overview$') { $i++; continue }

    $passage = ([string]$data[$i][1]).Trim()
    if ($i + 4 -ge $data.Count) { break }
    $overviewHeaders1 = $data[$i + 1]
    $overviewValues1 = $data[$i + 2]
    $overviewHeaders2 = $data[$i + 3]
    $overviewValues2 = $data[$i + 4]
    $i += 5

    $verseHeaders = @()
    $verseRows = New-Object 'System.Collections.Generic.List[object]'
    if ($i -lt $data.Count -and ([string]$data[$i][0]).Trim() -match '^(?i)VERSE-BY-VERSE$') {
      if ([string]::IsNullOrWhiteSpace($passage)) { $passage = ([string]$data[$i][1]).Trim() }
      $i++
      if ($i -lt $data.Count) { $verseHeaders = $data[$i]; $i++ }
      while ($i -lt $data.Count) {
        $nextMarker = ([string]$data[$i][0]).Trim()
        if ($nextMarker -match '^(?i)WRAP-UP$' -or $nextMarker -match '^(?i)Overview$') { break }
        if (-not [string]::IsNullOrWhiteSpace([string]$data[$i][0])) { $verseRows.Add($data[$i]) }
        $i++
      }
    }

    $wrapHeaders = @()
    $wrapValues = @()
    if ($i -lt $data.Count -and ([string]$data[$i][0]).Trim() -match '^(?i)WRAP-UP$') {
      $i++
      if ($i -lt $data.Count) { $wrapHeaders = $data[$i]; $i++ }
      if ($i -lt $data.Count) { $wrapValues = $data[$i]; $i++ }
    }

    $sections.Add([pscustomobject]@{
      Passage = $passage
      OverviewHeaders1 = $overviewHeaders1
      OverviewValues1 = $overviewValues1
      OverviewHeaders2 = $overviewHeaders2
      OverviewValues2 = $overviewValues2
      VerseHeaders = $verseHeaders
      VerseRows = $verseRows.ToArray()
      WrapHeaders = $wrapHeaders
      WrapValues = $wrapValues
    })
  }

  if ($sections.Count -eq 0) { throw "No section blocks were found in '$WorksheetName'." }

  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append(@'
<style>
.mtb-chapter-study{--navy:#173a5e;--blue:#2f6eae;--blue-soft:#eef4f9;--gold:#b7832f;--gold-soft:#fbf4e7;--ink:#1f2b37;--muted:#5c6873;--line:#d8e1e8;width:100%;max-width:none;margin:0 auto;padding:2px 4px 36px;font-family:Arial,Helvetica,sans-serif;color:var(--ink)}
.mtb-chapter-study *{box-sizing:border-box}.mtb-study-hero{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 26px;margin:0 0 24px;border:1px solid #cbd8e3;border-radius:14px;background:linear-gradient(135deg,#f8fafc,#e8f0f7)}
.mtb-study-eyebrow{margin:0 0 5px;color:var(--gold);font-size:.78rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.mtb-study-title{margin:0;color:var(--navy);font-size:clamp(1.55rem,3vw,2.25rem);line-height:1.1}.mtb-study-badge{flex:0 0 auto;padding:10px 16px;border:1px solid rgba(23,58,94,.18);border-radius:999px;background:#fff;color:var(--navy);font-weight:800}
.mtb-study-controls{display:flex;justify-content:flex-end;gap:10px;margin:-10px 0 18px}.mtb-study-control{appearance:none;border:1px solid #b9c8d5;border-radius:8px;background:#fff;color:var(--navy);padding:8px 13px;font-weight:800;cursor:pointer}.mtb-study-control:hover{background:#eef4f9}.mtb-study-section{margin:0 0 30px;border:1px solid var(--line);border-radius:15px;background:#fff;box-shadow:0 5px 18px rgba(28,48,66,.06);overflow:hidden}.mtb-study-section>summary{list-style:none;cursor:pointer}.mtb-study-section>summary::-webkit-details-marker{display:none}.mtb-study-section-banner{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:17px 21px;background:linear-gradient(100deg,var(--navy),#315f88);color:#fff}.mtb-study-section-banner h2{margin:0;font-size:1.28rem}.mtb-study-section-number{font-size:.76rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;opacity:.82}.mtb-study-section-toggle{flex:0 0 auto;width:34px;height:34px;border:1px solid rgba(255,255,255,.4);border-radius:999px;display:grid;place-items:center;font-size:1.35rem;font-weight:700}.mtb-study-section-toggle:before{content:'−'}.mtb-study-section:not([open]) .mtb-study-section-toggle:before{content:'+'}.mtb-study-section:not([open]) .mtb-study-section-banner{border-radius:14px}
.mtb-study-block{padding:20px}.mtb-study-block-title{display:flex;align-items:center;gap:12px;margin:0 0 14px;color:var(--navy);font-size:1.02rem;text-transform:uppercase;letter-spacing:.055em}.mtb-study-block-title:after{content:'';height:1px;flex:1;background:linear-gradient(to right,#c7d3de,transparent)}
.mtb-study-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:18px;align-items:stretch}.mtb-study-card{grid-column:span 3;border:1px solid var(--line);border-top:4px solid #6288aa;border-radius:11px;overflow:hidden;background:#fff}.mtb-study-card-wide{grid-column:span 6}.mtb-study-card h3{margin:0;padding:11px 14px 9px;background:var(--blue-soft);border-bottom:1px solid #e4ebf0;color:var(--navy);font-size:.94rem}.mtb-study-card-prompt{display:block;margin-top:3px;color:var(--muted);font-size:.72rem;font-weight:500}.mtb-study-card-body{padding:14px 16px 16px;line-height:1.5}.mtb-study-card-body p{margin:0 0 .85em}.mtb-study-card-body p:last-child{margin-bottom:0}.mtb-study-card-body ul{margin:0;padding-left:1.2em}.mtb-study-card-body li{margin:0 0 .48em}.mtb-study-card-theme,.mtb-study-card-mainidea,.mtb-study-card-christ{border-top-color:var(--gold);background:linear-gradient(180deg,#fffdf8,#fff)}.mtb-study-card-theme h3,.mtb-study-card-mainidea h3,.mtb-study-card-christ h3{background:var(--gold-soft);color:#6f4b16}
.mtb-study-verses{padding:0 20px 20px}.mtb-study-verse{margin:0 0 13px;border:1px solid #cfdae3;border-radius:11px;background:#fff;overflow:hidden}.mtb-study-verse summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 17px;cursor:pointer;background:#f3f7fa;color:var(--navy);font-weight:800;list-style:none}.mtb-study-verse summary::-webkit-details-marker{display:none}.mtb-study-verse summary:after{content:'+';font-size:1.3rem}.mtb-study-verse[open] summary:after{content:'−'}.mtb-study-verse[open] summary{border-bottom:1px solid #dbe3ea;background:#eaf2f8}.mtb-study-verse-body{padding:16px}.mtb-study-scripture-block{position:relative;margin:0 0 11px;padding:16px 18px;border-left:5px solid var(--gold);border-radius:0 9px 9px 0;background:#fffaf0}.mtb-study-scripture-block p{margin:0;line-height:1.5}.mtb-study-translation{float:right;margin:0 0 6px 10px;padding:3px 7px;border-radius:999px;background:#efe2c7;color:#6b4818;font-size:.7rem;font-weight:800}.mtb-study-verse-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:14px;align-items:stretch}.mtb-study-verse-panel{border:1px solid var(--line);border-radius:9px;overflow:hidden}.mtb-study-verse-panel h4{margin:0;padding:9px 12px;background:#f4f7f9;color:var(--navy);font-size:.88rem}.mtb-study-verse-panel-content{padding:12px 13px;line-height:1.47}.mtb-study-verse-panel-content p{margin:0 0 .8em}.mtb-study-observation{padding:0 0 9px;margin:0 0 9px;border-bottom:1px solid #e7ecef}.mtb-study-observation:last-child{padding-bottom:0;margin-bottom:0;border-bottom:0}.mtb-study-observation strong{display:block;margin-bottom:3px;color:var(--navy)}.mtb-study-observation span{display:block}.mtb-study-empty{color:#77818a;font-style:italic}
.mtb-study-wrap{padding:0 20px 22px}.mtb-study-wrap-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:13px}.mtb-study-wrap-card{grid-column:span 4;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}.mtb-study-wrap-card h3{margin:0;padding:10px 13px;background:#f3f7fa;color:var(--navy);font-size:.9rem}.mtb-study-wrap-card .mtb-study-card-body{padding:13px 14px}.mtb-study-wrap-card-christ,.mtb-study-wrap-card-dwelling{grid-column:span 6;border-top:4px solid var(--gold)}
@media(max-width:1100px){.mtb-study-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mtb-study-card{grid-column:span 1}.mtb-study-card-wide{grid-column:span 2}.mtb-study-wrap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mtb-study-wrap-card,.mtb-study-wrap-card-christ,.mtb-study-wrap-card-dwelling{grid-column:span 1}.mtb-study-verse-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:660px){.mtb-study-grid{grid-template-columns:1fr}.mtb-study-card,.mtb-study-card-wide{grid-column:1/-1}.mtb-chapter-study{padding-left:0;padding-right:0}.mtb-study-hero{align-items:flex-start;flex-direction:column;padding:18px;border-radius:10px}.mtb-study-controls{justify-content:stretch;margin-top:-6px}.mtb-study-control{flex:1}.mtb-study-section-banner{align-items:center}.mtb-study-block,.mtb-study-verses,.mtb-study-wrap{padding-left:13px;padding-right:13px}.mtb-study-wrap-grid{grid-template-columns:1fr}.mtb-study-verse-grid{grid-template-columns:1fr}.mtb-study-verse summary{padding:13px}.mtb-study-verse-body{padding:12px}}
</style>
'@)

  [void]$sb.Append('<div class="mtb-chapter-study"><header class="mtb-study-hero"><div><p class="mtb-study-eyebrow">Chapter Study</p><h1 class="mtb-study-title">' + (ConvertTo-HtmlEncoded $bookDisplay) + ' Chapter ' + $Chapter + '</h1></div><div class="mtb-study-badge">Verse-by-Verse</div></header><div class="mtb-study-controls" aria-label="Chapter study display controls"><button type="button" class="mtb-study-control" onclick="this.closest(&quot;.mtb-chapter-study&quot;).querySelectorAll(&quot;details.mtb-study-section, details.mtb-study-verse&quot;).forEach(function(panel){panel.open=true;});">Expand All</button><button type="button" class="mtb-study-control" onclick="this.closest(&quot;.mtb-chapter-study&quot;).querySelectorAll(&quot;details.mtb-study-section, details.mtb-study-verse&quot;).forEach(function(panel){panel.open=false;});">Collapse All</button></div>')

  $sectionNumber = 0
  foreach ($section in $sections) {
    $sectionNumber++

    # Pull the Theme value into the collapsible section heading instead of
    # rendering it as a separate overview card.
    $overviewPairs = @(@($section.OverviewHeaders1,$section.OverviewValues1),@($section.OverviewHeaders2,$section.OverviewValues2))
    $sectionTheme = ''
    foreach ($pair in $overviewPairs) {
      $themeHeaders = $pair[0]
      $themeValues = $pair[1]
      for ($themeColumn = 0; $themeColumn -lt $themeHeaders.Count; $themeColumn++) {
        $themeHeader = [string]$themeHeaders[$themeColumn]
        if ([string]::IsNullOrWhiteSpace($themeHeader)) { continue }
        $themeParts = Get-MtbStudyHeaderParts $themeHeader
        if ($themeParts.Title.Trim().ToLowerInvariant() -match '^theme') {
          if ($themeColumn -lt $themeValues.Count) { $sectionTheme = ([string]$themeValues[$themeColumn]).Trim() }
          break
        }
      }
      if (-not [string]::IsNullOrWhiteSpace($sectionTheme)) { break }
    }

    $sectionHeading = [string]$section.Passage
    if (-not [string]::IsNullOrWhiteSpace($sectionTheme)) {
      $sectionHeading += ': ' + $sectionTheme
    }

    [void]$sb.Append('<details class="mtb-study-section"><summary class="mtb-study-section-banner"><div><div class="mtb-study-section-number">Section ' + $sectionNumber + '</div><h2>' + (ConvertTo-HtmlEncoded $sectionHeading) + '</h2></div><span class="mtb-study-section-toggle" aria-hidden="true"></span></summary>')
    [void]$sb.Append('<div class="mtb-study-block"><h2 class="mtb-study-block-title">Overview</h2><div class="mtb-study-grid">')
    foreach ($pair in $overviewPairs) {
      $headers = $pair[0]; $values = $pair[1]
      for ($c=0; $c -lt $headers.Count; $c++) {
        $rawHeader = [string]$headers[$c]
        if ([string]::IsNullOrWhiteSpace($rawHeader)) { continue }
        $parts = Get-MtbStudyHeaderParts $rawHeader
        $value = if ($c -lt $values.Count) { [string]$values[$c] } else { '' }
        $key = $parts.Title.Trim().ToLowerInvariant()
        # Theme is displayed in the section heading, so do not repeat it as a card.
        if ($key -match '^theme') { continue }
        $extra = ''
        if ($key -match 'main idea') { $extra=' mtb-study-card-mainidea' }
        if ($key -match '^remarks') { $extra += ' mtb-study-card-wide' }
        [void]$sb.Append('<article class="mtb-study-card' + $extra + '"><h3>' + (ConvertTo-HtmlEncoded $parts.Title))
        if (-not [string]::IsNullOrWhiteSpace($parts.Prompt)) { [void]$sb.Append('<span class="mtb-study-card-prompt">' + (ConvertTo-HtmlEncoded $parts.Prompt) + '</span>') }
        [void]$sb.Append('</h3><div class="mtb-study-card-body">' + (Convert-MtbStudyCellToHtml $value $parts.Title -EmphasizeLabels) + '</div></article>')
      }
    }
    [void]$sb.Append('</div></div>')

    if ($section.VerseRows.Count -gt 0) {
      [void]$sb.Append('<div class="mtb-study-verses"><h2 class="mtb-study-block-title">Verse-by-Verse Study</h2>')
      $verseIndex=0
      foreach ($row in $section.VerseRows) {
        $verseIndex++
        $scripture=[string]$row[0]
        $reference=Get-MtbStudyVerseReference $scripture $BookSlug $Chapter
        $openAttr='' # All verses begin collapsed; section panels begin expanded.
        $verseNumber = $verseIndex
        if ($reference -match ':\s*(?<verse>\d+)') { $verseNumber = [int]$Matches['verse'] }
        [void]$sb.Append('<details class="mtb-study-verse" data-verse="' + $verseNumber + '"' + $openAttr + '><summary><span>' + (ConvertTo-HtmlEncoded $reference) + '</span></summary><div class="mtb-study-verse-body">')
        [void]$sb.Append((Convert-MtbStudyScriptureToHtml -Text $scripture -BookSlug $BookSlug -Chapter $Chapter -Verse $verseNumber))
        [void]$sb.Append('<div class="mtb-study-verse-grid">')
        for ($c=1; $c -lt $section.VerseHeaders.Count; $c++) {
          $rawHeader=[string]$section.VerseHeaders[$c]
          if ([string]::IsNullOrWhiteSpace($rawHeader)) { continue }
          $parts=Get-MtbStudyHeaderParts $rawHeader
          $value=if($c -lt $row.Count){[string]$row[$c]}else{''}
          [void]$sb.Append('<section class="mtb-study-verse-panel"><h4>' + (ConvertTo-HtmlEncoded $parts.Title) + '</h4><div class="mtb-study-verse-panel-content">' + (Convert-MtbStudyCellToHtml $value $parts.Title -EmphasizeLabels) + '</div></section>')
        }
        [void]$sb.Append('</div></div></details>')
      }
      [void]$sb.Append('</div>')
    }

    if ($section.WrapHeaders.Count -gt 0) {
      [void]$sb.Append('<div class="mtb-study-wrap"><h2 class="mtb-study-block-title">Section Wrap-Up</h2><div class="mtb-study-wrap-grid">')
      for ($c=0; $c -lt $section.WrapHeaders.Count; $c++) {
        $rawHeader=[string]$section.WrapHeaders[$c]
        if ([string]::IsNullOrWhiteSpace($rawHeader)) { continue }
        $parts=Get-MtbStudyHeaderParts $rawHeader
        $value=if($c -lt $section.WrapValues.Count){[string]$section.WrapValues[$c]}else{''}
        $key=$parts.Title.Trim().ToLowerInvariant(); $extra=''
        if($key -match 'christ connection'){$extra=' mtb-study-wrap-card-christ'}elseif($key -match 'dwelling'){$extra=' mtb-study-wrap-card-dwelling'}
        [void]$sb.Append('<article class="mtb-study-wrap-card' + $extra + '"><h3>' + (ConvertTo-HtmlEncoded $parts.Title) + '</h3><div class="mtb-study-card-body">' + (Convert-MtbStudyCellToHtml $value $parts.Title -EmphasizeLabels) + '</div></article>')
      }
      [void]$sb.Append('</div></div>')
    }
    [void]$sb.Append('</details>')
  }

  [void]$sb.Append('</div>')
  return $sb.ToString()
}

function Write-MtbChapterStudyFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $OutBookDir,
    [Parameter(Mandatory)] [string] $BookSlug,
    [Parameter(Mandatory)] [int] $Chapter,
    [Parameter(Mandatory)] [string] $WorksheetName
  )
  $chapterDir=Join-Path $OutBookDir ("{0:D3}" -f $Chapter); Ensure-Path $chapterDir
  # Preserve the established filename because the Chapter Explanation tab already references it.
  $outName="$BookSlug-$Chapter-chapter-explanation.html"; $outPath=Join-Path $chapterDir $outName
  $html=New-MtbChapterStudyHtmlFromExcel -WorkbookPath $WorkbookPath -BookSlug $BookSlug -Chapter $Chapter -WorksheetName $WorksheetName
  $html=Wrap-MtbDocHtml $html 'chapter-explanation'
  [System.IO.File]::WriteAllText($outPath,$html,[System.Text.UTF8Encoding]::new($false))
  Write-Host ("OK   " + (Split-Path $WorkbookPath -Leaf) + " [$WorksheetName] -> " + $outName) -ForegroundColor Green
  return $outPath
}

function Write-AllMtbChapterStudiesFromExcel {
  param([Parameter(Mandatory)][string]$WorkbookPath,[Parameter(Mandatory)][string]$OutBookDir,[Parameter(Mandatory)][string]$BookSlug)
  $writtenNames=New-Object 'System.Collections.Generic.List[string]'
  $sheetNames=Get-ExcelWorksheetNames -WorkbookPath $WorkbookPath
  foreach($sheetName in $sheetNames){
    if($sheetName -match '^Study\s+Chapter\s+(?<chapter>\d+)$'){
      $chapter=[int]$Matches['chapter']
      $path=Write-MtbChapterStudyFromExcel -WorkbookPath $WorkbookPath -OutBookDir $OutBookDir -BookSlug $BookSlug -Chapter $chapter -WorksheetName $sheetName
      $writtenNames.Add((Split-Path $path -Leaf))
    }
  }
  return ,$writtenNames.ToArray()
}


# -----------------------------
# MAIN
# -----------------------------
Write-Host ""
Write-Host "Mastering the Bible - site Generator"
Write-Host ""

#$Mode = Prompt-NonEmpty "Mode (BOOK / ABOUT / RESOURCES)" "BOOK"
#$Mode = $Mode.Trim().ToUpperInvariant()

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
# Generate the Book Introduction directly from the canonical workbook when present.
  $bookWorkbook = Join-Path $bookSource ($BOOK_SLUG + ".xlsm")
  $introGeneratedFromExcel = $false

  if (Test-Path $bookWorkbook) {
    try {
      $introOut = Write-MtbBookIntroductionFromExcel -WorkbookPath $bookWorkbook -OutBookDir $outDir -BookSlug $BOOK_SLUG
      Write-Host ("WROTE: " + $introOut) -ForegroundColor Cyan
      $introGeneratedFromExcel = $true
    }
    catch {
      Fail ("Could not generate the Book Introduction from " + $bookWorkbook + ":`n" + $_.Exception.Message)
    }
  }
  else {
    Write-Host ("No workbook found at: " + $bookWorkbook) -ForegroundColor Yellow
  }

  # Track workbook-generated files so legacy DOCX files cannot overwrite them.
  $excelGeneratedOutputNames = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
  if ($introGeneratedFromExcel) { [void]$excelGeneratedOutputNames.Add("$BOOK_SLUG-0-book-introduction.html") }

  if (Test-Path $bookWorkbook) {
    try {
      $overviewNames = Write-AllMtbChapterOverviewsFromExcel -WorkbookPath $bookWorkbook -OutBookDir $outDir -BookSlug $BOOK_SLUG
      foreach ($overviewName in $overviewNames) { [void]$excelGeneratedOutputNames.Add($overviewName) }
    }
    catch {
      Fail ("Could not generate chapter overview content from " + $bookWorkbook + ":`n" + $_.Exception.Message)
    }
  }

  if (Test-Path $bookWorkbook) {
    try {
      $studyNames = Write-AllMtbChapterStudiesFromExcel -WorkbookPath $bookWorkbook -OutBookDir $outDir -BookSlug $BOOK_SLUG
      foreach ($studyName in $studyNames) { [void]$excelGeneratedOutputNames.Add($studyName) }
    }
    catch {
      Fail ("Could not generate chapter study content from " + $bookWorkbook + ":`n" + $_.Exception.Message)
    }
  }

  $docxFiles = @(Get-ChildItem $bookSource -Filter "*.docx" -Recurse -ErrorAction SilentlyContinue)
  if ($docxFiles.Count -eq 0 -and -not $introGeneratedFromExcel) {
    Fail "No DOCX files or canonical workbook content found under: $bookSource"
  }

  $debugShown = 0
  $okCount = 0
$failCount = 0
$failList = New-Object System.Collections.Generic.List[string]

  foreach ($docx in $docxFiles) {
    try {
      Write-Host ("Processing " + $docx.Name + "...")
 
$html = Convert-DocxToHtmlFragment $docx.FullName
$html = Fix-MojibakeHtml $html

$html = $html -replace 'class="mtb-scripture"', 'class="MTB-Read"'
$html = $html -replace 'class="MTB-Scripture"', 'class="MTB-Read"'

$base = [System.IO.Path]::GetFileNameWithoutExtension($docx.Name)
$outName = (Slugify $base) + ".html"



      $base = [System.IO.Path]::GetFileNameWithoutExtension($docx.Name)
      $outName = (Slugify $base) + ".html"

      if ($excelGeneratedOutputNames.Contains($outName)) {
        Write-Host ("SKIP " + $docx.Name + " because " + $outName + " was generated from the workbook.") -ForegroundColor DarkYellow
        continue
      }

      # Enrich Word Study HTML (wrap Summary and Full Study sections)
if ($outName -match '^(?<book>[a-z0-9-]+)-(?<ch>\d+)-(?<v>\d+)-(?<strong>[gh]\d+)(?:-.+)?\.html$') {
  $html = Enrich-WordStudyHtml $html
}
      # Route output based on slugged filename:
      # - <book>-0-*              -> 000-book
      # - <book>-<n>-* (n > 0)    -> <n as 3 digits> (001, 002, ...)
      # - otherwise               -> book root
      $targetSub = ""
     if ($outName -match '^(?<book>[a-z0-9-]+?)-0-') {
        $targetSub = "000-book"
      }
    elseif ($outName -match '^(?<book>[a-z0-9-]+?)-(?<ch>\d+)-') {
  $n = [int]$Matches['ch']
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
if ($docType -eq "chapter-explanation") {
  $html = Enrich-MtbReadStrongSpans $html $BOOK_SLUG
}
$html = Wrap-MtbDocHtml $html $docType
if (Test-Path $outPath) {  #mrt
  Write-Host ("OVERWRITE: " + (Split-Path $outPath -Leaf) + "  <-  " + $docx.FullName) -ForegroundColor Yellow
}
[System.IO.File]::WriteAllText($outPath, $html, [System.Text.UTF8Encoding]::new($false))

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

    $ch = 1
if ($outName -match '^[a-z0-9-]+-(\d+)-') {
  $ch = [int]$Matches[1]
}

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
  Write-Host "Mode: ABOUT (Processing standard and 'About the Bible' folders)" -ForegroundColor Cyan
  
  # --- PART 1: Standard ABOUT Documents ---
  if (-not (Test-Path $DEFAULT_ABOUT_SRC)) { Fail "About source not found: $DEFAULT_ABOUT_SRC" }
  $outDir = Join-Path $SITE_ROOT "about"
  Ensure-Path $outDir

  $docxFiles = Get-ChildItem $DEFAULT_ABOUT_SRC -Filter "*.docx" -ErrorAction SilentlyContinue


  # --- PART 2: ABOUT THE BIBLE Documents ---
  $BIBLE_ABOUT_SRC = Join-Path $MTB_SOURCE_ROOT "aboutthebible"
  $bibleOutDir     = Join-Path $SITE_ROOT "aboutthebible"

  if (Test-Path $BIBLE_ABOUT_SRC) {
    Ensure-Path $bibleOutDir
    $bibleDocxFiles = Get-ChildItem $BIBLE_ABOUT_SRC -Filter "*.docx" -ErrorAction SilentlyContinue
    
    foreach ($docx in $bibleDocxFiles) {
      try {
        Write-Host ("Processing Bible-Topic: " + $docx.Name + "...")
        $html = Convert-DocxToHtmlFragment $docx.FullName
        $html = Fix-MojibakeHtml $html
        $base = [System.IO.Path]::GetFileNameWithoutExtension($docx.Name)
        $slug = Slugify $base
        $outPath = Join-Path $bibleOutDir ($slug + ".html")
        Set-Content -Path $outPath -Value $html -Encoding UTF8 -Force
        Write-Host ("OK Bible-Topic: " + $docx.Name + " -> " + ([System.IO.Path]::GetFileName($outPath))) -ForegroundColor Green
      }
      catch {
        Write-Host ("FAIL Bible-Topic: " + $docx.Name) -ForegroundColor Red
      }
    }
  } else {
    Write-Host "Skip: 'aboutthebible' source folder not found." -ForegroundColor Yellow
  }

  Write-Host ""
  Write-Host "ABOUT and ABOUT THE BIBLE generation complete." -ForegroundColor Green
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
if ($Mode -eq "SECTIONS") {

  Write-Host ""
  Write-Host "Mode: SECTIONS (Canonical Context)"
  
  $sectionsSrcRoot = Join-Path $MTB_SOURCE_ROOT "sections"
  if (-not (Test-Path $sectionsSrcRoot)) { Fail "Sections source not found: $sectionsSrcRoot" }

  $sectionsOutRoot = Join-Path $SITE_ROOT "sections"
  Ensure-Path $sectionsOutRoot

  $docxFiles = Get-ChildItem $sectionsSrcRoot -Recurse -Filter "*.docx" -ErrorAction SilentlyContinue

  foreach ($docx in $docxFiles) {
    try {
      # Build output path mirroring folder structure under /sections
      $rel = $docx.FullName.Substring($sectionsSrcRoot.Length).TrimStart("\","/")
      $relDir = Split-Path $rel -Parent

      $outDir = if ([string]::IsNullOrWhiteSpace($relDir)) { $sectionsOutRoot } else { Join-Path $sectionsOutRoot $relDir }
      Ensure-Path $outDir

      # Default to index.html (so /sections/.../ renders clean)
      $outPath = Join-Path $outDir "index.html"

      Write-Host ("Processing Section: " + $rel + " -> " + ($outDir + "\index.html") + "...")

      $html = Convert-DocxToHtmlFragment $docx.FullName
      $html = Fix-MojibakeHtml $html

      # Wrap as a canonical-context fragment for stable styling/hooks
      $html = "<section class=`"mtb-doc mtb-doc--read`" data-doc-type=`"canonical-context`">`n$html`n</section>`n"

      Set-Content -Path $outPath -Value $html -Encoding UTF8 -Force
      Write-Host ("OK Section: " + $rel + " -> index.html") -ForegroundColor Green
    }
    catch {
      Write-Host ("FAIL Section: " + $docx.FullName) -ForegroundColor Red
      Write-Host ($_.Exception.Message) -ForegroundColor Red
    }
  }

  Write-Host ""
  Write-Host "SECTIONS generation complete." -ForegroundColor Green
  exit 0
}
Fail "Unknown mode '$Mode'. Use BOOK, ABOUT, RESOURCES, or SECTIONS."