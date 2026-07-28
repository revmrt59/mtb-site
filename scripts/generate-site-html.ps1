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
  "titus"="pastoral-epistles"

  # Philemon remains one of the Pauline Epistles
  "philemon"="pauline-epistles"

  # General Epistles
  "hebrews"="general-epistles"; "james"="general-epistles"
  "1-peter"="general-epistles"; "2-peter"="general-epistles"
  "jude"="general-epistles"

  # Johannine Epistles
  "1-john"="johannine-epistles"; "2-john"="johannine-epistles"
  "3-john"="johannine-epistles"

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
function Convert-MtbResourceMarkupToHtml {
  param(
    [AllowEmptyString()]
    [string] $Html
  )

  if ([string]::IsNullOrWhiteSpace($Html)) {
    return $Html
  }

  $pattern = '\[\[(?<label>[^\]|]+?)\s*\|\s*(?<type>[a-z0-9-]+)\s*:\s*(?<id>[a-z0-9-]+)\s*\]\]'

  return [regex]::Replace(
    $Html,
    $pattern,
    {
      param($match)

      $label = $match.Groups['label'].Value.Trim()
      $type  = $match.Groups['type'].Value.Trim().ToLowerInvariant()
      $id    = $match.Groups['id'].Value.Trim().ToLowerInvariant()

      # Prefer the exact workbook resource ID.
      $resolvedId = $id

      # Safety fallback for older/stale links:
      # when the exact generated HTML does not exist, locate one unique
      # resource in the requested folder whose filename contains the ID.
      try {
        $resourceFolder = Join-Path (Join-Path $SITE_ROOT "resources") $type
        $exactPath = Join-Path $resourceFolder ($resolvedId + ".html")

        if (
          (Test-Path -LiteralPath $resourceFolder) -and
          -not (Test-Path -LiteralPath $exactPath)
        ) {
          $matches = @(
            Get-ChildItem `
              -LiteralPath $resourceFolder `
              -File `
              -Filter ("*" + $id + "*.html") `
              -ErrorAction SilentlyContinue
          )

          if ($matches.Count -eq 1) {
            $resolvedId = [System.IO.Path]::GetFileNameWithoutExtension(
              $matches[0].Name
            )
          }
        }
      }
      catch {
        # Keep the exact workbook ID if resource discovery is unavailable.
        $resolvedId = $id
      }

      $labelEncoded = [System.Net.WebUtility]::HtmlEncode($label)
      $url = "/resources/$type/$resolvedId.html"

      return (
        "<a href=`"$url`"" +
        " class=`"mtb-resource-link mtb-resource-link--popup`"" +
        " data-resource-url=`"$url`"" +
        " data-resource-type=`"$type`"" +
        " data-resource-id=`"$resolvedId`"" +
        " aria-label=`"$labelEncoded (opens in a popup)`">" +
        $labelEncoded +
        "</a>"
      )
    },
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )
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

    # Read the entire used range in one COM call. Avoid PowerShell array += here:
    # appending tens of thousands of rows with += repeatedly reallocates the array
    # and can make even Obadiah appear to hang while ALL_BIBLES.xlsm is loaded.
    $rawValues = $usedRange.Value2

    if ($rows -eq 1 -and $cols -eq 1) {
      return ,@(@([string]$rawValues))
    }

    $values = New-Object 'System.Collections.Generic.List[object]'

    for ($r = 1; $r -le $rows; $r++) {
      $row = New-Object 'System.Collections.Generic.List[string]'
      for ($c = 1; $c -le $cols; $c++) {
        $v = $rawValues.GetValue($r, $c)
        if ($null -eq $v) {
          $row.Add('')
        }
        else {
          $row.Add([string]$v)
        }
      }
      $values.Add($row.ToArray())
    }

    return ,$values.ToArray()
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

function Get-MtbIntroFieldValue {
  param(
    [Parameter(Mandatory)] [hashtable] $Fields,
    [Parameter(Mandatory)] [string] $Key
  )

  $lookup = $Key.Trim().ToLowerInvariant()
  if ($Fields.ContainsKey($lookup)) {
    return [string]$Fields[$lookup]
  }

  $aliases = @{
    'theme(s)'             = @('themes', 'major themes')
    'themes'               = @('theme(s)', 'major themes')
    'major themes'         = @('theme(s)', 'themes')
    'big idea'             = @('central message')
    'central message'      = @('big idea')
    'key verse(s)'         = @('key verses')
    'key verses'           = @('key verse(s)')
    'book summary'         = @('summary')
    'introductory summary' = @('introduction summary')
  }

  if ($aliases.ContainsKey($lookup)) {
    foreach ($alias in $aliases[$lookup]) {
      if ($Fields.ContainsKey($alias)) {
        return [string]$Fields[$alias]
      }
    }
  }

  return ''
}

function Get-MtbIntroBookTitle {
  param(
    [Parameter(Mandatory)] [object[]] $Data,
    [Parameter(Mandatory)] [string] $BookSlug
  )

  foreach ($row in $Data) {
    if ($null -eq $row -or $row.Count -eq 0) { continue }

    $firstCell = [string]$row[0]
    if ([string]::IsNullOrWhiteSpace($firstCell)) { continue }

    if ($firstCell -match '^(?<book>.+?)\s*[—-]\s*(Background|Message)\s*$') {
      return $Matches['book'].Trim()
    }
  }

  if ([string]::IsNullOrWhiteSpace($BookSlug)) {
    return 'Book Introduction'
  }

  return (Get-Culture).TextInfo.ToTitleCase(
    ($BookSlug -replace '-', ' ')
  )
}

function Get-MtbIntroFieldsFromWorksheetData {
  param(
    [Parameter(Mandatory)] [object[]] $Data
  )

  $recognizedHeaders = @(
    'book',
    'author',
    'audience',
    'date',
    'historical setting',
    'occasion',
    'purpose',
    'book summary',
    'summary',
    'major themes',
    'theme(s)',
    'themes',
    'central message',
    'big idea',
    'key verse(s)',
    'key verses',
    'outline',
    'christ in this book'
  )

  $fields = @{}

  for ($rowIndex = 0; $rowIndex -lt ($Data.Count - 1); $rowIndex++) {
    $headerRow = @($Data[$rowIndex])
    $valueRow = @($Data[$rowIndex + 1])

    $recognizedCount = 0

    foreach ($cell in $headerRow) {
      $headerText = ([string]$cell).Trim().ToLowerInvariant()
      if ($recognizedHeaders -contains $headerText) {
        $recognizedCount++
      }
    }

    # A real Book Introduction header row contains several recognized fields.
    if ($recognizedCount -lt 2) {
      continue
    }

    for ($column = 0; $column -lt $headerRow.Count; $column++) {
      $header = ([string]$headerRow[$column]).Trim()
      if ([string]::IsNullOrWhiteSpace($header)) { continue }

      $key = $header.ToLowerInvariant()
      if ($recognizedHeaders -notcontains $key) { continue }

      $value = ''
      if ($column -lt $valueRow.Count) {
        $value = [string]$valueRow[$column]
      }

      $fields[$key] = $value
    }
  }

  # Introductory Summary is stored as a merged heading followed by a merged value.
  for ($rowIndex = 0; $rowIndex -lt ($Data.Count - 1); $rowIndex++) {
    $firstCell = ([string]$Data[$rowIndex][0]).Trim()

    if (
      $firstCell.Equals(
        'Introductory Summary',
        [System.StringComparison]::OrdinalIgnoreCase
      )
    ) {
      $fields['introductory summary'] = [string]$Data[$rowIndex + 1][0]
      break
    }
  }

  return $fields
}

function New-MtbBookIntroductionHtmlFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $BookSlug
  )

  $data = Get-ExcelWorksheetValues `
    -WorkbookPath $WorkbookPath `
    -WorksheetName 'Book Introduction'

  if ($data.Count -lt 3) {
    throw (
      "The 'Book Introduction' worksheet does not contain enough data."
    )
  }

  # Detect the current workbook layout by header names instead of fixed rows.
  # This supports both the older workbook layout and the current layout:
  #
  # Row 1: Book — Background
  # Row 2: Background headers
  # Row 3: Background values
  # Row 5: Book — Message
  # Row 6: Message headers
  # Row 7: Message values
  # Row 9: Introductory Summary
  # Row 10: Introductory Summary value
  $fields = Get-MtbIntroFieldsFromWorksheetData -Data $data
  $bookTitle = Get-MtbIntroBookTitle -Data $data -BookSlug $BookSlug
  $introLabel = $bookTitle + ' - Book Introduction'

  if ($fields.Count -eq 0) {
    throw (
      "No Book Introduction fields were detected in: " +
      $WorkbookPath
    )
  }

  $layoutRows = @(
    @{
      Title = 'Background'
      Cards = @(
        @{ Header = 'Author'; Key = 'author'; Span = 1 },
        @{ Header = 'Audience'; Key = 'audience'; Span = 1 },
        @{ Header = 'Date'; Key = 'date'; Span = 1 },
        @{ Header = 'Occasion'; Key = 'occasion'; Span = 1 },
        @{
          Header = 'Historical Setting'
          Key = 'historical setting'
          Span = 4
        }
      )
    },
    @{
      Title = 'Message'
      Cards = @(
        @{ Header = 'Purpose'; Key = 'purpose'; Span = 1 },
        @{ Header = 'Book Summary'; Key = 'book summary'; Span = 1 },
        @{ Header = 'Major Themes'; Key = 'major themes'; Span = 1 },
        @{
          Header = 'Central Message'
          Key = 'central message'
          Span = 1
        }
      )
    },
    @{
      Title = 'Study Guide'
      Cards = @(
        @{ Header = 'Outline'; Key = 'outline'; Span = 1 },
        @{ Header = 'Key Verse(s)'; Key = 'key verse(s)'; Span = 1 },
        @{
          Header = 'Christ in This Book'
          Key = 'christ in this book'
          Span = 1
        },
        @{
          Header = 'Introductory Summary'
          Key = 'introductory summary'
          Span = 1
        }
      )
    }
  )

  $sb = New-Object System.Text.StringBuilder

  [void]$sb.Append(@'
<style>
/* Widen only the Book Introduction modal when this generated dashboard is present. */
.book-modal-panel:has(.mtb-book-introduction-dashboard) {
  width: min(1600px, 96vw);
  max-width: none;
}

.mtb-book-introduction-dashboard {
  --mtb-navy: #173a5e;
  --mtb-navy-2: #274f76;
  --mtb-gold: #b7832f;
  --mtb-gold-soft: #fbf4e7;
  --mtb-blue-soft: #eef4f9;
  --mtb-border: #d7e0e8;
  --mtb-text: #1d2935;
  width: 100%;
  max-width: 1560px;
  margin: 0 auto;
  padding: 2px 4px 28px;
  color: var(--mtb-text);
  font-family: Arial, Helvetica, sans-serif;
}
.mtb-book-introduction-dashboard * { box-sizing: border-box; }

.mtb-book-introduction-dashboard .mtb-intro-hero {
  position: relative;
  overflow: hidden;
  margin: 0 0 24px;
  padding: 22px 28px;
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
  position: relative;
  z-index: 1;
  margin: 0 0 5px;
  color: var(--mtb-gold);
  font-size: .78rem;
  font-weight: 800;
  letter-spacing: .13em;
  text-transform: uppercase;
}
.mtb-book-introduction-dashboard .mtb-intro-title {
  position: relative;
  z-index: 1;
  margin: 0;
  color: var(--mtb-navy);
  font-size: clamp(1.85rem, 3vw, 2.6rem);
  line-height: 1.05;
}
.mtb-book-introduction-dashboard .mtb-intro-subtitle {
  position: relative;
  z-index: 1;
  margin: 6px 0 0;
  color: #4e6477;
  font-size: 1rem;
  font-weight: 700;
}

.mtb-book-introduction-dashboard .mtb-intro-section {
  margin: 0 0 25px;
}
.mtb-book-introduction-dashboard .mtb-intro-section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 12px;
}
.mtb-book-introduction-dashboard .mtb-intro-section-heading h2 {
  margin: 0;
  color: var(--mtb-navy);
  font-size: 1.08rem;
  letter-spacing: .05em;
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  align-items: stretch;
}
.mtb-book-introduction-dashboard .mtb-intro-card {
  grid-column: span 1;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--mtb-border);
  border-top: 4px solid var(--mtb-navy-2);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 15px rgba(28, 48, 66, .055);
}
.mtb-book-introduction-dashboard .mtb-intro-card.mtb-span-2 {
  grid-column: span 2;
}
.mtb-book-introduction-dashboard .mtb-intro-card.mtb-span-4 {
  grid-column: span 4;
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
  margin: 0 0 .8em;
}
.mtb-book-introduction-dashboard .mtb-intro-card-body p:last-child { margin-bottom: 0; }
.mtb-book-introduction-dashboard .mtb-intro-card-body ul {
  margin: 0;
  padding-left: 1.24em;
}
.mtb-book-introduction-dashboard .mtb-intro-card-body li {
  margin: 0 0 .45em;
  padding-left: .1em;
}
.mtb-book-introduction-dashboard .mtb-intro-card-body li:last-child { margin-bottom: 0; }

/* Keep emphasis inside otherwise-identical panels. */
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

/* Inline links to reusable MTB resources. */
.mtb-book-introduction-dashboard .mtb-resource-link {
  color: #1f5fae;
  font-weight: 700;
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
  cursor: pointer;
}
.mtb-book-introduction-dashboard .mtb-resource-link::after {
  content: " \2197";
  display: inline-block;
  margin-left: 2px;
  font-size: .78em;
  line-height: 1;
  opacity: .78;
}
.mtb-book-introduction-dashboard .mtb-resource-link:hover,
.mtb-book-introduction-dashboard .mtb-resource-link:focus-visible {
  color: #123f7a;
  text-decoration-style: solid;
}
.mtb-book-introduction-dashboard .mtb-resource-link:focus-visible {
  outline: 3px solid rgba(31, 95, 174, .28);
  outline-offset: 3px;
  border-radius: 3px;
}
.mtb-book-introduction-dashboard .mtb-card-key-verses .mtb-intro-card-body p {
  padding-left: 12px;
  border-left: 3px solid #b9cce0;
}

