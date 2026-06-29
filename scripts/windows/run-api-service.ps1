$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$publishRoot = Join-Path $repoRoot "backend\publish\api"
$apiDll = Join-Path $publishRoot "Cacsms.Engine.Api.dll"
$envFile = Join-Path $repoRoot ".env"

if (Test-Path -LiteralPath $envFile) {
  Get-Content -LiteralPath $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $parts = $line.Split("=", 2)
    if ($parts.Length -ne 2) { return }
    $key = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"')
    if ($key -ne "" -and [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($key))) {
      [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
  }
}

if (-not (Test-Path -LiteralPath $apiDll)) {
  throw "Published API DLL not found at $apiDll. Run dotnet publish before starting the service."
}

if ([string]::IsNullOrWhiteSpace($env:ASPNETCORE_URLS)) {
  $env:ASPNETCORE_URLS = "http://127.0.0.1:5000;http://127.0.0.1:8787"
}

if ([string]::IsNullOrWhiteSpace($env:ASPNETCORE_ENVIRONMENT)) {
  $env:ASPNETCORE_ENVIRONMENT = "Production"
}

Set-Location $publishRoot
& dotnet $apiDll
