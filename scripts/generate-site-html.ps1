# =========================================================
# Mastering the Bible - Unified DOCX -> HTML Generator
# One script for: BOOKS, ABOUT, RESOURCES
#
# Requires: pandoc on PATH
# =========================================================
#
# Locked behavior (MTB):
# - Converts every .docx in SRC_ROOT into an HTML fragment (no full HTML wrapper)
# - Preserves Word custom styles via: -f docx+styles
# - Wraps consecutive Scripture paragraphs styled "MTB Scripture" (or "MTB Scripture Block")
#   into: <div class="mtb-scripture-block"> ... </div>
# - Strips custom-style attributes so style names never appear in the HTML
# - Wraps final output in: <div id="doc-root"> ... </div>
#
# Modes:
# - BOOK: outputs to mtb-site\books\<testament>\<book-slug>\generated\
# - ABOUT: outputs to mtb-site\about\
# - RESOURCES: outputs to mtb-site\resources\
#
# NOTE: This script does NOT build resources.json yet. That is a separate step we can add next.

# -----------------------------
# EDIT THESE CONSTANTS (OPTIONAL)
# -----------------------------

# Your website repo root (folder that contains index.html, book.html, assets, books, about, resources)
$SITE_ROOT = "C:\Users\Mike\Documents\MTB\GitHub\mtb-site"

# Default source folders (optional convenience)
$DEFAULT_BOOK_SRC      = "C:\Users\Mike\Documents\MTB\mtb-source\source\books\old-testament\obadiah"
$DEFAULT_ABOUT_SRC     = "C:\Users\Mike\Documents\MTB\mtb-source\source\about"
$DEFAULT_RESOURCES_SRC = "C:\Users\Mike\Documents\MTB\mtb-source\source\resources"

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

function Slugify([string]$s) {
  $s = $s.Trim().ToLowerInvariant()
  $s = $s -replace '\s+', '-'
  $s = $s -replace '[^a-z0-9\-]', ''
  $s = $s -replace '\-+', '-'
  return $s
}

function Ensure-MtbPandocFilter([string]$siteRoot) {
  # Keep the filter in one stable location inside the site repo
  $toolsDir = Join-Path $siteRoot "_tools\pandoc"
  $filterPath = Join-Path $toolsDir "mtb-styles.lua"

  Ensure-Folder $toolsDir

  # Robust scripture wrapper: works when pandoc attaches custom-style to Para/Plain OR Div.
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

  -- Case 1: block itself carries custom-style=MTB Scripture (common: Div in docx+styles)
  if is_scripture_style_name(get_custom_style(b)) then
    return true
  end

  -- Case 2: Para/Plain contains an inline marker somewhere
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

  # Write to a temp file so PowerShell never decodes pandoc stdout incorrectly
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

# -----------------------------
# MODE ROUTING
# -----------------------------
if (-not (Test-Path $SITE_ROOT)) {
  Write-Die "SITE_ROOT does not exist: $SITE_ROOT"
}

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
  $SRC_ROOT = Prompt-NonEmpty "Source DOCX folder for this BOOK" $DEFAULT_BOOK_SRC
  $BOOK_SLUG = Prompt-NonEmpty "Book slug (example: obadiah)" ""
  $BOOK_SLUG = Slugify $BOOK_SLUG

  # Decide testament folder based on SRC_ROOT path (keeps your prior behavior)
  $testament = "new-testament"
  if ($SRC_ROOT.ToLowerInvariant().Contains("\old-testament\")) { $testament = "old-testament" }
  if ($SRC_ROOT.ToLowerInvariant().Contains("\new-testament\")) { $testament = "new-testament" }

  $outDir = Join-Path $SITE_ROOT ("books\{0}\{1}\generated" -f $testament, $BOOK_SLUG)
}
elseif ($IsAbout) {
  $SRC_ROOT = $DEFAULT_ABOUT_SRC
  Write-Host ("Using ABOUT source: {0}" -f $SRC_ROOT) -ForegroundColor DarkGray
  $outDir = Join-Path $SITE_ROOT "about"
}
elseif ($IsResources) {
  $SRC_ROOT = $DEFAULT_RESOURCES_SRC
  Write-Host ("Using RESOURCES source: {0}" -f $SRC_ROOT) -ForegroundColor DarkGray
  $outDir = Join-Path $SITE_ROOT "resources"
}


if (-not (Test-Path $SRC_ROOT)) {
  Write-Die "SRC_ROOT does not exist: $SRC_ROOT"
}

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


# UTF8 without BOM for stable browser reading
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$converted = 0
$skipped = 0

foreach ($f in $docxFiles) {
  try {
    $docxPath = $f.FullName
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)

    # Output filename: slugified doc name
    $outName = (Slugify $baseName) + ".html"
    $outPath = Join-Path $outDir $outName

    $frag = Convert-DocxToHtmlFragment $docxPath $SITE_ROOT
    if ([string]::IsNullOrWhiteSpace($frag)) {
      throw "Pandoc returned empty output."
    }

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

# NOTE:
# - Next step (later): for RESOURCES mode, generate /resources/resources.json from first two blocks.
$resourcesDir = "C:\Users\Mike\Documents\MTB\GitHub\mtb-site\resources"
$outJson = Join-Path $resourcesDir "resources.json"

function Strip-Tags([string]$s) {
  if (-not $s) { return "" }
  $t = [regex]::Replace($s, "<[^>]+>", "")
  $t = $t -replace "\s+", " "
  return $t.Trim()
}

function Get-FirstTwoBlocks([string]$html) {
  # Grab first two <p> blocks (Pandoc will normally emit title/desc as first two paragraphs)
  $ms = [regex]::Matches($html, "(?is)<p\b[^>]*>.*?</p>")
  $first = if ($ms.Count -ge 1) { Strip-Tags $ms[0].Value } else { "" }
  $second = if ($ms.Count -ge 2) { Strip-Tags $ms[1].Value } else { "" }
  return @($first, $second)
}
function Clean-Meta([string]$s) {
  if (-not $s) { return "" }
  $t = $s.Trim()
  $t = $t -replace '^(Title|Description)\s*:\s*', ''
  return $t.Trim()
}

$items = @()
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
