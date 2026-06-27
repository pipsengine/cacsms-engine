$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$publishRoot = Join-Path $repoRoot "backend\publish\api"
$apiDll = Join-Path $publishRoot "Cacsms.Engine.Api.dll"

if (-not (Test-Path -LiteralPath $apiDll)) {
  throw "Published API DLL not found at $apiDll. Run dotnet publish before starting the service."
}

if ([string]::IsNullOrWhiteSpace($env:ASPNETCORE_URLS)) {
  $env:ASPNETCORE_URLS = "http://127.0.0.1:5000"
}

if ([string]::IsNullOrWhiteSpace($env:ASPNETCORE_ENVIRONMENT)) {
  $env:ASPNETCORE_ENVIRONMENT = "Production"
}

Set-Location $publishRoot
& dotnet $apiDll
