param(
  [string]$SourceCsv = "C:\Users\Mike\Documents\MTB\mtb-source\source\loc-head\life-of-christ-harmony-table.csv",
  [string]$OutJson   = "C:\Users\Mike\Documents\MTB\GitHub\mtb-site\assets\js\loc\life-of-christ-harmony-table.json"
)

if (!(Test-Path $SourceCsv)) { throw "Missing CSV: $SourceCsv" }

$rows = Import-Csv $SourceCsv

function Pad-Seq([string]$s) {
  $n = 0
  [void][int]::TryParse($s, [ref]$n)
  return $n.ToString("000")
}

# Normalize for browser use
$out = foreach ($r in $rows) {
  $seqRaw = "$($r.Seq)".Trim()
  $seqPad = Pad-Seq $seqRaw

  [pscustomobject]@{
    seq        = $seqPad
    seqNum     = [int]$seqRaw
    rollup     = ("$($r.Rollup)".Trim())
    phase      = ("$($r.Phase)".Trim())
    approxDate = ("$($r.'Approx Date')".Trim())
    title      = ("$($r.'Event Title')".Trim())
    refs       = @{
      matthew = ("$($r.Matthew)".Trim())
      mark    = ("$($r.Mark)".Trim())
      luke    = ("$($r.Luke)".Trim())
      john    = ("$($r.John)".Trim())
    }
  }
}

$dir = Split-Path $OutJson -Parent
if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

($out | ConvertTo-Json -Depth 10) | Set-Content -Encoding UTF8 $OutJson

Write-Host "Wrote:" $OutJson
Write-Host "Rows :" $out.Count
