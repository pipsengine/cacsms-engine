param([int]$Year = (Get-Date).Year)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$cache = Join-Path $root "data\cot-cache"
$public = Join-Path $root "apps\web\public\data"
$zip = Join-Path $cache "deacot$Year.zip"
$extract = Join-Path $cache "deacot$Year"
$source = "https://www.cftc.gov/files/dea/history/deacot$Year.zip"
New-Item -ItemType Directory -Force -Path $cache, $public | Out-Null
$log = Join-Path $cache "sync.log"
function Log($message) { Add-Content -LiteralPath $log -Value "$((Get-Date).ToUniversalTime().ToString('o')) $message" }
Log "Starting official CFTC Futures Only sync for $Year"
Invoke-WebRequest -Uri $source -OutFile $zip -UseBasicParsing -TimeoutSec 30
$resolvedCache = [IO.Path]::GetFullPath($cache)
$resolvedExtract = [IO.Path]::GetFullPath($extract)
if (-not $resolvedExtract.StartsWith($resolvedCache, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to extract outside the COT cache directory: $resolvedExtract"
}
if (Test-Path $resolvedExtract) { Remove-Item -LiteralPath $resolvedExtract -Recurse -Force }
Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force
$annual = Join-Path $extract "annual.txt"
$mappings = @(
  @{ code="AUD"; name="Australian Dollar"; market="AUSTRALIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE" },
  @{ code="CAD"; name="Canadian Dollar"; market="CANADIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE" },
  @{ code="CHF"; name="Swiss Franc"; market="SWISS FRANC - CHICAGO MERCANTILE EXCHANGE" },
  @{ code="EUR"; name="Euro FX"; market="EURO FX - CHICAGO MERCANTILE EXCHANGE" },
  @{ code="GBP"; name="British Pound"; market="BRITISH POUND - CHICAGO MERCANTILE EXCHANGE" },
  @{ code="JPY"; name="Japanese Yen"; market="JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE" },
  @{ code="NZD"; name="New Zealand Dollar"; market="NEW ZEALAND DOLLAR - CHICAGO MERCANTILE EXCHANGE" },
  @{ code="USD"; name="U.S. Dollar Index"; market="U.S. DOLLAR INDEX - ICE FUTURES U.S." },
  @{ code="XAU"; name="Gold"; market="GOLD - COMMODITY EXCHANGE INC." }
)
function Number($row, $column) { return [int64](($row.$column -replace ",","").Trim()) }
$rows = Import-Csv -LiteralPath $annual
$history = @{}
foreach ($mapping in $mappings) {
  $records = @($rows | Where-Object { $_.'Market and Exchange Names'.Trim() -eq $mapping.market } | ForEach-Object {
    $long = Number $_ 'Noncommercial Positions-Long (All)'
    $short = Number $_ 'Noncommercial Positions-Short (All)'
    $net = $long - $short
    $openInterest = Number $_ 'Open Interest (All)'
    $changeLong = Number $_ 'Change in Noncommercial-Long (All)'
    $changeShort = Number $_ 'Change in Noncommercial-Short (All)'
    $netChange = $changeLong - $changeShort
    $bias = if ($net -gt 0 -and $netChange -gt 0) { "Bullish" } elseif ($net -lt 0 -and $netChange -lt 0) { "Bearish" } elseif ([math]::Abs($net) -lt 10000) { "Neutral" } else { "Mixed" }
    [ordered]@{
      date = $_.'As of Date in Form YYYY-MM-DD'.Trim(); code = $mapping.code; name = $mapping.name; market = $mapping.market
      long = $long; short = $short; changeLong = $changeLong; changeShort = $changeShort
      percent = [math]::Round(($netChange / [math]::Max([math]::Abs($net - $netChange), 1)) * 100, 1)
      net = $net; oi = $openInterest
      longPct = [math]::Round(($long / [math]::Max($openInterest, 1)) * 100, 1)
      shortPct = [math]::Round(($short / [math]::Max($openInterest, 1)) * 100, 1)
      netPct = [math]::Round(($net / [math]::Max($openInterest, 1)) * 100, 1)
      commercialLong = Number $_ 'Commercial Positions-Long (All)'
      commercialShort = Number $_ 'Commercial Positions-Short (All)'
      spreading = Number $_ 'Noncommercial Positions-Spreading (All)'
      bias = $bias; confidence = [math]::Min(95, 60 + [math]::Round([math]::Abs($net / [math]::Max($openInterest, 1)) * 100))
    }
  })
  $history[$mapping.code] = $records
}
$latest = ($rows | Select-Object -ExpandProperty 'As of Date in Form YYYY-MM-DD' | ForEach-Object { $_.Trim() } | Sort-Object -Descending | Select-Object -First 1)
$payload = [ordered]@{
  source = "CFTC Historical Compressed"; sourceUrl = "https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm"
  reportType = "Futures Only Reports"; archiveUrl = $source; year = $Year
  syncedAt = (Get-Date).ToUniversalTime().ToString("o"); latestReportDate = $latest
  mappings = $mappings; history = $history
}
$payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $public "institutional-cot.json") -Encoding utf8
Log "Completed official CFTC Futures Only sync through $latest"
Write-Output "Synced official CFTC Futures Only data through $latest"
