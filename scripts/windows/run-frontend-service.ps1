$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$standaloneRoot = Join-Path $repoRoot ".next\standalone"
$server = Join-Path $standaloneRoot "server.js"

if (-not (Test-Path -LiteralPath $server)) {
  throw "Next.js standalone server not found at $server. Run npm run build before starting the service."
}

if ([string]::IsNullOrWhiteSpace($env:PORT)) {
  $env:PORT = "3000"
}

if ([string]::IsNullOrWhiteSpace($env:HOSTNAME)) {
  $env:HOSTNAME = "127.0.0.1"
}

$env:NODE_ENV = "production"

Set-Location $standaloneRoot
& node $server
