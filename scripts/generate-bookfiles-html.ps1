# =========================================================
# Mastering the Bible - Unified DOCX -> HTML Generator
# One script for: BOOKS, ABOUT, RESOURCES
#
# Requires: pandoc on PATH
# PowerShell: Windows PowerShell 5.1 compatible
# =========================================================

# -----------------------------
# EDIT THESE CONSTANTS (ONCE)
# -----------------------------

# Your website repo root (folder that contains index.html, book.html, assets, books, about, resources)
$SITE_ROOT = "C:\Users\Mike\Documents\MTB\GitHub\mtb-site"

# MTB source root (folder that contains: books\old-testament\..., books\new-testament\..., about, resources)
$MTB_SOURCE_ROOT = "C:\Users\Mike\Documents\MTB\mtb-source\source"

# Standard source folders
$DEFAULT_ABOUT_SRC     = Join-Path $MTB_SOURCE_ROOT "about"
$DEFAULT_RESOURCES_SRC = Join-Path $MTB_SOURCE_ROOT "resources"

# -----------------------------
# END CONSTANTS
# -----------------------------

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Die([string]$msg) {
  Write-Host ""
  Write-Host $msg -ForegroundColor Red
  Write-Host ""
  exit 1
}

function Ensure-Folder([string]$path) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
  }
}

function Prompt-NonEmpty([string]$label, [string]$defaultValue = "") {
  while ($true) {
    $prompt = $label
    if (-not [string]::IsNullOrWhiteSpace($defaultValue)) {
      $prompt = "$label [$defaultValue]"
    }
    $v = (Read-Host $prompt).Trim()
    if ([string]::IsNullOrWhiteSpace($v)) { $v = $defaultValue }
    if (-not [string]::IsNullOrWhiteSpace($v)) { return $v }
  }
}

function Ask-YesNo([string]$q) {
  while ($true) {
    $a = (Read-Host "$q (y/n)").Trim().ToLowerInvariant()
    if ($a -in @("y","yes")) { return $true }
    if ($a -in @("n","no"))  { return $false }
  }
}

# Canonical site slug: "3John" -> "3-john", "1 Corinthians" -> "1-corinthians"
function Slugify([string]$s) {
  if ([string]::IsNullOrWhiteSpace($s)) { return "" }

  $s = $s.Trim().ToLowerInvariant()

  # Convert "3John" -> "3 John", "1Peter" -> "1 Peter" so we get proper hyphens later
  $s = $s -replace '^(\d+)([a-z])', '$1 $2'

  # Normalize whitespace to hyphens
  $s = $s -replace '\s+', '-'

  # Remove everything except a-z, 0-9, and hyphen
  $s = $s -replace '[^a-z0-9\-]', ''

  # Collapse multiple hyphens
  $s = $s -replace '\-+', '-'

  return $s
}

function Ensure-MtbPandocFilter([string]$siteRoot) {
  $toolsDir = Join-Path $siteRoot "_tools\pandoc"
  $filterPath = Join-Path $toolsDir "mtb-styles.lua"

  Ensure-Folder $toolsDir

  $lua = @'
-- MTB Scripture Block wrapper (robust)
-- Requires pandoc input: docx+styles
--
-- Wraps consecutive blocks marked with:
--   custom-style = "MTB Scripture" OR "MTB Scripture Block"
-- into:
--   <div class="mtb-scripture-block"> ... </div>
--
-- Also strips all "custom-style" attributes so style names never appear in output.

local SCRIPTURE_STYLES = {
  ["MTB Scripture"] = true,
  ["MTB Scripture Block"] = true
}

local function get_custom_style(el)
  if not el or not el.attr or not el.attr.attributes then return nil end
  return el.attr.attributes["custom-style"]
end

local function is_scripture_style_name(name)
  return name and SCRIPTURE_STYLES[name] or false
end

local function strip_custom_style(el)
  if el and el.attr and el.attr.attributes then
    el.attr.attributes["custom-style"] = nil
  end
  return el
end

local function inline_contains_scripture(inl)
  if not inl then return false end

  if inl.t == "Span" then
    if is_scripture_style_name(get_custom_style(inl)) then return true end
    if inl.content then
      for _, c in ipairs(inl.content) do
        if inline_contains_scripture(c) then return true end
      end
    end
    return false
  end

  if inl.content and type(inl.content) == "table" then
    for _, c in ipairs(inl.content) do
      if inline_contains_scripture(c) then return true end
    end
  end

  return false
end

local function block_is_scripture(b)
  if not b then return false end

  if is_scripture_style_name(get_custom_style(b)) then
    return true
  end

  if (b.t == "Para" or b.t == "Plain") and b.content then
    for _, inl in ipairs(b.content) do
      if inline_contains_scripture(inl) then return true end
    end
  end

  return false
end

function Pandoc(doc)
  local out = pandoc.List:new()
  local blocks = doc.blocks
  local i = 1

  while i <= #blocks do
    local b = blocks[i]

    if block_is_scripture(b) then
      local group = pandoc.List:new()

      while i <= #blocks and block_is_scripture(blocks[i]) do
        group:insert(strip_custom_style(blocks[i]))
        i = i + 1
      end

      out:insert(pandoc.Div(group, pandoc.Attr("", {"mtb-scripture-block"}, {})))
    else
      out:insert(strip_custom_style(b))
      i = i + 1
    end
  end

  doc.blocks = out
  return doc
end
'@

  Set-Content -Path $filterPath -Value $lua -Encoding UTF8
  return $filterPath
}