@media (max-width: 1100px) {
  .book-modal-panel:has(.mtb-book-introduction-dashboard) {
    width: min(1100px, 94vw);
  }
  .mtb-book-introduction-dashboard .mtb-intro-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .mtb-book-introduction-dashboard .mtb-intro-card,
  .mtb-book-introduction-dashboard .mtb-intro-card.mtb-span-2 {
    grid-column: span 1;
  }
  .mtb-book-introduction-dashboard .mtb-intro-card.mtb-span-4 {
    grid-column: 1 / -1;
  }
  .mtb-book-introduction-dashboard .mtb-card-outline {
    grid-column: 1 / -1;
  }
}
@media (max-width: 660px) {
  .book-modal-panel:has(.mtb-book-introduction-dashboard) {
    width: 94vw;
    padding-left: 12px;
    padding-right: 12px;
  }
  .mtb-book-introduction-dashboard {
    padding-left: 0;
    padding-right: 0;
  }
  .mtb-book-introduction-dashboard .mtb-intro-hero {
    padding: 19px;
    border-radius: 10px;
  }
  .mtb-book-introduction-dashboard .mtb-intro-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .mtb-book-introduction-dashboard .mtb-intro-card,
  .mtb-book-introduction-dashboard .mtb-intro-card.mtb-span-2,
  .mtb-book-introduction-dashboard .mtb-intro-card.mtb-span-4,
  .mtb-book-introduction-dashboard .mtb-card-outline {
    grid-column: 1;
  }
  .mtb-book-introduction-dashboard .mtb-intro-card-body {
    padding: 14px 15px 16px;
  }
}
</style>
'@)

  [void]$sb.Append('<div class="mtb-book-introduction-dashboard">')
  [void]$sb.Append('<header class="mtb-intro-hero">')
  [void]$sb.Append('<p class="mtb-intro-eyebrow">Mastering the Bible</p>')
  [void]$sb.Append('<h1 class="mtb-intro-title">' + (ConvertTo-HtmlEncoded $bookTitle) + '</h1>')
  [void]$sb.Append('<p class="mtb-intro-subtitle">' + (ConvertTo-HtmlEncoded $introLabel) + '</p>')
  [void]$sb.Append('</header>')

  foreach ($row in $layoutRows) {
    [void]$sb.Append('<section class="mtb-intro-section">')
    [void]$sb.Append('<div class="mtb-intro-section-heading"><h2>' + (ConvertTo-HtmlEncoded ([string]$row.Title)) + '</h2></div>')
    [void]$sb.Append('<div class="mtb-intro-grid">')

    foreach ($card in $row.Cards) {
      $header = [string]$card.Header
      $value = Get-MtbIntroFieldValue -Fields $fields -Key ([string]$card.Key)
      $spanClass = switch ([int]$card.Span) {
        4 { ' mtb-span-4' }
        2 { ' mtb-span-2' }
        default { '' }
      }
      $extraClass = switch ($header.ToLowerInvariant()) {
        'outline' { ' mtb-card-outline' }
        'key verse(s)' { ' mtb-card-key-verses' }
        default { '' }
      }

      $valueHtml = Convert-MtbIntroCellToHtml $value
      $valueHtml = Convert-MtbResourceMarkupToHtml $valueHtml

      [void]$sb.Append('<article class="mtb-intro-card' + $spanClass + $extraClass + '">')
      [void]$sb.Append('<h3 class="mtb-intro-card-header">' + (ConvertTo-HtmlEncoded $header) + '</h3>')
      [void]$sb.Append('<div class="mtb-intro-card-body">' + $valueHtml + '</div>')
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

  $data = Get-ExcelWorksheetValues `
    -WorkbookPath $WorkbookPath `
    -WorksheetName $WorksheetName

  if ($data.Count -lt 3) {
    throw (
      "The '$WorksheetName' worksheet does not contain enough " +
      "chapter overview data."
    )
  }

  $bookDisplay = (Get-Culture).TextInfo.ToTitleCase(
    ($BookSlug -replace '-', ' ')
  )

  $displayTitle = $bookDisplay + " Chapter " + $Chapter

  if (
    $data.Count -gt 0 -and
    $data[0].Count -gt 0 -and
    -not [string]::IsNullOrWhiteSpace([string]$data[0][0])
  ) {
    $displayTitle = [string]$data[0][0]
  }

  $recognizedHeaders = @(
    'chapter theme',
    'purpose & importance',
    'chapter flow',
    'chapter summary',
    'key truths taught',
    'pastoral insights',
    'key words & concepts',
    'christ in this chapter'
  )

  $fieldPairs = New-Object 'System.Collections.Generic.List[object]'

  # Current layout:
  # Row 1: merged chapter title
  # Row 2: headers
  # Row 3: values
  #
  # The parser also supports additional header/value pairs below that row,
  # allowing the remaining four Chapter Overview fields to be added later.
  for ($r = 0; $r -lt ($data.Count - 1); $r++) {
    $headerRow = @($data[$r])
    $valueRow = @($data[$r + 1])

    $recognizedCount = 0
    foreach ($cell in $headerRow) {
      $key = ([string]$cell).Trim().ToLowerInvariant()
      if ($recognizedHeaders -contains $key) {
        $recognizedCount++
      }
    }

    if ($recognizedCount -lt 1) {
      continue
    }

    for ($c = 0; $c -lt $headerRow.Count; $c++) {
      $header = ([string]$headerRow[$c]).Trim()
      if ([string]::IsNullOrWhiteSpace($header)) {
        continue
      }

      $key = $header.ToLowerInvariant()
      if ($recognizedHeaders -notcontains $key) {
        continue
      }

      $value = ''
      if ($c -lt $valueRow.Count) {
        $value = [string]$valueRow[$c]
      }

      $fieldPairs.Add(
        [pscustomobject]@{
          Header = $header
          Value = $value
        }
      )
    }
  }

  if ($fieldPairs.Count -eq 0) {
    throw (
      "No recognized Chapter Overview fields were found in " +
      "'$WorksheetName'."
    )
  }

  $primaryHeaders = New-Object 'System.Collections.Generic.List[string]'
  $primaryValues = New-Object 'System.Collections.Generic.List[string]'
  $secondaryHeaders = New-Object 'System.Collections.Generic.List[string]'
  $secondaryValues = New-Object 'System.Collections.Generic.List[string]'

  foreach ($pair in $fieldPairs) {
    $key = ([string]$pair.Header).Trim().ToLowerInvariant()

    if (
      $key -in @(
        'chapter theme',
        'purpose & importance',
        'chapter flow',
        'chapter summary'
      )
    ) {
      $primaryHeaders.Add([string]$pair.Header)
      $primaryValues.Add([string]$pair.Value)
    }
    else {
      $secondaryHeaders.Add([string]$pair.Header)
      $secondaryValues.Add([string]$pair.Value)
    }
  }

  $groups = New-Object 'System.Collections.Generic.List[object]'

  if ($primaryHeaders.Count -gt 0) {
    $groups.Add(
      [pscustomobject]@{
        Label = 'Chapter at a Glance'
        Headers = $primaryHeaders.ToArray()
        Values = $primaryValues.ToArray()
        Class = 'primary'
      }
    )
  }

  if ($secondaryHeaders.Count -gt 0) {
    $groups.Add(
      [pscustomobject]@{
        Label = 'Study Foundations'
        Headers = $secondaryHeaders.ToArray()
        Values = $secondaryValues.ToArray()
        Class = 'secondary'
      }
    )
  }

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
  width: 100%; max-width: 1600px; margin: 0 auto; padding: 2px 4px 30px;
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
  grid-column: span 3; min-width: 0; overflow: hidden; border: 1px solid var(--mtb-border);
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
@media (max-width: 1100px) {
  .mtb-chapter-overview-dashboard .mtb-overview-card,
  .mtb-chapter-overview-dashboard [class*='mtb-overview-card-'] { grid-column: span 6; }
}
@media (max-width: 660px) {
  .mtb-chapter-overview-dashboard .mtb-overview-grid { grid-template-columns: 1fr; }
  .mtb-chapter-overview-dashboard .mtb-overview-card,
  .mtb-chapter-overview-dashboard [class*='mtb-overview-card-'] { grid-column: 1 / -1; }
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
      if ([string]::IsNullOrWhiteSpace($header)) {
        continue
      }

      $value = ''
      if ($i -lt $group.Values.Count) {
        $value = [string]$group.Values[$i]
      }

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
    if ($sheetName -match '^Overview(?:\s+Chapter)?\s+(?<chapter>\d+)$') {
      $chapter = [int]$Matches['chapter']
      $path = Write-MtbChapterOverviewFromExcel -WorkbookPath $WorkbookPath -OutBookDir $OutBookDir -BookSlug $BookSlug -Chapter $chapter -WorksheetName $sheetName
      if (-not [string]::IsNullOrWhiteSpace([string]$path)) {
        $writtenNames.Add((Split-Path $path -Leaf))
      }
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

function Get-MtbStandardSectionHeading([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return '' }

  $heading = ([string]$value) -replace "`r`n", "`n" -replace "`r", "`n"
  $heading = ($heading -split "`n", 2)[0].Trim()

  # A section banner must be only: verse reference + outline title.
  # Remove Chapter Flow commentary accidentally carried after the title,
  # such as "(1–9): God exposes...".  Use a look-ahead so the title itself
  # is preserved exactly as entered in the Section cell.
  $commentary = [regex]::Match(
    $heading,
    '\s+\(\s*\d+[A-Za-z]?\s*(?:[-–—]\s*\d+[A-Za-z]?)?\s*\)\s*:',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )
  if ($commentary.Success) {
    $heading = $heading.Substring(0, $commentary.Index).Trim()
  }

  return $heading
}

function Get-MtbStudyHeaderParts([string]$header) {
  $normalized = if ($null -eq $header) { '' } else { ([string]$header) -replace "`r`n", "`n" -replace "`r", "`n" }
  $lines = @($normalized -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $title = if ($lines.Count -gt 0) { $lines[0] } else { '' }
  $prompt = if ($lines.Count -gt 1) { ($lines[1..($lines.Count - 1)] -join ' ') } else { '' }

  # Some workbooks store the helper question on the same line as the title,
  # for example: Section Summary(What happens in this passage?).
  # Keep the helper text available as Prompt, but never show it in the card title.
  if ($title -match '^(?<title>.*?)\s*\((?<prompt>.*)\)\s*$') {
    $title = $Matches['title'].Trim()
    if ([string]::IsNullOrWhiteSpace($prompt)) {
      $prompt = $Matches['prompt'].Trim()
    }
  }

  return @{ Title = $title; Prompt = $prompt }
}

function Get-MtbVerseStudyDisplayTitle([string]$title) {
  if ([string]::IsNullOrWhiteSpace($title)) { return '' }

  $clean = ([string]$title).Trim()
  $key = $clean.ToLowerInvariant()

  # Approved five-card MTB verse-by-verse structure.
  if ($key -match '^key explanations?(?:\s*\(.*\))?$') { return 'Key Explanations' }
  if ($key -match '^main idea(?:\s*\(.*\))?$') { return 'Main Idea' }
  if ($key -match '^verse explanation(?:\s*\(.*\))?$') { return 'Verse Explanation' }
  if ($key -match '^christ connection(?:\s*\(.*\))?$') { return 'Christ Connection' }
  if ($key -match '^application(?:\s*\(.*\))?$') { return 'Application' }

  # Transitional aliases permit older sheets to render under the approved
  # titles, but current workbook headings are always used directly.
  if ($key -match '^observation(?:\s*\(.*\))?$') { return 'Key Explanations' }
  if ($key -match '^understanding(?:\s*\(.*\))?$') { return 'Main Idea' }
  if ($key -match '^(?:exposition|expository\s*&\s*lexical notes?|fuller explanation)$') { return 'Verse Explanation' }
  if ($key -match '^(?:remarks|insights,?\s*pastoral observations,?\s*(?:&|and)?\s*remarks\.?)$') { return 'Application' }

  return $clean
}

function Get-MtbSectionOutlineTitlesFromWorkbook {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [int] $Chapter
  )

  $sheetName = ("Overview {0:D3}" -f $Chapter)
  try {
    $overviewData = Get-ExcelWorksheetValues -WorkbookPath $WorkbookPath -WorksheetName $sheetName
  }
  catch {
    return @()
  }

  $chapterFlow = ''
  for ($r = 0; $r -lt $overviewData.Count; $r++) {
    $row = $overviewData[$r]
    for ($c = 0; $c -lt $row.Count; $c++) {
      if (([string]$row[$c]).Trim().ToLowerInvariant() -eq 'chapter flow') {
        if (($r + 1) -lt $overviewData.Count -and $c -lt $overviewData[$r + 1].Count) {
          $chapterFlow = [string]$overviewData[$r + 1][$c]
        }
        break
      }
    }
    if (-not [string]::IsNullOrWhiteSpace($chapterFlow)) { break }
  }

  if ([string]::IsNullOrWhiteSpace($chapterFlow)) { return @() }

  $normalized = $chapterFlow -replace "`r`n", "`n" -replace "`r", "`n"
  $titles = New-Object 'System.Collections.Generic.List[string]'

  # Standard Chapter Flow entries are written as:
  #   Outline Title (1–4): explanatory sentence
  # They may be on separate lines or combined in one paragraph. Capture each
  # title by locating its parenthetical verse range, without treating the
  # explanatory sentence as part of the title.
  $rx = [regex]::new(
    '(?ims)(?:^|(?<=\.\s)|(?<=\n))\s*[•\-]?\s*(?<title>[^\n]*?\S)\s*\((?<range>\d+(?:[–-]\d+)?)\)\s*:'
  )

  foreach ($m in $rx.Matches($normalized)) {
    $title = ([string]$m.Groups['title'].Value).Trim()
    # Remove any leading book/reference if a workbook includes it.
    $title = $title -replace '^\s*(?:[1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+\d+:\d+(?:[–-]\d+)?\s*[—-]\s*', ''
    if (-not [string]::IsNullOrWhiteSpace($title)) { $titles.Add($title) }
  }

  # Some workbooks put one Chapter Flow item on each line without a summary.
  if ($titles.Count -eq 0) {
    foreach ($line in ($normalized -split "`n")) {
      $clean = $line.Trim() -replace '^[•\-]\s*', ''
      if ($clean -match '^(?<title>.*?)\s*\(\d+(?:[–-]\d+)?\)\s*$') {
        $title = $Matches['title'].Trim()
        if (-not [string]::IsNullOrWhiteSpace($title)) { $titles.Add($title) }
      }
    }
  }

  return $titles.ToArray()
}

function Convert-MtbStudyCellToHtml([string]$text, [string]$header, [switch]$EmphasizeLabels) {
  if ([string]::IsNullOrWhiteSpace($text)) {
    return '<p class="mtb-study-empty">No content added yet.</p>'
  }

  # Encode ordinary text first, then convert MTB [[label|type:id]] markup
  # into a real resource link. This same helper is used in every study-card
  # output path below: bullets, observations, labeled paragraphs, and prose.
  function Convert-MtbStudyTextFragment([string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) { return '' }

    $html = ConvertTo-HtmlEncoded $value
    return Convert-MtbResourceMarkupToHtml $html
  }

  $normalized = ([string]$text) -replace "`r`n", "`n" -replace "`r", "`n"
  $trimmed = $normalized.Trim()
  $lines = @($trimmed -split "`n")
  $nonEmpty = @(
    $lines |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  )
  $bulletLines = @(
    $nonEmpty |
      Where-Object { $_.Trim() -match '^[•\-]\s*' }
  )

  # All-bullet cells
  if ($nonEmpty.Count -gt 0 -and $bulletLines.Count -eq $nonEmpty.Count) {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('<ul class="mtb-study-list">')

    foreach ($line in $nonEmpty) {
      $item = ($line.Trim() -replace '^[•\-]\s*', '').Trim()

      if (
        $EmphasizeLabels -and
        $item -notmatch '\[\[' -and
        $item -match '^(?<label>[^:]{2,70}):\s*(?<body>.*)$'
      ) {
        $labelHtml = Convert-MtbStudyTextFragment $Matches['label'].Trim()
        $bodyHtml = Convert-MtbStudyTextFragment $Matches['body'].Trim()

        [void]$sb.Append(
          '<li><strong>' +
          $labelHtml +
          ':</strong> ' +
          $bodyHtml +
          '</li>'
        )
      }
      else {
        $itemHtml = Convert-MtbStudyTextFragment $item
        [void]$sb.Append('<li>' + $itemHtml + '</li>')
      }
    }

    [void]$sb.Append('</ul>')
    return $sb.ToString()
  }

  # Observation rows commonly use one quoted phrase followed by
  # a dash, colon, or similar separator and an explanation.
  if ($header -match '(?i)^(Observation|Key Explanations?)') {
    $items = @(
      $nonEmpty |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )

    if ($items.Count -gt 0) {
      $sb = New-Object System.Text.StringBuilder
      [void]$sb.Append('<div class="mtb-study-observations">')

      foreach ($line in $items) {
        $item = $line.Trim()

        if (
          $item -notmatch '\[\[' -and
          $item -match '^(?<phrase>[“"].+?[”"]|[^\-–—:]{2,90})\s*[\-–—:]\s*(?<body>.+)$'
        ) {
          $phraseHtml = Convert-MtbStudyTextFragment $Matches['phrase'].Trim()
          $bodyHtml = Convert-MtbStudyTextFragment $Matches['body'].Trim()

          [void]$sb.Append(
            '<div class="mtb-study-observation">' +
            '<strong>' + $phraseHtml + '</strong>' +
            '<span>' + $bodyHtml + '</span>' +
            '</div>'
          )
        }
        else {
          $itemHtml = Convert-MtbStudyTextFragment $item

          [void]$sb.Append(
            '<div class="mtb-study-observation">' +
            '<span>' + $itemHtml + '</span>' +
            '</div>'
          )
        }
      }

      [void]$sb.Append('</div>')
      return $sb.ToString()
    }
  }

  # Ordinary paragraphs and label-led paragraphs
  $blocks = [regex]::Split($trimmed, "`n\s*`n")
  $sb = New-Object System.Text.StringBuilder

  foreach ($block in $blocks) {
    $b = $block.Trim()
    if ([string]::IsNullOrWhiteSpace($b)) { continue }

    if (
      $EmphasizeLabels -and
      $b -notmatch '\[\[' -and
      $b -match '^(?s)(?<label>[^:`n]{2,70}):\s*(?<body>.*)$'
    ) {
      $labelHtml = Convert-MtbStudyTextFragment $Matches['label'].Trim()
      $bodyHtml = Convert-MtbStudyTextFragment $Matches['body'].Trim()
      $bodyHtml = $bodyHtml -replace "`n", '<br />'

      [void]$sb.Append(
        '<p><strong>' +
        $labelHtml +
        ':</strong> ' +
        $bodyHtml +
        '</p>'
      )
    }
    else {
      $paragraphHtml = Convert-MtbStudyTextFragment $b
      $paragraphHtml = $paragraphHtml -replace "`n", '<br />'
      [void]$sb.Append('<p>' + $paragraphHtml + '</p>')
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

$script:MtbAllBiblesVerseLookup = $null

function Get-MtbCleanBibleReference {
  param(
    [Parameter(Mandatory)] [string] $Reference
  )

  if ([string]::IsNullOrWhiteSpace($Reference)) {
    return ''
  }

  $value = $Reference.Trim()

  # Older ALL_BIBLES rows may include the translation in the reference cell.
  $value = $value -replace '\s*\((?i:NKJV|NLT)\)\s*$', ''
  $value = $value -replace '\s+', ' '

  return $value.Trim()
}

function Initialize-MtbAllBiblesVerseLookup {
  if ($null -ne $script:MtbAllBiblesVerseLookup) {
    return
  }

  $script:MtbAllBiblesVerseLookup = @{
    NKJV = @{}
    NLT = @{}
  }

  $biblePath = Join-Path $SITE_ROOT 'assets\ALL_BIBLES.xlsm'

  if (-not (Test-Path -LiteralPath $biblePath -PathType Leaf)) {
    throw (
      "Required Bible source workbook not found: " +
      $biblePath
    )
  }

  Write-Host (
    "Loading verse text only from ALL_BIBLES.xlsm..."
  ) -ForegroundColor Cyan

  $rows = Get-ExcelWorksheetValues `
    -WorkbookPath $biblePath `
    -WorksheetName 'ALL_BIBLES'

  if ($rows.Count -lt 2) {
    throw (
      "The ALL_BIBLES worksheet does not contain verse rows."
    )
  }

  for ($rowIndex = 1; $rowIndex -lt $rows.Count; $rowIndex++) {
    $row = @($rows[$rowIndex])

    if ($row.Count -lt 2) {
      continue
    }

    $rawReference = ([string]$row[0]).Trim()
    $fullVerse = ([string]$row[1]).Trim()

    if (
      [string]::IsNullOrWhiteSpace($rawReference) -or
      [string]::IsNullOrWhiteSpace($fullVerse)
    ) {
      continue
    }

    $cleanReference = Get-MtbCleanBibleReference $rawReference
    $normalizedReference = Normalize-MtbBibleReference $cleanReference

    if ([string]::IsNullOrWhiteSpace($normalizedReference)) {
      continue
    }

    $translation = ''

    # Determine translation from either column.
    if (
      $rawReference -match '(?i)\(NKJV\)\s*$' -or
      $fullVerse -match '(?i)\(NKJV\)\s*$'
    ) {
      $translation = 'NKJV'
    }
    elseif (
      $rawReference -match '(?i)\(NLT\)\s*$' -or
      $fullVerse -match '(?i)\(NLT\)\s*$'
    ) {
      $translation = 'NLT'
    }
    else {
      # Historical ALL_BIBLES pattern:
      # NKJV row is explicitly marked (NKJV); the unmarked row for the same
      # reference contains the NLT wording.
      $translation = 'NLT'
    }

    if ($translation -eq 'NKJV') {
      if ($fullVerse -notmatch '(?i)\(NKJV\)\s*$') {
        $fullVerse = $fullVerse + ' (NKJV)'
      }

      $script:MtbAllBiblesVerseLookup.NKJV[
        $normalizedReference
      ] = $fullVerse

      continue
    }

    if ($fullVerse -notmatch '(?i)\(NLT\)\s*$') {
      $fullVerse = $fullVerse + ' (NLT)'
    }

    $script:MtbAllBiblesVerseLookup.NLT[
      $normalizedReference
    ] = $fullVerse
  }

  Write-Host (
    (
      "Loaded ALL_BIBLES verse text: NKJV={0}, NLT={1}" -f
      $script:MtbAllBiblesVerseLookup.NKJV.Count,
      $script:MtbAllBiblesVerseLookup.NLT.Count
    )
  ) -ForegroundColor Green
}

function Get-MtbAllBiblesVerse {
  param(
    [Parameter(Mandatory)] [string] $Reference,
    [Parameter(Mandatory)]
    [ValidateSet('NKJV', 'NLT')]
    [string] $Translation
  )

  $cleanReference = Get-MtbCleanBibleReference $Reference
  $normalizedReference = Normalize-MtbBibleReference $cleanReference

  if ([string]::IsNullOrWhiteSpace($normalizedReference)) {
    return ''
  }

  Initialize-MtbAllBiblesVerseLookup

  $translationLookup =
    $script:MtbAllBiblesVerseLookup[$Translation]

  if ($translationLookup.ContainsKey($normalizedReference)) {
    return [string]$translationLookup[$normalizedReference]
  }

  return ''
}

function Get-MtbStudyNkjvText {
  param(
    [Parameter(Mandatory)] [string] $CellValue,
    [Parameter(Mandatory)] [string] $BookSlug
  )

  if ([string]::IsNullOrWhiteSpace($CellValue)) {
    return ''
  }

  $trimmed = $CellValue.Trim()
  $parts = Get-MtbReferenceParts (
    Get-MtbCleanBibleReference $trimmed
  )

  # A completed Scripture cell is preserved as written.
  if ($null -eq $parts) {
    return $trimmed
  }

  $text = Get-MtbAllBiblesVerse `
    -Reference $trimmed `
    -Translation 'NKJV'

  if (-not [string]::IsNullOrWhiteSpace($text)) {
    return $text.Trim()
  }

  Write-Warning (
    "NKJV text not found in ALL_BIBLES for: " + $trimmed
  )

  return (
    (Get-MtbCleanBibleReference $trimmed) +
    ' (NKJV)'
  )
}

function Get-MtbStudyNltText {
  param(
    [Parameter(Mandatory)] [string] $CellValue,
    [Parameter(Mandatory)] [string] $BookSlug
  )

  if ([string]::IsNullOrWhiteSpace($CellValue)) {
    return ''
  }

  $trimmed = $CellValue.Trim()
  $parts = Get-MtbReferenceParts (
    Get-MtbCleanBibleReference $trimmed
  )

  # A completed Scripture cell is preserved as written.
  if ($null -eq $parts) {
    if ($trimmed -notmatch '(?i)\(NLT\)\s*$') {
      return $trimmed + ' (NLT)'
    }

    return $trimmed
  }

  $text = Get-MtbAllBiblesVerse `
    -Reference $trimmed `
    -Translation 'NLT'

  if (-not [string]::IsNullOrWhiteSpace($text)) {
    return $text.Trim()
  }

  Write-Warning (
    "NLT text not found in ALL_BIBLES for: " + $trimmed
  )

  return (
    (Get-MtbCleanBibleReference $trimmed) +
    ' (NLT)'
  )
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

    $translationClass = ''

    if ($translation -eq 'NLT') {
      $translationClass = ' mtb-study-scripture-nlt'
    }
    elseif ($translation -eq 'NKJV') {
      $translationClass = ' mtb-study-scripture-nkjv'
    }

    [void]$sb.Append(
      '<blockquote class="mtb-study-scripture-block' +
      $translationClass +
      '">'
    )
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


# --------------------------------------------------
# Chapter Study Bible lookup
#
# Source of truth:
#   assets\ALL_BIBLES.xlsm
#
# Generated Strong's cache:
#   assets\js\bibles-json-strongs\nkjv\<book>.json
#
# Normal Chapter Study generation reads only the small per-book JSON files.
# ALL_BIBLES.xlsm is opened only when its timestamp is newer than the
# Strong's JSON manifest (or when the cache is missing).
# --------------------------------------------------

$script:MtbStudyBibleCache = @{}
$script:MtbStrongsJsonChecked = $false

function Normalize-MtbBibleReference([string]$Reference) {
  if ([string]::IsNullOrWhiteSpace($Reference)) { return '' }

  $value = ([string]$Reference).Trim()
  $value = $value -replace '[\u2010\u2011\u2012\u2013\u2014\u2212]', '-'
  $value = $value -replace '\s+', ' '

  if ($value -match '^(?<book>[1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(?<chapter>\d+)\s*:\s*(?<verse>\d+)$') {
    $book = ($Matches['book'] -replace '\s+', ' ').Trim()
    return ($book + ' ' + $Matches['chapter'] + ':' + $Matches['verse']).ToLowerInvariant()
  }

  return ''
}

function ConvertTo-MtbBookSlug([string]$BookName) {
  if ([string]::IsNullOrWhiteSpace($BookName)) { return '' }

  $slug = $BookName.Trim().ToLowerInvariant()
  $slug = $slug -replace '&', 'and'
  $slug = $slug -replace '[^a-z0-9]+', '-'
  return $slug.Trim('-')
}

function Get-MtbReferenceParts([string]$Reference) {
  $normalized = Normalize-MtbBibleReference $Reference
  if ([string]::IsNullOrWhiteSpace($normalized)) { return $null }

  if ($normalized -match '^(?<book>.+?)\s+(?<chapter>\d+):(?<verse>\d+)$') {
    return [pscustomobject]@{
      Key       = $normalized
      BookName  = $Matches['book']
      BookSlug  = ConvertTo-MtbBookSlug $Matches['book']
      Chapter   = [int]$Matches['chapter']
      Verse     = [int]$Matches['verse']
    }
  }

  return $null
}

function Remove-MtbLeadingVerseReference([string]$FullVerse, [string]$Reference) {
  if ([string]::IsNullOrWhiteSpace($FullVerse)) { return '' }

  $value = $FullVerse.Trim()
  $parts = Get-MtbReferenceParts $Reference
  if ($null -eq $parts) { return $value }

  $bookPattern = [regex]::Escape($parts.BookName) -replace '\\ ', '\s+'
  $prefixPattern = '^\s*' + $bookPattern + '\s+' + $parts.Chapter + '\s*:\s*' + $parts.Verse + '\s*'
  $value = [regex]::Replace($value, $prefixPattern, '', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  return $value.Trim()
}

function Export-MtbStrongsBibleJson {
  $biblePath = Join-Path $SITE_ROOT 'assets\ALL_BIBLES.xlsm'
  $strongsDir = Join-Path $SITE_ROOT 'assets\js\bibles-json-strongs\nkjv'
  $manifestPath = Join-Path $strongsDir '.manifest.json'

  if (-not (Test-Path -LiteralPath $biblePath)) {
    Write-Warning "Strong's source workbook not found: $biblePath"
    return $false
  }

  Ensure-Path $strongsDir

  Write-Host "ALL_BIBLES.xlsm changed. Rebuilding Strong's NKJV book JSON files..." -ForegroundColor Cyan
  $timer = [System.Diagnostics.Stopwatch]::StartNew()

  try {
    $rows = Get-ExcelWorksheetValues -WorkbookPath $biblePath -WorksheetName 'ALL_BIBLES'
  }
  catch {
    Write-Warning ("Unable to read Strong's source workbook '{0}': {1}" -f $biblePath, $_.Exception.Message)
    return $false
  }

  if ($rows.Count -lt 2) {
    Write-Warning "ALL_BIBLES worksheet does not contain verse rows."
    return $false
  }

  $books = @{}

  for ($i = 1; $i -lt $rows.Count; $i++) {
    if ($rows[$i].Count -lt 2) { continue }

    $reference = ([string]$rows[$i][0]).Trim()
    $fullVerse = ([string]$rows[$i][1]).Trim()

    if ([string]::IsNullOrWhiteSpace($reference) -or [string]::IsNullOrWhiteSpace($fullVerse)) {
      continue
    }

    if ($fullVerse -notmatch '(?i)\(NKJV\)\s*$') { continue }

    $parts = Get-MtbReferenceParts $reference
    if ($null -eq $parts) { continue }

    $bookSlug = $parts.BookSlug
    if (-not $books.ContainsKey($bookSlug)) {
      $books[$bookSlug] = [ordered]@{
        translation  = 'NKJV'
        book         = (Get-Culture).TextInfo.ToTitleCase($parts.BookName)
        generatedUtc = [DateTime]::UtcNow.ToString('o')
        source       = 'ALL_BIBLES.xlsm'
        verses       = [ordered]@{}
      }
    }

    # Store the complete source verse so the existing renderer receives:
    # reference + text + Strong's markers + (NKJV)
    $books[$bookSlug].verses[$parts.Key] = $fullVerse
  }

  foreach ($bookSlug in $books.Keys) {
    $outPath = Join-Path $strongsDir ($bookSlug + '.json')
    $json = $books[$bookSlug] | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText($outPath, $json, [System.Text.UTF8Encoding]::new($false))
  }

  $sourceInfo = Get-Item -LiteralPath $biblePath
  $manifest = [ordered]@{
    sourceFile               = 'ALL_BIBLES.xlsm'
    sourceLastWriteTimeUtc    = $sourceInfo.LastWriteTimeUtc.ToString('o')
    generatedUtc              = [DateTime]::UtcNow.ToString('o')
    bookCount                 = $books.Count
  }

  [System.IO.File]::WriteAllText(
    $manifestPath,
    ($manifest | ConvertTo-Json -Depth 4),
    [System.Text.UTF8Encoding]::new($false)
  )

  $timer.Stop()
  Write-Host ("Strong's JSON rebuilt for {0} books in {1:n1} seconds." -f $books.Count, $timer.Elapsed.TotalSeconds) -ForegroundColor Green
  return $true
}

function Test-MtbStrongsJsonCurrent {
  $biblePath = Join-Path $SITE_ROOT 'assets\ALL_BIBLES.xlsm'
  $strongsDir = Join-Path $SITE_ROOT 'assets\js\bibles-json-strongs\nkjv'
  $manifestPath = Join-Path $strongsDir '.manifest.json'

  if (-not (Test-Path -LiteralPath $biblePath)) {
    Write-Warning "Strong's source workbook not found: $biblePath"
    return $false
  }

  if (-not (Test-Path -LiteralPath $manifestPath)) {
    Write-Host "Strong's JSON manifest not found; rebuild required." -ForegroundColor Yellow
    return $false
  }

  # A manifest by itself is not enough. If no per-book JSON files exist,
  # the cache is incomplete and must be rebuilt.
  $bookJsonFiles = @(Get-ChildItem -LiteralPath $strongsDir -Filter '*.json' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne '.manifest.json' })

  if ($bookJsonFiles.Count -eq 0) {
    Write-Host "No Strong's book JSON files found; rebuild required." -ForegroundColor Yellow
    return $false
  }

  try {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($null -eq $manifest -or [string]::IsNullOrWhiteSpace([string]$manifest.sourceLastWriteTimeUtc)) {
      return $false
    }

    $recordedUtc = [DateTime]::Parse(
      [string]$manifest.sourceLastWriteTimeUtc,
      [System.Globalization.CultureInfo]::InvariantCulture,
      [System.Globalization.DateTimeStyles]::RoundtripKind
    ).ToUniversalTime()

    $actualUtc = (Get-Item -LiteralPath $biblePath).LastWriteTimeUtc

    # A one-second tolerance avoids filesystem timestamp precision differences.
    return ($actualUtc -le $recordedUtc.AddSeconds(1))
  }
  catch {
    return $false
  }
}

function Ensure-MtbStrongsJsonCurrent {
  if ($script:MtbStrongsJsonChecked) { return }
  $script:MtbStrongsJsonChecked = $true

  if (Test-MtbStrongsJsonCurrent) {
    Write-Host "Strong's NKJV JSON cache is current." -ForegroundColor DarkGreen
    return
  }

  Write-Host "Strong's NKJV JSON cache is missing or outdated. Rebuilding now..." -ForegroundColor Cyan
  $rebuilt = Export-MtbStrongsBibleJson

  if (-not $rebuilt) {
    Write-Warning "Strong's JSON rebuild did not complete."
  }
}

function Get-MtbJsonPropertyValue($Object, [string]$Name) {
  if ($null -eq $Object) { return $null }

  if ($Object -is [System.Collections.IDictionary]) {
    if ($Object.Contains($Name)) { return $Object[$Name] }
    return $null
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($null -ne $property) { return $property.Value }
  return $null
}

function Get-MtbVerseFromExistingBookJson($Json, [int]$Chapter, [int]$Verse) {
  if ($null -eq $Json) { return '' }

  # Common schema:
  # { chapters: { "1": { "1": "text" } } }
  $chapters = Get-MtbJsonPropertyValue $Json 'chapters'
  if ($null -ne $chapters) {
    $chapterNode = Get-MtbJsonPropertyValue $chapters ([string]$Chapter)
    if ($null -ne $chapterNode) {
      $directVerse = Get-MtbJsonPropertyValue $chapterNode ([string]$Verse)
      if ($null -ne $directVerse) {
        if ($directVerse -is [string]) { return ([string]$directVerse).Trim() }

        foreach ($field in @('text','verseText','content')) {
          $candidate = Get-MtbJsonPropertyValue $directVerse $field
          if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
            return ([string]$candidate).Trim()
          }
        }
      }

      # Alternate schema:
      # { chapters: { "1": [ { verse: 1, text: "..." } ] } }
      if ($chapterNode -is [System.Collections.IEnumerable] -and -not ($chapterNode -is [string])) {
        foreach ($item in $chapterNode) {
          $number = Get-MtbJsonPropertyValue $item 'verse'
          if ($null -eq $number) { $number = Get-MtbJsonPropertyValue $item 'number' }

          if ([string]$number -eq [string]$Verse) {
            foreach ($field in @('text','verseText','content')) {
              $candidate = Get-MtbJsonPropertyValue $item $field
              if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
                return ([string]$candidate).Trim()
              }
            }
          }
        }
      }
    }
  }

  # Alternate schema:
  # { verses: { "Ruth 1:1": "..." } }
  $verses = Get-MtbJsonPropertyValue $Json 'verses'
  if ($null -ne $verses) {
    foreach ($property in $verses.PSObject.Properties) {
      if ($property.Name -match '(?i)\s' + $Chapter + ':' + $Verse + '$') {
        return ([string]$property.Value).Trim()
      }
    }
  }

  return ''
}

function Initialize-MtbStudyBibleBook([string]$BookSlug) {
  if ([string]::IsNullOrWhiteSpace($BookSlug)) { return }

  if ($script:MtbStudyBibleCache.ContainsKey($BookSlug)) { return }

  Ensure-MtbStrongsJsonCurrent

  $strongsPath = Join-Path $SITE_ROOT ("assets\js\bibles-json-strongs\nkjv\" + $BookSlug + '.json')
  $nltPath = Join-Path $SITE_ROOT ("assets\js\bibles-json\nlt\" + $BookSlug + '.json')

  $strongsJson = $null
  $nltJson = $null

  # Even when the manifest is current, verify that the requested book file exists.
  # If it is missing, force one rebuild before giving up.
  if (-not (Test-Path -LiteralPath $strongsPath)) {
    Write-Host ("Strong's JSON for '{0}' is missing. Forcing cache rebuild..." -f $BookSlug) -ForegroundColor Yellow
    $script:MtbStrongsJsonChecked = $false
    [void](Export-MtbStrongsBibleJson)
    $script:MtbStrongsJsonChecked = $true
  }

  if (Test-Path -LiteralPath $strongsPath) {
    try {
      $strongsJson = Get-Content -LiteralPath $strongsPath -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
      Write-Warning ("Unable to read Strong's JSON '{0}': {1}" -f $strongsPath, $_.Exception.Message)
    }
  }
  else {
    Write-Warning "Strong's NKJV JSON not found for book: $BookSlug"
  }

  if (Test-Path -LiteralPath $nltPath) {
    try {
      $nltJson = Get-Content -LiteralPath $nltPath -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
      Write-Warning ("Unable to read NLT JSON '{0}': {1}" -f $nltPath, $_.Exception.Message)
    }
  }
  else {
    Write-Warning "NLT JSON not found for book: $BookSlug"
  }

  $script:MtbStudyBibleCache[$BookSlug] = @{
    StrongNKJV = $strongsJson
    NLT        = $nltJson
  }
}

function Get-MtbStrongNkjvVerse([string]$BookSlug, [string]$NormalizedReference) {
  Initialize-MtbStudyBibleBook $BookSlug

  if (-not $script:MtbStudyBibleCache.ContainsKey($BookSlug)) { return '' }

  $json = $script:MtbStudyBibleCache[$BookSlug]['StrongNKJV']
  if ($null -eq $json) { return '' }

  $verses = Get-MtbJsonPropertyValue $json 'verses'
  if ($null -eq $verses) { return '' }

  $property = $verses.PSObject.Properties[$NormalizedReference]
  if ($null -ne $property) {
    return ([string]$property.Value).Trim()
  }

  return ''
}

function Expand-MtbStudyScriptureReference([string]$CellValue, [string]$BookSlug) {
  if ([string]::IsNullOrWhiteSpace($CellValue)) { return $CellValue }

  $trimmed = ([string]$CellValue).Trim()
  $parts = Get-MtbReferenceParts $trimmed

  # Only a cell consisting entirely of one verse reference is expanded.
  # OVERVIEW, headings, verse ranges, and completed Scripture cells remain unchanged.
  if ($null -eq $parts) { return $CellValue }

  $effectiveBookSlug = if ([string]::IsNullOrWhiteSpace($BookSlug)) { $parts.BookSlug } else { $BookSlug }
  Initialize-MtbStudyBibleBook $effectiveBookSlug

  $blocks = New-Object 'System.Collections.Generic.List[string]'

  $nkjv = Get-MtbStrongNkjvVerse $effectiveBookSlug $parts.Key
  if (-not [string]::IsNullOrWhiteSpace($nkjv)) {
    $blocks.Add($nkjv)
  }
  else {
    Write-Warning "Strong's NKJV text not found for Bible reference: $trimmed"
  }

  $nltJson = $script:MtbStudyBibleCache[$effectiveBookSlug]['NLT']
  $nltText = Get-MtbVerseFromExistingBookJson $nltJson $parts.Chapter $parts.Verse

  if (-not [string]::IsNullOrWhiteSpace($nltText)) {
    # Existing NLT JSON normally stores only the verse body.
    # Add the reference and translation label expected by the Chapter Study renderer.
    if ($nltText -match '(?i)\(NLT\)\s*$') {
      if ($nltText -match '^\s*[1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d+:\d+') {
        $blocks.Add($nltText.Trim())
      }
      else {
        $blocks.Add(($trimmed + ' ' + $nltText.Trim()))
      }
    }
    else {
      $blocks.Add(($trimmed + ' ' + $nltText.Trim() + ' (NLT)'))
    }
  }
  else {
    Write-Warning "NLT text not found in existing JSON for Bible reference: $trimmed"
  }

  if ($blocks.Count -eq 0) { return $CellValue }
  return ($blocks -join "`r`n`r`n")
}


function Get-MtbStudyIconHtml([string]$title) {
  $key = ([string]$title).Trim().ToLowerInvariant()
  $icon = '&#9679;'

  if ($key -match 'section summary|summary') { $icon = '&#8801;' }
  elseif ($key -match 'key observations|observation') { $icon = '&#9678;' }
  elseif ($key -match 'main idea') { $icon = '&#9733;' }
  elseif ($key -match '^understanding') { $icon = '&#9672;' }
  elseif ($key -match 'historical.*setting') { $icon = '&#8982;' }
  elseif ($key -match 'historical.*notes') { $icon = '&#9638;' }
  elseif ($key -match 'foundational truths') { $icon = '&#9635;' }
  elseif ($key -match 'section insights|going deeper') { $icon = '&#10022;' }
  elseif ($key -match 'christ connection') { $icon = '&#10013;' }
  elseif ($key -match 'dwelling in the word') { $icon = '&#9825;' }
  elseif ($key -match 'seeds for the sower|^remarks') { $icon = '&#9998;' }
  elseif ($key -match 'how shall we then live|healthy church culture|community') { $icon = '&#8962;' }
  elseif ($key -match 'expository|lexical') { $icon = '&#9636;' }
  elseif ($key -match 'nuggets') { $icon = '&#10022;' }

  return '<span class="mtb-study-title-icon" aria-hidden="true">' + $icon + '</span>'
}

function New-MtbChapterStudyHtmlFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $BookSlug,
    [Parameter(Mandatory)] [int] $Chapter,
    [Parameter(Mandatory)] [string] $WorksheetName
  )

  $data = Get-ExcelWorksheetValues `
    -WorkbookPath $WorkbookPath `
    -WorksheetName $WorksheetName

  if ($data.Count -lt 5) {
    throw (
      "The '$WorksheetName' worksheet does not contain enough " +
      "chapter study data."
    )
  }

  $bookDisplay = (Get-Culture).TextInfo.ToTitleCase(
    ($BookSlug -replace '-', ' ')
  )

  $sections = New-Object 'System.Collections.Generic.List[object]'

  $hasLegacyMarkers = $false
  foreach ($row in $data) {
    if (
      $row.Count -gt 0 -and
      ([string]$row[0]).Trim() -match '^(?i)(Overview|VERSE-BY-VERSE|WRAP-UP)$'
    ) {
      $hasLegacyMarkers = $true
      break
    }
  }

  if ($hasLegacyMarkers) {
    # Legacy workbook parser.
    $i = 2

    while ($i -lt $data.Count) {
      $marker = ([string]$data[$i][0]).Trim()

      if ($marker -notmatch '^(?i)Overview$') {
        $i++
        continue
      }

      $passage = Get-MtbStandardSectionHeading ([string]$data[$i][1])

      if ($i + 4 -ge $data.Count) {
        break
      }

      $overviewHeaders1 = $data[$i + 1]
      $overviewValues1 = $data[$i + 2]
      $overviewHeaders2 = $data[$i + 3]
      $overviewValues2 = $data[$i + 4]
      $i += 5

      $verseHeaders = @()
      $verseRows = New-Object 'System.Collections.Generic.List[object]'

      if (
        $i -lt $data.Count -and
        ([string]$data[$i][0]).Trim() -match '^(?i)VERSE-BY-VERSE$'
      ) {
        if ([string]::IsNullOrWhiteSpace($passage)) {
          $passage = ([string]$data[$i][1]).Trim()
        }

        $i++

        if ($i -lt $data.Count) {
          $verseHeaders = $data[$i]
          $i++
        }

        while ($i -lt $data.Count) {
          $nextMarker = ([string]$data[$i][0]).Trim()

          if (
            $nextMarker -match '^(?i)WRAP-UP$' -or
            $nextMarker -match '^(?i)Overview$'
          ) {
            break
          }

          if (
            -not [string]::IsNullOrWhiteSpace(
              [string]$data[$i][0]
            )
          ) {
            $verseRows.Add($data[$i])
          }

          $i++
        }
      }

      $wrapHeaders = @()
      $wrapValues = @()

      if (
        $i -lt $data.Count -and
        ([string]$data[$i][0]).Trim() -match '^(?i)WRAP-UP$'
      ) {
        $i++

        if ($i -lt $data.Count) {
          $wrapHeaders = $data[$i]
          $i++
        }

        if ($i -lt $data.Count) {
          $wrapValues = $data[$i]
          $i++
        }
      }

      $sections.Add(
        [pscustomobject]@{
          Passage = $passage
          OverviewHeaders1 = $overviewHeaders1
          OverviewValues1 = $overviewValues1
          OverviewHeaders2 = $overviewHeaders2
          OverviewValues2 = $overviewValues2
          VerseHeaders = $verseHeaders
          VerseRows = $verseRows.ToArray()
          WrapHeaders = $wrapHeaders
          WrapValues = $wrapValues
        }
      )
    }
  }
  else {
    # Current numbered-sheet parser.
    #
    # Row 1: chapter title
    # Repeating section blocks:
    #   merged section heading
    #   8 overview headers
    #   8 overview values
    #   blank row
    #   verse headers
    #   verse rows
    #   blank row
    #   wrap-up headers
    #   wrap-up values

    $r = 1

    while ($r -lt $data.Count) {
      $row = @($data[$r])
      $first = ''
      if ($row.Count -gt 0) {
        $first = ([string]$row[0]).Trim()
      }

      if ([string]::IsNullOrWhiteSpace($first)) {
        $r++
        continue
      }

      # A section heading occupies column A while the remaining cells are blank.
      $otherContent = $false

      for ($c = 1; $c -lt $row.Count; $c++) {
        if (
          -not [string]::IsNullOrWhiteSpace(
            [string]$row[$c]
          )
        ) {
          $otherContent = $true
          break
        }
      }

      if ($otherContent) {
        $r++
        continue
      }

      if ($r + 2 -ge $data.Count) {
        break
      }

      $overviewHeaders = @($data[$r + 1])
      $overviewValues = @($data[$r + 2])

      $recognizedOverviewHeaders = @(
        $overviewHeaders |
        Where-Object {
          ([string]$_).Trim().ToLowerInvariant() -in @(
            'theme',
            'section summary',
            'key observations',
            'main idea',
            'understanding',
            'historical & cultural setting',
            'historical & cultural notes',
            'remarks'
          )
        }
      )

      if ($recognizedOverviewHeaders.Count -lt 2) {
        $r++
        continue
      }

      $passage = Get-MtbStandardSectionHeading $first

      $overviewHeaders1 = @()
      $overviewValues1 = @()
      $overviewHeaders2 = @()
      $overviewValues2 = @()

      for ($c = 0; $c -lt $overviewHeaders.Count; $c++) {
        $header = [string]$overviewHeaders[$c]
        $value = ''

        if ($c -lt $overviewValues.Count) {
          $value = [string]$overviewValues[$c]
        }

        if ($c -lt 4) {
          $overviewHeaders1 += $header
          $overviewValues1 += $value
        }
        else {
          $overviewHeaders2 += $header
          $overviewValues2 += $value
        }
      }

      $r += 3

      while (
        $r -lt $data.Count -and
        [string]::IsNullOrWhiteSpace([string]$data[$r][0])
      ) {
        $r++
      }

      $verseHeaders = @()
      $verseRows = New-Object 'System.Collections.Generic.List[object]'

      if ($r -lt $data.Count) {
        $candidateHeaders = @($data[$r])

        $candidateHeaderKeys = @(
          $candidateHeaders |
            ForEach-Object { ([string]$_).Trim().ToLowerInvariant() }
        )

        $approvedVerseHeaderCount = @(
          $candidateHeaderKeys |
            Where-Object {
              $_ -in @(
                'key explanations',
                'main idea',
                'verse explanation',
                'christ connection',
                'application'
              )
            }
        ).Count

        $hasScriptureOrReferenceHeader = @(
          $candidateHeaderKeys |
            Where-Object { $_ -in @('nkjv','nlt','verse','reference') }
        ).Count -gt 0

        if (
          $candidateHeaders.Count -ge 5 -and
          $hasScriptureOrReferenceHeader -and
          $approvedVerseHeaderCount -ge 3
        ) {
          $verseHeaders = $candidateHeaders
          $r++

          while ($r -lt $data.Count) {
            $candidateRow = @($data[$r])
            $candidateFirst = ''

            if ($candidateRow.Count -gt 0) {
              $candidateFirst = ([string]$candidateRow[0]).Trim()
            }

            if (
              $candidateFirst.ToLowerInvariant() -eq
              'foundational truths'
            ) {
              break
            }

            if (
              [string]::IsNullOrWhiteSpace($candidateFirst)
            ) {
              $lookAhead = $r + 1

              while (
                $lookAhead -lt $data.Count -and
                [string]::IsNullOrWhiteSpace(
                  [string]$data[$lookAhead][0]
                )
              ) {
                $lookAhead++
              }

              if (
                $lookAhead -lt $data.Count -and
                ([string]$data[$lookAhead][0]).Trim().ToLowerInvariant() -eq
                'foundational truths'
              ) {
                $r = $lookAhead
                break
              }

              $r++
              continue
            }

            $verseRows.Add($candidateRow)
            $r++
          }
        }
      }

      $wrapHeaders = @()
      $wrapValues = @()

      if (
        $r -lt $data.Count -and
        ([string]$data[$r][0]).Trim().ToLowerInvariant() -eq
        'foundational truths'
      ) {
        $wrapHeaders = @($data[$r])

        if (($r + 1) -lt $data.Count) {
          $wrapValues = @($data[$r + 1])
        }

        $r += 2
      }

      $sections.Add(
        [pscustomobject]@{
          Passage = $passage
          OverviewHeaders1 = $overviewHeaders1
          OverviewValues1 = $overviewValues1
          OverviewHeaders2 = $overviewHeaders2
          OverviewValues2 = $overviewValues2
          VerseHeaders = $verseHeaders
          VerseRows = $verseRows.ToArray()
          WrapHeaders = $wrapHeaders
          WrapValues = $wrapValues
        }
      )
    }
  }

  if ($sections.Count -eq 0) { throw "No section blocks were found in '$WorksheetName'." }

  $outlineTitles = @(Get-MtbSectionOutlineTitlesFromWorkbook -WorkbookPath $WorkbookPath -Chapter $Chapter)

  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append(@'
<style>
.mtb-chapter-study{--navy:#173a5e;--blue:#2f6eae;--blue-soft:#eef4f9;--gold:#b7832f;--gold-soft:#fbf4e7;--ink:#1f2b37;--muted:#5c6873;--line:#d8e1e8;width:100%;max-width:none;margin:0 auto;padding:2px 4px 36px;font-family:Arial,Helvetica,sans-serif;color:var(--ink)}
.mtb-chapter-study *{box-sizing:border-box}.mtb-study-hero{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 26px;margin:0 0 24px;border:1px solid #cbd8e3;border-radius:14px;background:linear-gradient(135deg,#f8fafc,#e8f0f7)}
.mtb-study-eyebrow{margin:0 0 5px;color:var(--gold);font-size:.78rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.mtb-study-title{margin:0;color:var(--navy);font-size:clamp(1.55rem,3vw,2.25rem);line-height:1.1}.mtb-study-badge{flex:0 0 auto;padding:10px 16px;border:1px solid rgba(23,58,94,.18);border-radius:999px;background:#fff;color:var(--navy);font-weight:800}
.mtb-study-controls{display:flex;justify-content:flex-end;gap:10px;margin:-10px 0 18px}.mtb-study-control{appearance:none;border:1px solid #b9c8d5;border-radius:8px;background:#fff;color:var(--navy);padding:8px 13px;font-weight:800;cursor:pointer}.mtb-study-control:hover{background:#eef4f9}.mtb-study-section{margin:0 0 30px;border:1px solid var(--line);border-radius:15px;background:#fff;box-shadow:0 5px 18px rgba(28,48,66,.06);overflow:hidden}.mtb-study-section>summary{list-style:none;cursor:pointer}.mtb-study-section>summary::-webkit-details-marker{display:none}.mtb-study-section-banner{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:17px 21px;background:linear-gradient(100deg,var(--navy),#315f88);color:#fff}.mtb-study-section-banner h2{margin:0;font-size:1.28rem}.mtb-study-section-number{font-size:.76rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;opacity:.82}.mtb-study-section-toggle{flex:0 0 auto;width:34px;height:34px;border:1px solid rgba(255,255,255,.4);border-radius:999px;display:grid;place-items:center;font-size:1.35rem;font-weight:700}.mtb-study-section-toggle:before{content:'−'}.mtb-study-section:not([open]) .mtb-study-section-toggle:before{content:'+'}.mtb-study-section:not([open]) .mtb-study-section-banner{border-radius:14px}
.mtb-study-block{padding:20px}.mtb-study-block-title{display:flex;align-items:center;gap:12px;margin:0 0 14px;color:var(--navy);font-size:1.02rem;text-transform:uppercase;letter-spacing:.055em}.mtb-study-block-title:after{content:'';height:1px;flex:1;background:linear-gradient(to right,#c7d3de,transparent)}
.mtb-study-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:18px;align-items:stretch}.mtb-study-card{grid-column:span 3;border:1px solid var(--line);border-top:4px solid #6288aa;border-radius:11px;overflow:hidden;background:#fff}.mtb-study-card-wide{grid-column:span 6}.mtb-study-card h3{display:flex;align-items:center;gap:8px;margin:0;padding:11px 14px;background:var(--blue-soft);border-bottom:1px solid #e4ebf0;color:var(--navy);font-size:.94rem}.mtb-study-title-icon{display:inline-grid;place-items:center;flex:0 0 auto;width:1.15em;color:#315f88;font-size:1.05em;line-height:1}.mtb-study-card-prompt{display:none}.mtb-study-card-body{padding:14px 16px 16px;line-height:1.5}.mtb-study-card-body p{margin:0 0 .85em}.mtb-study-card-body p:last-child{margin-bottom:0}.mtb-study-card-body ul{margin:0;padding-left:1.2em}.mtb-study-card-body li{margin:0 0 .48em}.mtb-study-card-theme,.mtb-study-card-mainidea,.mtb-study-card-christ{border-top-color:#6288aa;background:#fff}.mtb-study-card-theme h3,.mtb-study-card-mainidea h3,.mtb-study-card-christ h3{background:var(--blue-soft);color:var(--navy)}
.mtb-study-verses{padding:0 20px 20px}.mtb-study-verse{margin:0 0 13px;border:1px solid #cfdae3;border-radius:11px;background:#fff;overflow:hidden}.mtb-study-verse summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 17px;cursor:pointer;background:#f3f7fa;color:var(--navy);font-weight:800;list-style:none}.mtb-study-verse summary::-webkit-details-marker{display:none}.mtb-study-verse summary:after{content:'+';font-size:1.3rem}.mtb-study-verse[open] summary:after{content:'−'}.mtb-study-verse[open] summary{border-bottom:1px solid #dbe3ea;background:#eaf2f8}.mtb-study-verse-body{padding:16px}.mtb-study-scripture-block{position:relative;margin:0 0 10px;padding:16px 18px;border-left:5px solid var(--gold);border-radius:0 9px 9px 0;background:#fffaf0}.mtb-study-scripture-block.mtb-study-scripture-nlt{border-left-color:var(--gold)!important;background:#fffaf0!important}.mtb-study-scripture-block.mtb-study-scripture-nlt .mtb-study-translation{background:#efe2c7!important;color:#6b4818!important}.mtb-study-scripture-block p{margin:0;line-height:1.5}.mtb-study-translation{float:right;margin:0 0 6px 10px;padding:3px 7px;border-radius:999px;background:#efe2c7;color:#6b4818;font-size:.7rem;font-weight:800}.mtb-study-verse-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:15px;align-items:stretch}.mtb-study-verse-grid.mtb-study-verse-grid-5{grid-template-columns:repeat(5,minmax(0,1fr))}.mtb-study-verse-grid.mtb-study-verse-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}.mtb-study-verse-panel{min-width:0;border:1px solid var(--line);border-radius:9px;overflow:hidden}.mtb-study-verse-panel h4{display:flex;align-items:center;gap:8px;margin:0;padding:9px 12px;background:#f4f7f9;color:var(--navy);font-size:.88rem}.mtb-study-verse-panel-content{padding:12px 13px;line-height:1.47}.mtb-study-verse-panel-content p{margin:0 0 .8em}.mtb-study-observation{padding:0 0 9px;margin:0 0 9px;border-bottom:1px solid #e7ecef}.mtb-study-observation:last-child{padding-bottom:0;margin-bottom:0;border-bottom:0}.mtb-study-observation strong{display:block;margin-bottom:3px;color:var(--navy)}.mtb-study-observation span{display:block}.mtb-study-empty{color:#77818a;font-style:italic}.mtb-chapter-study .mtb-resource-link{color:#1f5fae;font-weight:700;text-decoration-line:underline;text-decoration-style:dotted;text-decoration-thickness:2px;text-underline-offset:4px;cursor:pointer}.mtb-chapter-study .mtb-resource-link:after{content:' ↗';font-size:.78em;opacity:.78}.mtb-chapter-study .mtb-resource-link:hover,.mtb-chapter-study .mtb-resource-link:focus-visible{color:#123f7a;text-decoration-style:solid}
.mtb-study-wrap{padding:0 20px 22px}.mtb-study-wrap-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:13px}.mtb-study-wrap-card{grid-column:span 4;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}.mtb-study-wrap-card h3{display:flex;align-items:center;gap:8px;margin:0;padding:10px 13px;background:#f3f7fa;color:var(--navy);font-size:.9rem}.mtb-study-wrap-card .mtb-study-card-body{padding:13px 14px}.mtb-study-wrap-card-christ,.mtb-study-wrap-card-dwelling{border-top:1px solid var(--line)}
@media(max-width:1100px){.mtb-study-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mtb-study-card{grid-column:span 1}.mtb-study-card-wide{grid-column:span 2}.mtb-study-wrap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mtb-study-wrap-card,.mtb-study-wrap-card-christ,.mtb-study-wrap-card-dwelling{grid-column:span 1}.mtb-study-verse-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:660px){.mtb-study-grid{grid-template-columns:1fr}.mtb-study-card,.mtb-study-card-wide{grid-column:1/-1}.mtb-chapter-study{padding-left:0;padding-right:0}.mtb-study-hero{align-items:flex-start;flex-direction:column;padding:18px;border-radius:10px}.mtb-study-controls{justify-content:stretch;margin-top:-6px}.mtb-study-control{flex:1}.mtb-study-section-banner{align-items:center}.mtb-study-block,.mtb-study-verses,.mtb-study-wrap{padding-left:13px;padding-right:13px}.mtb-study-wrap-grid{grid-template-columns:1fr}.mtb-study-verse-grid{grid-template-columns:1fr}.mtb-study-verse summary{padding:13px}.mtb-study-verse-body{padding:12px}}
</style>
'@)

  [void]$sb.Append('<div class="mtb-chapter-study"><header class="mtb-study-hero"><div><p class="mtb-study-eyebrow">Chapter Study</p><h1 class="mtb-study-title">' + (ConvertTo-HtmlEncoded $bookDisplay) + ' Chapter ' + $Chapter + '</h1></div><div class="mtb-study-badge">Verse-by-Verse</div></header><div class="mtb-study-controls" aria-label="Chapter study display controls"><button type="button" class="mtb-study-control" onclick="this.closest(&quot;.mtb-chapter-study&quot;).querySelectorAll(&quot;details.mtb-study-section, details.mtb-study-verse&quot;).forEach(function(panel){panel.open=true;});">Expand All</button><button type="button" class="mtb-study-control" onclick="this.closest(&quot;.mtb-chapter-study&quot;).querySelectorAll(&quot;details.mtb-study-section, details.mtb-study-verse&quot;).forEach(function(panel){panel.open=false;});">Collapse All</button></div>')

  # STANDARD: The Section cell itself contains the complete banner heading:
  #   Ruth 1:1-2 - The Famine
  #   Obadiah 1:1-4 - The Judgment of Edom Announced
  # Use that cell exactly as the source of truth. Do not append Theme,
  # Main Idea, or Chapter Flow text.

  $sectionNumber = 0
  foreach ($section in $sections) {
    $sectionNumber++

    $overviewPairs = @(@($section.OverviewHeaders1,$section.OverviewValues1),@($section.OverviewHeaders2,$section.OverviewValues2))

    # STANDARD CHAPTER-STUDY BANNER:
    #
    # New workbook standard:
    #   The OVERVIEW marker row, column B, contains the complete heading:
    #   Ruth 1:1-2 - The Famine
    #
    # Legacy Obadiah structure:
    #   Column B contains only the passage, and the first overview value
    #   directly below it contains the outline title.
    #
    # Prefer the complete heading from column B whenever it already contains
    # text after the verse range. Only use the legacy Theme-cell fallback when
    # column B contains a bare passage reference.
    $sectionPassage = Get-MtbStandardSectionHeading ([string]$section.Passage)
    $sectionOutline = ''
    if ($section.OverviewValues1 -and $section.OverviewValues1.Count -gt 0) {
      $sectionOutline = ([string]$section.OverviewValues1[0]).Trim()
    }

    $passageAlreadyHasOutline = $false
    if (-not [string]::IsNullOrWhiteSpace($sectionPassage)) {
      $passageAlreadyHasOutline = (
        $sectionPassage -match '^\s*[1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d+:\d+(?:\s*[-–—]\s*\d+)?\s+[-–—:]\s+\S'
      )
    }

    if ($passageAlreadyHasOutline) {
      $sectionHeading = $sectionPassage
    } elseif (-not [string]::IsNullOrWhiteSpace($sectionPassage) -and -not [string]::IsNullOrWhiteSpace($sectionOutline)) {
      $sectionHeading = $sectionPassage.TrimEnd(' ','-','–','—') + ' - ' + $sectionOutline
    } elseif (-not [string]::IsNullOrWhiteSpace($sectionPassage)) {
      $sectionHeading = $sectionPassage
    } elseif (-not [string]::IsNullOrWhiteSpace($sectionOutline)) {
      $sectionHeading = $sectionOutline
    } else {
      $sectionHeading = 'Section ' + $sectionNumber
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
        # Theme is intentionally omitted from the overview cards; the approved outline title appears in the section banner.
        # Also suppress structural marker labels if a workbook layout causes one
        # to be read as an overview heading.
        if ($key -match '^theme' -or $key -match '^verse-by-verse$' -or $key -match '^wrap-up$') { continue }
        $extra = ''
        if ($key -match 'main idea') { $extra=' mtb-study-card-mainidea' }
        if ($key -match '^remarks') { $extra += ' mtb-study-card-wide' }
        [void]$sb.Append('<article class="mtb-study-card' + $extra + '"><h3>' + (Get-MtbStudyIconHtml $parts.Title) + (ConvertTo-HtmlEncoded $parts.Title) + '</h3><div class="mtb-study-card-body">' + (Convert-MtbStudyCellToHtml $value $parts.Title -EmphasizeLabels) + '</div></article>')
      }
    }
    [void]$sb.Append('</div></div>')

    if ($section.VerseRows.Count -gt 0) {
      [void]$sb.Append('<div class="mtb-study-verses"><h2 class="mtb-study-block-title">Verse-by-Verse Study</h2>')
      $verseIndex=0
      # The first verse-table column may be labeled either "Verse" (new standard)
      # or "NKJV" (legacy Obadiah). In both cases column A is treated as the
      # Identify Scripture/reference columns by heading rather than assuming
      # fixed positions. This supports both NKJV/NLT sheets and sheets whose
      # first column is simply Verse or Reference.
      $headerKeys = @(
        $section.VerseHeaders |
          ForEach-Object { ([string]$_).Trim().ToLowerInvariant() }
      )

      $nkjvColumn = -1
      $nltColumn = -1
      $referenceColumn = -1

      for ($headerIndex = 0; $headerIndex -lt $headerKeys.Count; $headerIndex++) {
        switch ($headerKeys[$headerIndex]) {
          'nkjv' { if ($nkjvColumn -lt 0) { $nkjvColumn = $headerIndex } }
          'nlt' { if ($nltColumn -lt 0) { $nltColumn = $headerIndex } }
          'verse' { if ($referenceColumn -lt 0) { $referenceColumn = $headerIndex } }
          'reference' { if ($referenceColumn -lt 0) { $referenceColumn = $headerIndex } }
        }
      }

      if ($nkjvColumn -lt 0) { $nkjvColumn = $referenceColumn }
      if ($referenceColumn -lt 0) { $referenceColumn = $nkjvColumn }
      if ($nltColumn -lt 0) { $nltColumn = $referenceColumn }

      $studyColumns = New-Object 'System.Collections.Generic.List[int]'
      for ($headerIndex = 0; $headerIndex -lt $section.VerseHeaders.Count; $headerIndex++) {
        $headerKey = $headerKeys[$headerIndex]
        if ([string]::IsNullOrWhiteSpace($headerKey)) { continue }
        if ($headerKey -in @('nkjv','nlt','verse','reference')) { continue }
        $studyColumns.Add($headerIndex)
      }

      foreach ($row in $section.VerseRows) {
        $verseIndex++

        $nkjvSource = ''
        $nltSource = ''
        $referenceSource = ''

        if ($nkjvColumn -ge 0 -and $nkjvColumn -lt $row.Count) {
          $nkjvSource = [string]$row[$nkjvColumn]
        }
        if ($nltColumn -ge 0 -and $nltColumn -lt $row.Count) {
          $nltSource = [string]$row[$nltColumn]
        }
        if ($referenceColumn -ge 0 -and $referenceColumn -lt $row.Count) {
          $referenceSource = [string]$row[$referenceColumn]
        }
        if ([string]::IsNullOrWhiteSpace($referenceSource)) {
          $referenceSource = $nkjvSource
        }

        $reference = Get-MtbStudyVerseReference `
          $referenceSource `
          $BookSlug `
          $Chapter

        $verseNumber = $verseIndex
        if ($reference -match ':\s*(?<verse>\d+)') {
          $verseNumber = [int]$Matches['verse']
        }

        $nkjvText = Get-MtbStudyNkjvText `
          -CellValue $nkjvSource `
          -BookSlug $BookSlug

        if ([string]::IsNullOrWhiteSpace($nltSource)) {
          $nltSource = $referenceSource
        }

        $nltText = Get-MtbStudyNltText `
          -CellValue $nltSource `
          -BookSlug $BookSlug

        [void]$sb.Append(
          '<details class="mtb-study-verse" data-verse="' +
          $verseNumber +
          '"><summary><span>' +
          (ConvertTo-HtmlEncoded $reference) +
          '</span></summary><div class="mtb-study-verse-body">'
        )

        if (-not [string]::IsNullOrWhiteSpace($nkjvText)) {
          $nkjvHtml = Convert-MtbStudyScriptureToHtml `
            -Text $nkjvText `
            -BookSlug $BookSlug `
            -Chapter $Chapter `
            -Verse $verseNumber
          [void]$sb.Append($nkjvHtml)
        }

        if (-not [string]::IsNullOrWhiteSpace($nltText)) {
          $nltHtml = Convert-MtbStudyScriptureToHtml `
            -Text $nltText `
            -BookSlug $BookSlug `
            -Chapter $Chapter `
            -Verse $verseNumber
          [void]$sb.Append($nltHtml)
        }

        $studyCardCount = $studyColumns.Count
        $verseGridClass = 'mtb-study-verse-grid'
        if ($studyCardCount -eq 5) {
          $verseGridClass += ' mtb-study-verse-grid-5'
        }
        elseif ($studyCardCount -eq 3) {
          $verseGridClass += ' mtb-study-verse-grid-3'
        }

        [void]$sb.Append('<div class="' + $verseGridClass + '">')

        foreach ($c in $studyColumns) {
          $rawHeader = [string]$section.VerseHeaders[$c]
          $parts = Get-MtbStudyHeaderParts $rawHeader
          $displayTitle = Get-MtbVerseStudyDisplayTitle $parts.Title

          $value = if ($c -lt $row.Count) { [string]$row[$c] } else { '' }
          $panelIcon = Get-MtbStudyIconHtml $displayTitle
          $panelTitle = ConvertTo-HtmlEncoded $displayTitle
          $panelBody = Convert-MtbStudyCellToHtml `
            $value `
            $displayTitle `
            -EmphasizeLabels

          [void]$sb.Append(
            '<section class="mtb-study-verse-panel"><h4>' +
            $panelIcon +
            $panelTitle +
            '</h4><div class="mtb-study-verse-panel-content">' +
            $panelBody +
            '</div></section>'
          )
        }

        [void]$sb.Append('</div></div></details>')
      }
      [void]$sb.Append('</div>')
    }

    if ($section.WrapHeaders.Count -gt 0) {
      [void]$sb.Append('<div class="mtb-study-wrap"><h2 class="mtb-study-block-title">Wrap-Up</h2><div class="mtb-study-wrap-grid">')
      for ($c=0; $c -lt $section.WrapHeaders.Count; $c++) {
        $rawHeader=[string]$section.WrapHeaders[$c]
        if ([string]::IsNullOrWhiteSpace($rawHeader)) { continue }
        $parts=Get-MtbStudyHeaderParts $rawHeader

        $displayTitle = [string]$parts.Title
        $displayTitleKey = $displayTitle.Trim().ToLowerInvariant()

        if ($displayTitleKey -eq 'remarks') {
          $displayTitle = 'Seeds for the Sower'
        }
        elseif (
          $displayTitleKey -eq
          'healthy church culture & community'
        ) {
          $displayTitle = 'How Shall We Then Live?'
        }

        $value=if($c -lt $section.WrapValues.Count){[string]$section.WrapValues[$c]}else{''}
        $key=$displayTitle.Trim().ToLowerInvariant(); $extra=''
        if($key -match 'christ connection'){$extra=' mtb-study-wrap-card-christ'}elseif($key -match 'dwelling'){$extra=' mtb-study-wrap-card-dwelling'}
        [void]$sb.Append(
          '<article class="mtb-study-wrap-card' +
          $extra +
          '"><h3>' +
          (Get-MtbStudyIconHtml $displayTitle) +
          (ConvertTo-HtmlEncoded $displayTitle) +
          '</h3><div class="mtb-study-card-body">' +
          (
            Convert-MtbStudyCellToHtml `
              $value `
              $displayTitle `
              -EmphasizeLabels
          ) +
          '</div></article>'
        )
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
    if($sheetName -match '^Study(?:\s+Chapter)?\s+(?<chapter>\d+)$'){
      $chapter=[int]$Matches['chapter']
      $path=Write-MtbChapterStudyFromExcel -WorkbookPath $WorkbookPath -OutBookDir $OutBookDir -BookSlug $BookSlug -Chapter $chapter -WorksheetName $sheetName
      if (-not [string]::IsNullOrWhiteSpace([string]$path)) {
        $writtenNames.Add((Split-Path $path -Leaf))
      }
    }
  }
  return ,$writtenNames.ToArray()
}


function New-MtbChapterCultureHtmlFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $BookSlug,
    [Parameter(Mandatory)] [int] $Chapter,
    [Parameter(Mandatory)] [string] $WorksheetName
  )

  $data = Get-ExcelWorksheetValues `
    -WorkbookPath $WorkbookPath `
    -WorksheetName $WorksheetName

  $bookDisplay = (Get-Culture).TextInfo.ToTitleCase(
    ($BookSlug -replace '-', ' ')
  )

  $displayTitle = "East Gate Culture in $bookDisplay Chapter $Chapter"
  $cards = New-Object 'System.Collections.Generic.List[object]'

  # Current layout:
  # Chapter | Culture Value | Official Culture Statement | Chapter Application
  $headerRowIndex = -1
  $cultureValueColumn = -1
  $statementColumn = -1
  $applicationColumn = -1

  for ($r = 0; $r -lt $data.Count; $r++) {
    $row = @($data[$r])

    for ($c = 0; $c -lt $row.Count; $c++) {
      $header = ([string]$row[$c]).Trim().ToLowerInvariant()

      switch ($header) {
        'culture value' {
          $cultureValueColumn = $c
          $headerRowIndex = $r
        }
        'official culture statement' {
          $statementColumn = $c
          $headerRowIndex = $r
        }
        'chapter application' {
          $applicationColumn = $c
          $headerRowIndex = $r
        }
      }
    }

    if (
      $cultureValueColumn -ge 0 -and
      $statementColumn -ge 0 -and
      $applicationColumn -ge 0
    ) {
      break
    }
  }

  if ($headerRowIndex -ge 0) {
    for ($r = ($headerRowIndex + 1); $r -lt $data.Count; $r++) {
      $row = @($data[$r])

      $cultureValue = ''
      $statement = ''
      $application = ''

      if ($cultureValueColumn -lt $row.Count) {
        $cultureValue = ([string]$row[$cultureValueColumn]).Trim()
      }

      if ($statementColumn -lt $row.Count) {
        $statement = ([string]$row[$statementColumn]).Trim()
      }

      if ($applicationColumn -lt $row.Count) {
        $application = ([string]$row[$applicationColumn]).Trim()
      }

      if (
        [string]::IsNullOrWhiteSpace($cultureValue) -and
        [string]::IsNullOrWhiteSpace($statement) -and
        [string]::IsNullOrWhiteSpace($application)
      ) {
        continue
      }

      $cards.Add(
        [pscustomobject]@{
          CultureValue = $cultureValue
          Statement = $statement
          Application = $application
        }
      )

      if ($cards.Count -eq 3) {
        break
      }
    }
  }
  else {
    # Legacy two-row culture layout.
    if ($data.Count -lt 2) {
      return ''
    }

    $titleRowIndex = -1

    for ($r = 0; $r -lt $data.Count; $r++) {
      for ($c = 0; $c -lt $data[$r].Count; $c++) {
        $cellText = ([string]$data[$r][$c]).Trim()

        if ($cellText -match '^(?i)East\s+Gate\s+Culture') {
          $displayTitle = $cellText
          $titleRowIndex = $r
          break
        }
      }

      if ($titleRowIndex -ge 0) {
        break
      }
    }

    $contentRows = New-Object 'System.Collections.Generic.List[int]'
    $scanStart = if ($titleRowIndex -ge 0) {
      $titleRowIndex + 1
    }
    else {
      0
    }

    for ($r = $scanStart; $r -lt $data.Count; $r++) {
      $hasContent = $false

      for ($c = 0; $c -lt $data[$r].Count; $c++) {
        if (
          -not [string]::IsNullOrWhiteSpace(
            [string]$data[$r][$c]
          )
        ) {
          $hasContent = $true
          break
        }
      }

      if ($hasContent) {
        $contentRows.Add($r)

        if ($contentRows.Count -eq 2) {
          break
        }
      }
    }

    if ($contentRows.Count -ge 2) {
      $statementRow = $data[$contentRows[0]]
      $applicationRow = $data[$contentRows[1]]
      $maxColumns = [Math]::Max(
        $statementRow.Count,
        $applicationRow.Count
      )

      for ($c = 0; $c -lt $maxColumns; $c++) {
        $statement = ''
        $application = ''

        if ($c -lt $statementRow.Count) {
          $statement = ([string]$statementRow[$c]).Trim()
        }

        if ($c -lt $applicationRow.Count) {
          $application = ([string]$applicationRow[$c]).Trim()
        }

        if (
          [string]::IsNullOrWhiteSpace($statement) -and
          [string]::IsNullOrWhiteSpace($application)
        ) {
          continue
        }

        $cards.Add(
          [pscustomobject]@{
            CultureValue = ''
            Statement = $statement
            Application = $application
          }
        )

        if ($cards.Count -eq 3) {
          break
        }
      }
    }
  }

  # Empty EG Culture worksheets are valid. Return no HTML so no tab content
  # is generated for a chapter without a direct East Gate Culture connection.
  if ($cards.Count -eq 0) {
    return ''
  }

  $sb = New-Object System.Text.StringBuilder

  [void]$sb.Append(@'
<style>
body[data-doc-type="chapter-eg-culture"] #doc-layout {
  width: min(96vw, 1680px) !important;
  max-width: 1680px !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
body[data-doc-type="chapter-eg-culture"] .doc-main,
body[data-doc-type="chapter-eg-culture"] #doc-target,
body[data-doc-type="chapter-eg-culture"] .doc-content {
  width: 100% !important;
  max-width: none !important;
}
.mtb-culture-dashboard {
  --mtb-culture-navy: #173a5e;
  --mtb-culture-blue: #2b587f;
  --mtb-culture-soft: #eef4f9;
  --mtb-culture-border: #d3dee8;
  --mtb-culture-gold: #b7832f;
  width: 100%;
  max-width: none;
  margin: 0 auto;
  padding: 8px 0 34px;
  color: #1d2935;
  font-family: Arial, Helvetica, sans-serif;
}
.mtb-culture-dashboard * { box-sizing: border-box; }
.mtb-culture-dashboard .mtb-culture-hero {
  margin: 0 0 24px;
  padding: 22px 26px;
  border: 1px solid #cbd8e3;
  border-radius: 14px;
  background: linear-gradient(135deg, #f7fafc 0%, #e8f0f7 100%);
}
.mtb-culture-dashboard .mtb-culture-eyebrow {
  margin: 0 0 6px;
  color: var(--mtb-culture-gold);
  font-size: .78rem;
  font-weight: 800;
  letter-spacing: .13em;
  text-transform: uppercase;
}
.mtb-culture-dashboard .mtb-culture-title {
  margin: 0;
  color: var(--mtb-culture-navy);
  font-size: clamp(1.55rem, 3vw, 2.2rem);
  line-height: 1.12;
}
.mtb-culture-dashboard .mtb-culture-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  align-items: stretch;
}
.mtb-culture-dashboard .mtb-culture-card-title {
  margin: 0;
  padding: 15px 20px;
  background: var(--mtb-culture-navy);
  color: #fff;
  font-size: 1.08rem;
}
.mtb-culture-dashboard .mtb-culture-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--mtb-culture-border);
  border-top: 4px solid var(--mtb-culture-blue);
  border-radius: 13px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(28, 55, 80, .06);
}
.mtb-culture-dashboard .mtb-culture-standard {
  padding: 24px 26px;
  background: linear-gradient(135deg, #edf4fa 0%, #e2edf6 100%);
  border-bottom: 1px solid var(--mtb-culture-border);
}
.mtb-culture-dashboard .mtb-culture-standard-label,
.mtb-culture-dashboard .mtb-culture-application-label {
  margin: 0 0 10px;
  color: var(--mtb-culture-navy);
  font-size: .76rem;
  font-weight: 800;
  letter-spacing: .09em;
  text-transform: uppercase;
}
.mtb-culture-dashboard .mtb-culture-standard-content {
  color: var(--mtb-culture-navy);
  font-size: 1.08rem;
  font-weight: 700;
  line-height: 1.58;
}
.mtb-culture-dashboard .mtb-culture-application {
  flex: 1 1 auto;
  padding: 24px 26px 28px;
  background: #ffffff;
}
.mtb-culture-dashboard .mtb-culture-application-content {
  font-size: 1rem;
  line-height: 1.65;
}
.mtb-culture-dashboard p { margin: 0 0 13px; }
.mtb-culture-dashboard p:last-child { margin-bottom: 0; }
.mtb-culture-dashboard .mtb-resource-link {
  color: #1f5fae;
  font-weight: 700;
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
  cursor: pointer;
}
.mtb-culture-dashboard .mtb-resource-link::after {
  content: " ↗";
  font-size: .78em;
  opacity: .78;
}
.mtb-culture-dashboard .mtb-resource-link:hover,
.mtb-culture-dashboard .mtb-resource-link:focus-visible {
  color: #123f7a;
  text-decoration-style: solid;
}
@media (max-width: 1050px) {
  .mtb-culture-dashboard .mtb-culture-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 680px) {
  .mtb-culture-dashboard {
    padding-left: 0;
    padding-right: 0;
  }
  .mtb-culture-dashboard .mtb-culture-grid {
    grid-template-columns: 1fr;
  }
  .mtb-culture-dashboard .mtb-culture-hero,
  .mtb-culture-dashboard .mtb-culture-standard,
  .mtb-culture-dashboard .mtb-culture-application {
    padding-left: 18px;
    padding-right: 18px;
  }
}
</style>
'@)

  [void]$sb.Append('<div class="mtb-culture-dashboard">')
  [void]$sb.Append('<header class="mtb-culture-hero">')
  [void]$sb.Append('<p class="mtb-culture-eyebrow">East Gate Bethlehem</p>')
  [void]$sb.Append('<h1 class="mtb-culture-title">' + (ConvertTo-HtmlEncoded $displayTitle) + '</h1>')
  [void]$sb.Append('</header>')
  [void]$sb.Append('<div class="mtb-culture-grid">')

  foreach ($card in $cards) {
    $statementHtml = Convert-MtbStudyCellToHtml $card.Statement "Culture Statement"
    $applicationHtml = Convert-MtbStudyCellToHtml $card.Application "Chapter Application" -EmphasizeLabels

    [void]$sb.Append('<article class="mtb-culture-card">')

    if (
      -not [string]::IsNullOrWhiteSpace(
        [string]$card.CultureValue
      )
    ) {
      [void]$sb.Append(
        '<h2 class="mtb-culture-card-title">' +
        (ConvertTo-HtmlEncoded ([string]$card.CultureValue)) +
        '</h2>'
      )
    }

    [void]$sb.Append('<section class="mtb-culture-standard">')
    [void]$sb.Append('<h2 class="mtb-culture-standard-label">Culture Statement</h2>')
    [void]$sb.Append('<div class="mtb-culture-standard-content">' + $statementHtml + '</div>')
    [void]$sb.Append('</section>')
    [void]$sb.Append('<section class="mtb-culture-application">')
    [void]$sb.Append('<h2 class="mtb-culture-application-label">Living It in ' + (ConvertTo-HtmlEncoded $bookDisplay) + '</h2>')
    [void]$sb.Append('<div class="mtb-culture-application-content">' + $applicationHtml + '</div>')
    [void]$sb.Append('</section>')
    [void]$sb.Append('</article>')
  }

  [void]$sb.Append('</div></div>')
  return $sb.ToString()
}

function Write-MtbChapterCultureFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $OutBookDir,
    [Parameter(Mandatory)] [string] $BookSlug,
    [Parameter(Mandatory)] [int] $Chapter,
    [Parameter(Mandatory)] [string] $WorksheetName
  )

  $chapterDir = Join-Path $OutBookDir ("{0:D3}" -f $Chapter)
  Ensure-Path $chapterDir

  $outName = "$BookSlug-$Chapter-chapter-eg-culture.html"
  $outPath = Join-Path $chapterDir $outName

  $html = New-MtbChapterCultureHtmlFromExcel `
    -WorkbookPath $WorkbookPath `
    -BookSlug $BookSlug `
    -Chapter $Chapter `
    -WorksheetName $WorksheetName

  if ([string]::IsNullOrWhiteSpace($html)) {
    Write-Host (
      "SKIP " + $WorksheetName +
      " because the chapter has no EG Culture cards."
    ) -ForegroundColor DarkYellow

    return $null
  }

  $html = Wrap-MtbDocHtml $html "chapter-eg-culture"

  [System.IO.File]::WriteAllText(
    $outPath,
    $html,
    [System.Text.UTF8Encoding]::new($false)
  )

  Write-Host (
    "OK   " +
    (Split-Path $WorkbookPath -Leaf) +
    " [$WorksheetName] -> " +
    $outName
  ) -ForegroundColor Green

  return $outPath
}

function Write-AllMtbChapterCulturesFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $OutBookDir,
    [Parameter(Mandatory)] [string] $BookSlug
  )

  $writtenNames = New-Object 'System.Collections.Generic.List[string]'
  $sheetNames = Get-ExcelWorksheetNames -WorkbookPath $WorkbookPath

  foreach ($sheetName in $sheetNames) {
    if ($sheetName -match '^(?:EG\s+Culture|Culture\s+Chapter)\s+(?<chapter>\d+)$') {
      $chapter = [int]$Matches['chapter']

      $path = Write-MtbChapterCultureFromExcel `
        -WorkbookPath $WorkbookPath `
        -OutBookDir $OutBookDir `
        -BookSlug $BookSlug `
        -Chapter $chapter `
        -WorksheetName $sheetName

      if (-not [string]::IsNullOrWhiteSpace([string]$path)) {
        $writtenNames.Add((Split-Path $path -Leaf))
      }
    }
  }

  return ,$writtenNames.ToArray()
}


function Convert-MtbCanonCellToHtml {
  param(
    [AllowEmptyString()]
    [string] $Text,
    [AllowEmptyString()]
    [string] $Header
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return '<p class="mtb-canon-empty">No content added yet.</p>'
  }

  $normalized = ([string]$Text) -replace "`r`n", "`n" -replace "`r", "`n"

  # Some Excel cells contain several bullet characters without line breaks.
  # Put each bullet on its own line before using the shared study formatter.
  $normalized = [regex]::Replace(
    $normalized,
    '(?<!^)\s*•\s*',
    "`n• "
  )

  if ($normalized.TrimStart().StartsWith('•')) {
    $normalized = '• ' + $normalized.TrimStart().Substring(1).TrimStart()
  }

  return Convert-MtbStudyCellToHtml `
    -text $normalized `
    -header $Header `
    -EmphasizeLabels
}

function Get-MtbCanonSectionSheetMap {
  return [ordered]@{
    "OT_LAW"                = "old-testament\law"
    "OT_HISTORY"            = "old-testament\history"
    "OT_POETRY_WISDOM"      = "old-testament\wisdom"
    "OT_MAJOR_PROPHETS"     = "old-testament\major-prophets"
    "OT_MINOR_PROPHETS"     = "old-testament\minor-prophets"

    "NT_GOSPELS"            = "new-testament\gospels"
    "NT_HISTORY"            = "new-testament\acts"
    "NT_PAULINE_EPISTLES"   = "new-testament\pauline-epistles"
    "NT_PASTORAL_EPISTLES"  = "new-testament\pastoral-epistles"
    "NT_GENERAL_EPISTLES"   = "new-testament\general-epistles"
    "NT_JOHANNINE_EPISTLES" = "new-testament\johannine-epistles"
    "NT_PROPHECY"           = "new-testament\revelation"
  }
}

function Find-MtbCanonHeaderRow {
  param(
    [Parameter(Mandatory)]
    [object[]] $Data
  )

  for ($r = 0; $r -lt $Data.Count; $r++) {
    if ($Data[$r].Count -lt 4) { continue }

    $a = ([string]$Data[$r][0]).Trim()
    $b = ([string]$Data[$r][1]).Trim()
    $c = ([string]$Data[$r][2]).Trim()
    $d = ([string]$Data[$r][3]).Trim()

    if (
      $a -ieq "Testament" -and
      $b -ieq "Division" -and
      $c -ieq "Books" -and
      $d -ieq "Overarching Theme"
    ) {
      return $r
    }
  }

  return -1
}

function Convert-MtbCanonBooksHeaderHtml {
  param(
    [AllowEmptyString()]
    [string] $Text
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  $normalized = ([string]$Text) -replace "`r`n", "`n" -replace "`r", "`n"
  $lines = @(
    $normalized -split "`n" |
      ForEach-Object { $_.Trim() } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  )

  # Convert bullets into an inline book list while preserving an optional
  # first-line range such as "Joshua–Esther".
  $range = ""
  $books = New-Object 'System.Collections.Generic.List[string]'

  foreach ($line in $lines) {
    $clean = ($line -replace '^[•\-]\s*', '').Trim()

    if ([string]::IsNullOrWhiteSpace($clean)) {
      continue
    }

    if (
      [string]::IsNullOrWhiteSpace($range) -and
      $line -notmatch '^[•\-]\s*' -and
      $clean -match '[–—-]' -and
      $clean.Length -lt 80
    ) {
      $range = $clean
    }
    else {
      # A cell may contain several bullet characters on one line.
      foreach ($piece in ($clean -split '\s*•\s*')) {
        $book = $piece.Trim()
        if (-not [string]::IsNullOrWhiteSpace($book)) {
          $books.Add($book)
        }
      }
    }
  }

  # Remove an exact duplicate of the range when it was also captured
  # as part of the list.
  $bookValues = @(
    $books |
      Where-Object {
        [string]::IsNullOrWhiteSpace($range) -or
        $_ -ne $range
      }
  )

  $sb = New-Object System.Text.StringBuilder

  if (-not [string]::IsNullOrWhiteSpace($range)) {
    [void]$sb.Append(
      '<span class="mtb-canon-book-range">' +
      (ConvertTo-HtmlEncoded $range) +
      '</span>'
    )
  }

  if ($bookValues.Count -gt 0) {
    if ($sb.Length -gt 0) {
      [void]$sb.Append('<span class="mtb-canon-book-separator"> — </span>')
    }

    $encodedBooks = @(
      $bookValues |
        ForEach-Object { ConvertTo-HtmlEncoded $_ }
    )

    [void]$sb.Append(
      '<span class="mtb-canon-book-list">' +
      ($encodedBooks -join ' <span aria-hidden="true">•</span> ') +
      '</span>'
    )
  }

  return $sb.ToString()
}

function New-MtbCanonSectionHtmlFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $WorksheetName
  )

  $data = Get-ExcelWorksheetValues `
    -WorkbookPath $WorkbookPath `
    -WorksheetName $WorksheetName

  $headerRow = Find-MtbCanonHeaderRow -Data $data

  if ($headerRow -lt 0) {
    throw "Could not locate the canonical section header row in '$WorksheetName'."
  }

  # Expected workbook pattern:
  # header row / data row, repeated three times.
  $groups = New-Object 'System.Collections.Generic.List[object]'
  $cursor = $headerRow

  while ($cursor -lt $data.Count -and $groups.Count -lt 3) {
    while ($cursor -lt $data.Count) {
      $row = $data[$cursor]
      $nonEmpty = 0

      for ($c = 0; $c -lt [Math]::Min(4, $row.Count); $c++) {
        if (-not [string]::IsNullOrWhiteSpace([string]$row[$c])) {
          $nonEmpty++
        }
      }

      if ($nonEmpty -ge 4) { break }
      $cursor++
    }

    if ($cursor -ge $data.Count) { break }

    $headers = @()
    for ($c = 0; $c -lt 4; $c++) {
      $headers += ([string]$data[$cursor][$c]).Trim()
    }

    $valueRow = $cursor + 1
    while ($valueRow -lt $data.Count) {
      $hasValue = $false

      for ($c = 0; $c -lt [Math]::Min(4, $data[$valueRow].Count); $c++) {
        if (-not [string]::IsNullOrWhiteSpace([string]$data[$valueRow][$c])) {
          $hasValue = $true
          break
        }
      }

      if ($hasValue) { break }
      $valueRow++
    }

    if ($valueRow -ge $data.Count) { break }

    $values = @()
    for ($c = 0; $c -lt 4; $c++) {
      $values += if ($c -lt $data[$valueRow].Count) {
        ([string]$data[$valueRow][$c]).Trim()
      }
      else {
        ""
      }
    }

    $groups.Add([pscustomobject]@{
      Headers = $headers
      Values  = $values
    })

    $cursor = $valueRow + 1
  }

  if ($groups.Count -lt 3) {
    throw "The '$WorksheetName' worksheet did not contain all three four-card rows."
  }

  $testament = $groups[0].Values[0]
  $division = $groups[0].Values[1]
  $books = $groups[0].Values[2]

  if ([string]::IsNullOrWhiteSpace($division)) {
    $division = ($WorksheetName -replace '^OT_|^NT_', '' -replace '_', ' ')
    $division = (Get-Culture).TextInfo.ToTitleCase($division.ToLowerInvariant())
  }

  $pageTitle = if ([string]::IsNullOrWhiteSpace($testament)) {
    $division
  }
  else {
    ($testament.Trim() + " " + $division.Trim())
  }

  $booksHtml = Convert-MtbCanonBooksHeaderHtml $books

  # Three fields from the original first row move into the hero:
  # Testament, Division, and Books.
  # The remaining nine fields form one 3x3 grid.
  $cards = New-Object 'System.Collections.Generic.List[object]'

  $cards.Add([pscustomobject]@{
    Header = $groups[0].Headers[3]
    Value  = $groups[0].Values[3]
  })

  for ($g = 1; $g -lt 3; $g++) {
    for ($c = 0; $c -lt 4; $c++) {
      $cards.Add([pscustomobject]@{
        Header = $groups[$g].Headers[$c]
        Value  = $groups[$g].Values[$c]
      })
    }
  }

  $sb = New-Object System.Text.StringBuilder

  [void]$sb.Append(@'
<style>
.book-modal-panel:has(.mtb-canon-dashboard){
  width:min(1600px,96vw) !important;
  max-width:1600px !important;
}
.mtb-canon-dashboard{
  --mtb-canon-navy:#173a5e;
  --mtb-canon-blue:#2b587f;
  --mtb-canon-soft:#edf3f8;
  --mtb-canon-border:#d3dee8;
  --mtb-canon-gold:#b7832f;
  width:100%;
  max-width:none;
  margin:0 auto;
  padding:6px 2px 34px;
  color:#1d2935;
  font-family:Arial,Helvetica,sans-serif;
}
.mtb-canon-dashboard *{box-sizing:border-box}
.mtb-canon-hero{
  position:relative;
  margin:0 0 24px;
  padding:26px 30px 27px;
  border:1px solid #cbd8e3;
  border-radius:14px;
  background:linear-gradient(135deg,#f7fafc 0%,#e8f0f7 100%);
}
.mtb-canon-eyebrow{
  margin:0 0 7px;
  color:var(--mtb-canon-gold);
  font-size:.78rem;
  font-weight:800;
  letter-spacing:.13em;
  text-transform:uppercase;
}
.mtb-canon-title{
  margin:0;
  color:var(--mtb-canon-navy);
  font-size:clamp(1.8rem,3.2vw,2.55rem);
  line-height:1.1;
}
.mtb-canon-books{
  margin:11px 0 0;
  color:#40566a;
  font-size:1rem;
  line-height:1.55;
}
.mtb-canon-book-range{
  color:var(--mtb-canon-navy);
  font-weight:800;
}
.mtb-canon-book-separator{
  color:#8291a0;
}
.mtb-canon-book-list span[aria-hidden="true"]{
  display:inline-block;
  margin:0 .22rem;
  color:#718397;
}
.mtb-canon-section-heading{
  display:flex;
  align-items:center;
  gap:14px;
  margin:0 0 15px;
  color:var(--mtb-canon-navy);
  font-size:1.18rem;
  font-weight:800;
  letter-spacing:.07em;
  text-transform:uppercase;
}
.mtb-canon-section-heading::after{
  content:"";
  flex:1 1 auto;
  height:1px;
  background:#cfd9e2;
}
.mtb-canon-grid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:19px;
  align-items:stretch;
}
.mtb-canon-card{
  min-width:0;
  overflow:hidden;
  border:1px solid var(--mtb-canon-border);
  border-top:4px solid var(--mtb-canon-blue);
  border-radius:12px;
  background:#fff;
  box-shadow:0 3px 12px rgba(28,55,80,.05);
}
.mtb-canon-card-header{
  padding:17px 19px;
  background:var(--mtb-canon-soft);
  border-bottom:1px solid var(--mtb-canon-border);
}
.mtb-canon-card-title{
  margin:0;
  color:var(--mtb-canon-navy);
  font-size:1.02rem;
  font-weight:800;
  line-height:1.25;
}
.mtb-canon-card-body{
  padding:20px 21px 23px;
  font-size:.97rem;
  line-height:1.64;
}
.mtb-canon-card-body p{margin:0 0 12px}
.mtb-canon-card-body p:last-child{margin-bottom:0}
.mtb-canon-card-body ul{
  margin:0;
  padding-left:1.25rem;
}
.mtb-canon-card-body li{margin:0 0 8px}
.mtb-canon-card-body li:last-child{margin-bottom:0}
.mtb-canon-empty{color:#7b858f;font-style:italic}
.mtb-canon-dashboard .mtb-resource-link{
  color:#1f5fae;
  font-weight:700;
  text-decoration-line:underline;
  text-decoration-style:dotted;
  text-decoration-thickness:2px;
  text-underline-offset:4px;
}
.mtb-canon-dashboard .mtb-resource-link::after{
  content:" ↗";
  font-size:.78em;
  opacity:.78;
}
@media(max-width:1100px){
  .mtb-canon-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:680px){
  .book-modal-panel:has(.mtb-canon-dashboard){
    width:96vw !important;
    padding-left:12px !important;
    padding-right:12px !important;
  }
  .mtb-canon-grid{grid-template-columns:1fr}
  .mtb-canon-hero{padding:21px 18px}
  .mtb-canon-books{font-size:.94rem}
}
</style>
'@)

  [void]$sb.Append('<div class="mtb-canon-dashboard">')
  [void]$sb.Append('<header class="mtb-canon-hero">')
  [void]$sb.Append('<p class="mtb-canon-eyebrow">Canonical Context</p>')
  [void]$sb.Append(
    '<h1 class="mtb-canon-title">' +
    (ConvertTo-HtmlEncoded $pageTitle) +
    '</h1>'
  )

  if (-not [string]::IsNullOrWhiteSpace($booksHtml)) {
    [void]$sb.Append(
      '<p class="mtb-canon-books">' +
      $booksHtml +
      '</p>'
    )
  }

  [void]$sb.Append('</header>')
  [void]$sb.Append('<h2 class="mtb-canon-section-heading">Understanding This Portion</h2>')
  [void]$sb.Append('<div class="mtb-canon-grid">')

  foreach ($card in $cards) {
    $valueHtml = Convert-MtbCanonCellToHtml `
      -Text $card.Value `
      -Header $card.Header

    [void]$sb.Append('<article class="mtb-canon-card">')
    [void]$sb.Append('<header class="mtb-canon-card-header">')
    [void]$sb.Append(
      '<h3 class="mtb-canon-card-title">' +
      (ConvertTo-HtmlEncoded $card.Header) +
      '</h3>'
    )
    [void]$sb.Append('</header>')
    [void]$sb.Append('<div class="mtb-canon-card-body">' + $valueHtml + '</div>')
    [void]$sb.Append('</article>')
  }

  [void]$sb.Append('</div></div>')

  return $sb.ToString()
}

function Write-AllMtbCanonSectionsFromExcel {
  param(
    [Parameter(Mandatory)] [string] $WorkbookPath,
    [Parameter(Mandatory)] [string] $SectionsOutRoot
  )

  $sheetMap = Get-MtbCanonSectionSheetMap

  # Get-ExcelWorksheetNames intentionally returns its array as one object
  # for other generator workflows. Flatten it here before comparing names.
  $rawSheets = Get-ExcelWorksheetNames -WorkbookPath $WorkbookPath
  $availableSheets = New-Object 'System.Collections.Generic.List[string]'

  foreach ($entry in @($rawSheets)) {
    if ($entry -is [System.Array]) {
      foreach ($nestedName in $entry) {
        if (-not [string]::IsNullOrWhiteSpace([string]$nestedName)) {
          $availableSheets.Add(([string]$nestedName).Trim())
        }
      }
    }
    elseif (-not [string]::IsNullOrWhiteSpace([string]$entry)) {
      $availableSheets.Add(([string]$entry).Trim())
    }
  }

  Write-Host "Worksheets found in Canon Sections workbook:" -ForegroundColor Cyan
  foreach ($foundSheet in $availableSheets) {
    Write-Host ("  - " + $foundSheet) -ForegroundColor DarkCyan
  }

  $sheetLookup = @{}
  foreach ($foundSheet in $availableSheets) {
    $sheetLookup[$foundSheet.Trim().ToUpperInvariant()] = $foundSheet
  }

  # Accept either common name for the Pastoral Epistles worksheet.
  $sheetAliases = @{
    "NT_PASTORAL_EPISTLES" = @(
      "NT_PASTORAL_EPISTLES",
      "NT_PASTORAL"
    )
  }

  $written = New-Object 'System.Collections.Generic.List[string]'

  foreach ($expectedSheetName in $sheetMap.Keys) {
    $candidateNames = if ($sheetAliases.ContainsKey($expectedSheetName)) {
      $sheetAliases[$expectedSheetName]
    }
    else {
      @($expectedSheetName)
    }

    $actualSheetName = $null
    foreach ($candidateName in $candidateNames) {
      $key = ([string]$candidateName).Trim().ToUpperInvariant()
      if ($sheetLookup.ContainsKey($key)) {
        $actualSheetName = $sheetLookup[$key]
        break
      }
    }

    if ([string]::IsNullOrWhiteSpace($actualSheetName)) {
      Write-Host (
        "SKIP Canon section worksheet not found: " +
        $expectedSheetName
      ) -ForegroundColor Yellow
      continue
    }

    $relativeFolder = $sheetMap[$expectedSheetName]
    $outDir = Join-Path $SectionsOutRoot $relativeFolder
    Ensure-Path $outDir

    try {
      $html = New-MtbCanonSectionHtmlFromExcel `
        -WorkbookPath $WorkbookPath `
        -WorksheetName $actualSheetName

      $html = Wrap-MtbDocHtml $html "canonical-context"
      $outPath = Join-Path $outDir "index.html"

      [System.IO.File]::WriteAllText(
        $outPath,
        $html,
        [System.Text.UTF8Encoding]::new($false)
      )

      $written.Add($outPath)

      Write-Host (
        "OK   Canon Sections.xlsm [" +
        $actualSheetName +
        "] -> " +
        $relativeFolder +
        "\index.html"
      ) -ForegroundColor Green
    }
    catch {
      Write-Host (
        "FAIL Canon section worksheet: " +
        $actualSheetName
      ) -ForegroundColor Red
      Write-Host $_.Exception.Message -ForegroundColor Red
    }
  }

  return ,$written.ToArray()
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

  # Validate or rebuild the Strong's NKJV JSON cache at the beginning of BOOK mode.
  # Previously this ran only when the first bare verse reference was encountered,
  # which made it look as though nothing was happening during the earlier workbook steps.
  Write-Host "Checking Strong's NKJV JSON cache..." -ForegroundColor Cyan
  Ensure-MtbStrongsJsonCurrent
  Write-Host ""

# Generate the Book Introduction directly from the canonical workbook when present.
  # The canonical authoring workbook now uses .xlsx.
  # Keep .xlsm as a fallback for older books during migration.
  $bookWorkbook = Join-Path $bookSource ($BOOK_SLUG + ".xlsx")

  if (-not (Test-Path -LiteralPath $bookWorkbook -PathType Leaf)) {
    $legacyWorkbook = Join-Path $bookSource ($BOOK_SLUG + ".xlsm")

    if (Test-Path -LiteralPath $legacyWorkbook -PathType Leaf) {
      $bookWorkbook = $legacyWorkbook
    }
  }

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

  if (Test-Path $bookWorkbook) {
    try {
      $cultureNames = Write-AllMtbChapterCulturesFromExcel `
        -WorkbookPath $bookWorkbook `
        -OutBookDir $outDir `
        -BookSlug $BOOK_SLUG

      foreach ($cultureName in $cultureNames) {
        [void]$excelGeneratedOutputNames.Add($cultureName)
      }
    }
    catch {
      Fail (
        "Could not generate East Gate Culture content from " +
        $bookWorkbook +
        ":`n" +
        $_.Exception.Message
      )
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

$count = (Get-ChildItem $outDir -Recurse -File -Filter "*.html" -ErrorAction SilentlyContinue | Measure-Object).Count
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

  if (-not (Test-Path -LiteralPath $DEFAULT_RESOURCES_SRC)) {
    Fail "Resources source not found: $DEFAULT_RESOURCES_SRC"
  }

  $resourcesOutRoot = Join-Path $SITE_ROOT "resources"
  Ensure-Path $resourcesOutRoot

  # -------------------------------------------------------
  # DOCX resources: recurse through every resource subfolder
  # -------------------------------------------------------
  $docxFiles = @(
    Get-ChildItem `
      -LiteralPath $DEFAULT_RESOURCES_SRC `
      -Recurse `
      -Force `
      -ErrorAction Stop |
    Where-Object {
      -not $_.PSIsContainer -and
      $_.Extension -ieq ".docx" -and
      -not $_.Name.StartsWith("~$")
    }
  )

  Write-Host ("DOCX resources found: " + $docxFiles.Count) -ForegroundColor Cyan

  foreach ($docx in $docxFiles) {
    Write-Host ("FOUND DOCX: " + $docx.FullName) -ForegroundColor DarkCyan

    try {
      $relativeDir = $docx.DirectoryName.Substring(
        $DEFAULT_RESOURCES_SRC.Length
      ).TrimStart('\', '/')

      $targetDir = if ([string]::IsNullOrWhiteSpace($relativeDir)) {
        $resourcesOutRoot
      }
      else {
        Join-Path $resourcesOutRoot $relativeDir
      }

      Ensure-Path $targetDir

      $html = Convert-DocxToHtmlFragment $docx.FullName
      $html = Fix-MojibakeHtml $html
      $html = Wrap-MtbDocHtml $html "generic"

      $base = [System.IO.Path]::GetFileNameWithoutExtension($docx.Name)
      $slug = Slugify $base
      $outPath = Join-Path $targetDir ($slug + ".html")

      Set-Content `
        -LiteralPath $outPath `
        -Value $html `
        -Encoding UTF8 `
        -Force

      if (-not (Test-Path -LiteralPath $outPath)) {
        throw "Output file was not created: $outPath"
      }

      Write-Host ("OK   " + $docx.Name + " -> " + $outPath) -ForegroundColor Green
    }
    catch {
      Write-Host ("FAIL " + $docx.FullName) -ForegroundColor Red
      Write-Host ($_.Exception.Message) -ForegroundColor Red
    }
  }

  # -------------------------------------------------------
  # Image resources: copy image and create matching HTML wrapper
  # -------------------------------------------------------
  $imageFiles = @(
    Get-ChildItem `
      -LiteralPath $DEFAULT_RESOURCES_SRC `
      -Recurse `
      -Force `
      -ErrorAction Stop |
    Where-Object {
      -not $_.PSIsContainer -and
      $_.Extension -match '^\.(png|jpg|jpeg|webp)$'
    }
  )

  Write-Host ("Image resources found: " + $imageFiles.Count) -ForegroundColor Cyan

  foreach ($image in $imageFiles) {
    try {
      $relativeDir = $image.DirectoryName.Substring(
        $DEFAULT_RESOURCES_SRC.Length
      ).TrimStart('\', '/')

      $targetDir = if ([string]::IsNullOrWhiteSpace($relativeDir)) {
        $resourcesOutRoot
      }
      else {
        Join-Path $resourcesOutRoot $relativeDir
      }

      Ensure-Path $targetDir

      $base = [System.IO.Path]::GetFileNameWithoutExtension($image.Name)
      $slug = Slugify $base
      $targetImageName = $slug + $image.Extension.ToLowerInvariant()
      $targetImagePath = Join-Path $targetDir $targetImageName

      Copy-Item `
        -LiteralPath $image.FullName `
        -Destination $targetImagePath `
        -Force

      $title = ($base -replace '[-_]+', ' ').Trim()
      $title = (Get-Culture).TextInfo.ToTitleCase($title.ToLowerInvariant())
      $imageNameEncoded = [System.Net.WebUtility]::HtmlEncode($targetImageName)
      $titleEncoded = [System.Net.WebUtility]::HtmlEncode($title)

      $wrapperHtml = @"
<section class="mtb-doc mtb-resource-image" data-doc-type="resource-image">
  <h1>$titleEncoded</h1>
  <figure class="mtb-resource-figure">
    <img src="$imageNameEncoded" alt="$titleEncoded" loading="lazy">
  </figure>
</section>
"@

      $wrapperPath = Join-Path $targetDir ($slug + ".html")
      Set-Content `
        -LiteralPath $wrapperPath `
        -Value $wrapperHtml `
        -Encoding UTF8 `
        -Force

      Write-Host ("COPIED " + $image.Name + " -> " + $targetImagePath) -ForegroundColor Cyan
      Write-Host ("WRAPPED " + $image.Name + " -> " + $wrapperPath) -ForegroundColor Green
    }
    catch {
      Write-Host ("FAIL " + $image.FullName) -ForegroundColor Red
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

  if (-not (Test-Path -LiteralPath $sectionsSrcRoot)) {
    Fail "Sections source not found: $sectionsSrcRoot"
  }

  $canonWorkbook = Join-Path $sectionsSrcRoot "Canon Sections.xlsm"

  if (-not (Test-Path -LiteralPath $canonWorkbook)) {
    $candidate = Get-ChildItem `
      -LiteralPath $sectionsSrcRoot `
      -File `
      -Filter "*.xlsm" `
      -ErrorAction SilentlyContinue |
      Select-Object -First 1

    if ($null -eq $candidate) {
      Fail "Canon Sections workbook not found in: $sectionsSrcRoot"
    }

    $canonWorkbook = $candidate.FullName
  }

  $sectionsOutRoot = Join-Path $SITE_ROOT "sections"
  Ensure-Path $sectionsOutRoot

  $written = Write-AllMtbCanonSectionsFromExcel `
    -WorkbookPath $canonWorkbook `
    -SectionsOutRoot $sectionsOutRoot

  Write-Host ""
  Write-Host (
    "SECTIONS generation complete. Pages written: " +
    $written.Count
  ) -ForegroundColor Green

  exit 0
}

Fail "Unknown mode '$Mode'. Use BOOK, ABOUT, RESOURCES, or SECTIONS."
