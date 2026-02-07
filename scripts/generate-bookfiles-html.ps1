# =========================================================
# Mastering the Bible - Book-level DOCX -> HTML Generator
# Requires: pandoc on PATH
# =========================================================
#
# What this script does (MTB locked behavior):
# - Converts every .docx in $SRC_ROOT into an HTML fragment (no wrapper HTML)
# - Preserves Word custom styles via: -f docx+styles
# - Wraps consecutive Scripture paragraphs styled "MTB Scripture" (or "MTB Scripture Block")
#   into: <div class="mtb-scripture-block"> ... </div>
# - Strips custom-style attributes so style names never appear in the HTML
#
# Minimal prompts:
# - Prompts only for BOOK_SLUG (chapter prompt removed)

# -----------------------------
# EDIT THESE CONSTANTS
# -----------------------------

# Option 1: set this once (recommended)
$BOOK_SLUG = ""      # example: "obadiah"  (leave blank to prompt)

# Your source docx folder (where your Word files live)
# Example: C:\Users\Mike\Documents\MTB\mtb-source\source\books\old-testament\obadiah
$SRC_ROOT =  "C:\Users\Mike\Documents\MTB\mtb-source\source\books\old-testament\obadiah"

# Your website repo root (folder that contains book.html, index.html, assets, books)
# Example: C:\Users\Mike\Documents\MTB\GitHub\mtb-site
$SITE_ROOT =  "C:\Users\Mike\Documents\MTB\GitHub\mtb-site"

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

function Prompt-IfBlank([string]$value, [string]$label) {
  if ([string]::IsNullOrWhiteSpace($value)) {
    return (Read-Host $label)
  }
  return $value
}

function Slugify([string]$s) {
  $s = $s.Trim().ToLowerInvariant()
  $s = $s -replace '\s+', '-'
  $s = $s -replace '[^a-z0-9\-]', ''
  $s = $s -replace '\-+', '-'
  return $s
}

function Ensure-Folder([string]$path) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
  }
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

function Convert-DocxToHtmlFragment([string]$docxPath) {
  $filterPath = Ensure-MtbPandocFilter $SITE_ROOT

  # IMPORTANT: docx+styles is required, otherwise Word styles are lost.
  # --wrap=none produces fragment HTML for your loader.
  $cmd = @(
    "pandoc",
    "`"$docxPath`"",
    "-f", "docx+styles",
    "-t", "html5",
    "--wrap=none",
    "--lua-filter=`"$filterPath`""
  )

  # Print the command once per file (helps diagnose "mtb not in output" quickly)
  Write-Host ("RUN  " + ($cmd -join " ")) -ForegroundColor DarkGray

  $html = & pandoc $docxPath -f docx+styles -t html5 --wrap=none --lua-filter="$filterPath"
  return $html
}

function Wrap-InDocRoot([string]$innerHtml) {
  return "<div id=`"doc-root`">`n$innerHtml`n</div>`n"
}

# -----------------------------
# MAIN
# -----------------------------

# Validate inputs
$BOOK_SLUG = Prompt-IfBlank $BOOK_SLUG "Book slug (example: obadiah)"
$BOOK_SLUG = Slugify $BOOK_SLUG

if (-not (Test-Path $SRC_ROOT)) {
  Write-Die "SRC_ROOT does not exist: $SRC_ROOT"
}
if (-not (Test-Path $SITE_ROOT)) {
  Write-Die "SITE_ROOT does not exist: $SITE_ROOT"
}

# Decide testament folder based on SRC_ROOT path
$testament = "new-testament"
if ($SRC_ROOT.ToLowerInvariant().Contains("\old-testament\")) { $testament = "old-testament" }
if ($SRC_ROOT.ToLowerInvariant().Contains("\new-testament\")) { $testament = "new-testament" }

$outDir = Join-Path $SITE_ROOT ("books\{0}\{1}\generated" -f $testament, $BOOK_SLUG)
Ensure-Folder $outDir

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ("Generating HTML for book: {0}" -f $BOOK_SLUG) -ForegroundColor Cyan
Write-Host ("Source:  {0}" -f $SRC_ROOT) -ForegroundColor DarkGray
Write-Host ("Output:  {0}" -f $outDir) -ForegroundColor DarkGray
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Convert every DOCX in SRC_ROOT
$docxFiles = Get-ChildItem -Path $SRC_ROOT -Filter "*.docx" -File
if ($docxFiles.Count -eq 0) {
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
    $outName = (Slugify $baseName) + ".html"
    $outPath = Join-Path $outDir $outName

    $frag = Convert-DocxToHtmlFragment $docxPath
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

# =========================================================
# POST-PROCESS: Fix mojibake in generated HTML (encoding-safe)
# =========================================================
# NOTE:
# Do not paste mojibake characters into this script.
# All matching is done via Unicode codepoints on purpose.

# Build the exact "ΓÇö" sequence from codepoints (avoid literal paste issues)
$G  = [char]0x0393   # Γ
$C  = [char]0x00C7   # Ç
$oe = [char]0x00F6   # ö

$GCoe = "$G$C$oe"    # ΓÇö
$Coe  = "$C$oe"      # Çö

Get-ChildItem -Path $outDir -Filter *.html -Recurse -File | ForEach-Object {

  $path = $_.FullName
  $text = Get-Content -Raw -Encoding UTF8 $path

  $fixed = $text `
    -replace [regex]::Escape($GCoe), " - " `
    -replace [regex]::Escape($Coe),  " - "

  if ($fixed -ne $text) {
    Set-Content -Path $path -Encoding UTF8 -NoNewline -Value $fixed
    Write-Host "Cleaned mojibake in: $path" -ForegroundColor Cyan
  }
}

