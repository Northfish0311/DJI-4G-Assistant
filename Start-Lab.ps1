param(
  [ValidateSet("DeviceCheck","FindAT","Baseline","LpacEnv","LpacProfiles","WatchUsb","All")]
  [string]$Action = "All",

  [string]$PortName = "",

  [string]$LpacPath = ""
)

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowsScripts = Join-Path $root "scripts\windows"

function Invoke-Step {
  param(
    [string]$Title,
    [scriptblock]$Body
  )

  Write-Host ""
  Write-Host "== $Title =="
  & $Body
}

function Resolve-LpacPath {
  if ($LpacPath -and (Test-Path -LiteralPath $LpacPath)) {
    return (Resolve-Path -LiteralPath $LpacPath).Path
  }

  $candidates = @(
    (Join-Path $root "tools\lpac.exe"),
    (Join-Path (Split-Path -Parent $root) "lpac-windows-x86_64-mingw\lpac.exe"),
    (Join-Path (Split-Path -Parent $root) "EasyLPAC-windows-x86_64-with-lpac\lpac.exe")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  return ""
}

function Resolve-AtPort {
  if ($PortName) {
    return $PortName
  }

  $finder = Join-Path $windowsScripts "find-at-port.ps1"
  $result = & $finder
  $result | Write-Host
  $match = $result | Where-Object { $_ -match "^AT_PORT=(.+)$" } | Select-Object -First 1
  if ($match -match "^AT_PORT=(.+)$") {
    return $Matches[1]
  }

  return ""
}

if ($Action -eq "DeviceCheck" -or $Action -eq "All") {
  Invoke-Step "Device check" {
    & (Join-Path $windowsScripts "read-only-device-check.ps1")
  }
}

if ($Action -eq "WatchUsb") {
  Invoke-Step "USB watch" {
    & (Join-Path $windowsScripts "watch-usb-changes.ps1")
  }
}

if ($Action -eq "FindAT" -or $Action -eq "All") {
  Invoke-Step "Find AT port" {
    & (Join-Path $windowsScripts "find-at-port.ps1")
  }
}

if ($Action -eq "Baseline" -or $Action -eq "All") {
  Invoke-Step "AT baseline" {
    $resolvedPort = Resolve-AtPort
    if (-not $resolvedPort) {
      Write-Host "No AT port found. Plug in the dongle and run again."
      return
    }
    & (Join-Path $windowsScripts "at-baseline.ps1") -PortName $resolvedPort
  }
}

if ($Action -eq "LpacEnv" -or $Action -eq "All") {
  Invoke-Step "lpac AT environment" {
    $resolvedPort = Resolve-AtPort
    if (-not $resolvedPort) {
      Write-Host "No AT port found. lpac over AT cannot run yet."
      return
    }
    $resolvedLpac = Resolve-LpacPath
    if (-not $resolvedLpac) {
      $resolvedLpac = ".\lpac.exe"
    }
    & (Join-Path $windowsScripts "lpac-at-env.ps1") -PortName $resolvedPort -LpacPath $resolvedLpac
  }
}

if ($Action -eq "LpacProfiles" -or $Action -eq "All") {
  Invoke-Step "lpac profile list" {
    $resolvedPort = Resolve-AtPort
    if (-not $resolvedPort) {
      Write-Host "No AT port found. lpac cannot list profiles yet."
      return
    }

    $resolvedLpac = Resolve-LpacPath
    if (-not $resolvedLpac) {
      Write-Host "lpac.exe not found. Download lpac or pass -LpacPath."
      return
    }

    $env:LPAC_APDU = "at"
    $env:LPAC_APDU_AT_DEVICE = $resolvedPort
    $env:LPAC_CUSTOM_ES10X_MSS = "60"
    & $resolvedLpac profile list
  }
}