function Convert-DocxToHtmlFragment([string]$docxPath, [string]$siteRoot) {
  $filterPath = Ensure-MtbPandocFilter $siteRoot
  $tmp = [System.IO.Path]::ChangeExtension([System.IO.Path]::GetTempFileName(), ".html")

  Write-Host ("RUN  pandoc `"$docxPath`" -f docx+styles -t html5 --wrap=none --lua-filter=`"$filterPath`" -o `"$tmp`"") -ForegroundColor DarkGray
  & pandoc $docxPath -f docx+styles -t html5 --wrap=none --lua-filter="$filterPath" -o $tmp | Out-Null

  if (-not (Test-Path $tmp)) { throw "Pandoc did not produce output file." }

  $html = Get-Content -Path $tmp -Raw -Encoding UTF8
  Remove-Item $tmp -ErrorAction SilentlyContinue
  return $html
}

function Wrap-InDocRoot([string]$innerHtml) {
  return "<div id=`"doc-root`">`n$innerHtml`n</div>`n"
}

function Ensure-ResourcesIndexPages([string]$outDir, [string]$bookSlug) {
  # Create {book}-{chapter}-resources.html (chapter index) when missing.
  # It lists any existing {book}-{chapter}-resources-*.html topic pages.
  # Chapter 0 (book-level files) are ignored for resources.

  $DASH = "[-–—]"  # ASCII hyphen, en dash, em dash

  $rxAny = [regex]("^" + [regex]::Escape($bookSlug) + "$DASH(?<ch>\d+)$DASH.+?\.html$", "IgnoreCase")
  $rxTopic = [regex]("^" + [regex]::Escape($bookSlug) + "$DASH(?<ch>\d+)$DASHresources$DASH.+?\.html$", "IgnoreCase")

  $chapters = New-Object System.Collections.Generic.HashSet[int]
  $topicsByCh = @{}

  Get-ChildItem -Path $outDir -Filter "*.html" -File | ForEach-Object {

    $mAny = $rxAny.Match($_.Name)
    if ($mAny.Success) {
      $chInt = [int]$mAny.Groups["ch"].Value
      if ($chInt -ge 1) { [void]$chapters.Add($chInt) }
    }

    $mTopic = $rxTopic.Match($_.Name)
    if ($mTopic.Success) {
      $chInt = [int]$mTopic.Groups["ch"].Value
      if ($chInt -lt 1) { return }

      if (-not $topicsByCh.ContainsKey($chInt)) { $topicsByCh[$chInt] = @() }
      $topicsByCh[$chInt] += $_.Name
    }
  }

  foreach ($ch in ($chapters | Sort-Object)) {

    $indexName = "$bookSlug-$ch-resources.html"
    $indexPath = Join-Path $outDir $indexName

    # Always (re)build the chapter resources index so new topic files
    # are picked up automatically.

    $topicFiles = @()
    if ($topicsByCh.ContainsKey($ch)) { $topicFiles = $topicsByCh[$ch] | Sort-Object }

    $lines = @()
    $lines += "<div id=`"doc-root`">"
    $lines += "<h1>Chapter Resources</h1>"

    if ($topicFiles.Count -eq 0) {
      $lines += "<p>No additional chapter resources are available yet.</p>"
    } else {
      $lines += "<p>Additional resources for this chapter:</p>"
      $lines += "<ul>"
      foreach ($fn in $topicFiles) {
        # Turn "{book}-{ch}-resources-truth.html" into "Truth"
        $prefixRx = "^" + [regex]::Escape($bookSlug) + $DASH + $ch + $DASH + "resources" + $DASH
        $label = $fn -replace $prefixRx, ""
        $label = $label -replace "\.html$",""
        $label = ($label -replace $DASH," ")
        $label = (Get-Culture).TextInfo.ToTitleCase($label)
        # IMPORTANT: when this HTML is injected into book.html,
        # relative links would resolve against /book.html and break.
        # So we link back into the shell using query params.
        $href = ("/book.html?book={0}&chapter={1}&tab=resources&doc={2}" -f $bookSlug, $ch, $fn)
        $lines += ("  <li><a href=`"{0}`">{1}</a></li>" -f $href, $label)
      }
      $lines += "</ul>"
    }

    $lines += "</div>"

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($indexPath, ($lines -join "`n") + "`n", $utf8NoBom)

    Write-Host ("MAKE {0}" -f $indexName) -ForegroundColor Green
  }
}


