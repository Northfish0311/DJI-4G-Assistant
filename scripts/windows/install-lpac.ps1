$ErrorActionPreference = "Stop"

$root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")
$tools = Join-Path $root "tools"
$installRoot = Join-Path $tools "lpac"
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/estkme-group/lpac/releases/latest" -Headers @{ "User-Agent" = "DJI-Cellular-Dongle-Windows-Hub" }
$asset = @($release.assets) | Where-Object { $_.name -match "windows-x86_64-mingw\.zip$" } | Select-Object -First 1

if (-not $asset) {
  throw "The latest lpac release did not include the expected Windows x86_64 archive."
}

$temporary = Join-Path $env:TEMP ("lpac-" + [guid]::NewGuid().ToString("N"))
$archive = Join-Path $temporary $asset.name
$expanded = Join-Path $temporary "expanded"

try {
  New-Item -ItemType Directory -Path $temporary -Force | Out-Null
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archive
  Expand-Archive -LiteralPath $archive -DestinationPath $expanded -Force
  $lpac = Get-ChildItem -LiteralPath $expanded -Filter "lpac.exe" -Recurse | Select-Object -First 1
  if (-not $lpac) { throw "lpac.exe was not found after extracting the official release." }

  New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
  Get-ChildItem -LiteralPath $lpac.Directory.FullName -File | Copy-Item -Destination $installRoot -Force
  Write-Host "Installed lpac to $installRoot" -ForegroundColor Green
}
finally {
  if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