# Resolve source folder using BOTH:
#   canonical slug: 3-john
#   source style:   3john / 1corinthians / etc. (matches 3John / 1Corinthians folders)
function Resolve-BookSource([string]$bookSlug, [string]$rawBookInput, [ref]$testamentOut) {
  $booksBase = Join-Path $MTB_SOURCE_ROOT "books"

  $rawSafe = ""
  if ($null -ne $rawBookInput) { $rawSafe = $rawBookInput }
  $rawSafe = $rawSafe.Trim()

  $candidates = @()

  if (-not [string]::IsNullOrWhiteSpace($bookSlug)) {
    $candidates += $bookSlug
    $candidates += ($bookSlug -replace "-", "")
  }

  if (-not [string]::IsNullOrWhiteSpace($rawSafe)) {
    $rawNorm = $rawSafe
    $rawNorm = $rawNorm -replace "\s+", ""
    $rawNorm = $rawNorm -replace "-", ""
    $rawNorm = $rawNorm -replace "[^A-Za-z0-9]", ""
    if (-not [string]::IsNullOrWhiteSpace($rawNorm)) {
      $candidates += $rawNorm
      $candidates += $rawNorm.ToLowerInvariant()
    }
  }

  $candidates = $candidates | Select-Object -Unique

  foreach ($cand in $candidates) {
    $ot = Join-Path $booksBase ("old-testament\{0}" -f $cand)
    $nt = Join-Path $booksBase ("new-testament\{0}" -f $cand)

    if (Test-Path $ot) { $testamentOut.Value = "old-testament"; return $ot }
    if (Test-Path $nt) { $testamentOut.Value = "new-testament"; return $nt }
  }

  $otExpected = Join-Path $booksBase ("old-testament\{0}" -f $bookSlug)
  $ntExpected = Join-Path $booksBase ("new-testament\{0}" -f $bookSlug)

  Write-Die "Could not find book source folder for slug '$bookSlug'. Expected one of:`n$otExpected`n$ntExpected`nTried these source variants: $($candidates -join ', ')"
}

# -----------------------------
# MODE ROUTING
# -----------------------------
if (-not (Test-Path $SITE_ROOT)) { Write-Die "SITE_ROOT does not exist: $SITE_ROOT" }
if (-not (Test-Path $MTB_SOURCE_ROOT)) { Write-Die "MTB_SOURCE_ROOT does not exist: $MTB_SOURCE_ROOT" }

$IsBook = Ask-YesNo "Is this a BOOK upload"
$IsAbout = $false
$IsResources = $false

if (-not $IsBook) {
  $IsAbout = Ask-YesNo "Is this an ABOUT upload"
  if (-not $IsAbout) {
    $IsResources = Ask-YesNo "Is this a RESOURCES upload"
  }
}

if (-not ($IsBook -or $IsAbout -or $IsResources)) {
  Write-Die "No mode selected. Exiting."
}

# -----------------------------
# INPUTS + OUTPUT TARGET
# -----------------------------
$SRC_ROOT = ""
$outDir = ""
$BOOK_SLUG = ""
$testament = ""

if ($IsBook) {
  $rawBook = Prompt-NonEmpty "Book (examples: obadiah, 3 John, 3John, 1Corinthians, 1 Corinthians)" ""
  $BOOK_SLUG = Slugify $rawBook

  $testRef = [ref] ""
  $SRC_ROOT = Resolve-BookSource $BOOK_SLUG $rawBook $testRef
  $testament = $testRef.Value

  $outDir = Join-Path $SITE_ROOT ("books\{0}\{1}\generated" -f $testament, $BOOK_SLUG)
}
elseif ($IsAbout) {
  $SRC_ROOT = $DEFAULT_ABOUT_SRC
  $outDir = Join-Path $SITE_ROOT "about"
}
elseif ($IsResources) {
  $SRC_ROOT = $DEFAULT_RESOURCES_SRC
  $outDir = Join-Path $SITE_ROOT "resources"
}

if (-not (Test-Path $SRC_ROOT)) { Write-Die "SRC_ROOT does not exist: $SRC_ROOT" }
Ensure-Folder $outDir

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
if ($IsBook) {
  Write-Host ("MODE:   BOOK  ({0} / {1})" -f $testament, $BOOK_SLUG) -ForegroundColor Cyan
} elseif ($IsAbout) {
  Write-Host "MODE:   ABOUT" -ForegroundColor Cyan
} else {
  Write-Host "MODE:   RESOURCES" -ForegroundColor Cyan
}
Write-Host ("Source: {0}" -f $SRC_ROOT) -ForegroundColor DarkGray
Write-Host ("Output: {0}" -f $outDir) -ForegroundColor DarkGray
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------
# CONVERT DOCX FILES
# -----------------------------
$docxFiles = @(Get-ChildItem -Path $SRC_ROOT -Filter "*.docx" -File)
if ($docxFiles.Length -eq 0) {
  Write-Die "No DOCX files found in: $SRC_ROOT"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$converted = 0
$skipped = 0

foreach ($f in $docxFiles) {
  try {
    $docxPath = $f.FullName
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)

    $outName = (Slugify $baseName) + ".html"
    $outPath = Join-Path $outDir $outName

    $frag = Convert-DocxToHtmlFragment $docxPath $SITE_ROOT
    if ([string]::IsNullOrWhiteSpace($frag)) { throw "Pandoc returned empty output." }

    $final = Wrap-InDocRoot $frag
    [System.IO.File]::WriteAllText($outPath, $final, $utf8NoBom)

    Write-Host ("OK   {0}  ->  {1}" -f $f.Name, $outName) -ForegroundColor Green
    $converted++
  }
  catch {
    Write-Host ("SKIP {0}  ({1})" -f $f.Name, $_.Exception.Message) -ForegroundColor Yellow
    $skipped++
  }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
Write-Host ("Converted: {0}" -f $converted)
Write-Host ("Skipped:   {0}" -f $skipped)
Write-Host ""


if ($IsBook) {
  Ensure-ResourcesIndexPages $outDir $BOOK_SLUG
}
# -----------------------------
# RESOURCES.JSON (always refresh when script runs)
# -----------------------------
$resourcesDir = Join-Path $SITE_ROOT "resources"
$outJson = Join-Path $resourcesDir "resources.json"

function Strip-Tags([string]$s) {
  if (-not $s) { return "" }
  $t = [regex]::Replace($s, "<[^>]+>", "")
  $t = $t -replace "\s+", " "
  return $t.Trim()
}

function Get-FirstTwoBlocks([string]$html) {
  $ms = [regex]::Matches($html, "(?is)<p\b[^>]*>.*?</p>")
  $first = if ($ms.Count -ge 1) { Strip-Tags $ms[0].Value } else { "" }
  $second = if ($ms.Count -ge 2) { Strip-Tags $ms[1].Value } else { "" }
  return @($first, $second)
}

$items = @()
if (Test-Path $resourcesDir) {
  Get-ChildItem $resourcesDir -Filter *.html -File |
    Where-Object { $_.Name -notin @("index.html", "view.html") } |
    Sort-Object Name |
    ForEach-Object {
      $html = Get-Content $_.FullName -Raw -Encoding UTF8
      $meta = Get-FirstTwoBlocks $html
      $items += [pscustomobject]@{
        file = $_.Name
        title = $meta[0]
        description = $meta[1]
      }
    }

  @($items) | ConvertTo-Json -Depth 4 | Set-Content -Path $outJson -Encoding UTF8
  Write-Host "Wrote: $outJson"
}
