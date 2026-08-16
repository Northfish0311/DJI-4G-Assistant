param(
  [switch]$EnableProfileActions,
  [switch]$EnableProfileDownload,
  [switch]$EnableProfileNickname,
  [switch]$EnableProfileNotifications,
  [switch]$EnableSmsSend,
  [switch]$EnableStockBootstrap
)

$ErrorActionPreference = "Continue"

$root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")
$port = if ($env:PORT) { [int]$env:PORT } else { 8787 }

function Get-LanUrls {
  Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.InterfaceAlias -notmatch "Loopback|Bluetooth|TAP"
    } |
    ForEach-Object {
      $score = 0
      if ($_.InterfaceAlias -match "Wi-?Fi|WLAN|Wireless|无线") { $score += 100 }
      if ($_.IPAddress -like "192.168.225.*") { $score -= 100 }
      [pscustomobject]@{ IPAddress = $_.IPAddress; Score = $score }
    } |
    Sort-Object -Property @{ Expression = "Score"; Descending = $true }, IPAddress |
    Select-Object -ExpandProperty IPAddress -Unique |
    ForEach-Object { "http://$($_):$port" }
}

function Test-Node {
  $node = Get-Command node -ErrorAction SilentlyContinue
  return [bool]$node
}

function Show-Intro {
  Clear-Host
  Write-Host "DJI 4G Assistant for Windows" -ForegroundColor Cyan
  Write-Host "=================" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "1. Plug the DJI / Quectel dongle into this Windows computer."
  Write-Host "2. On this Windows PC, open http://127.0.0.1:$port in any browser."
  Write-Host "3. Optionally, open a LAN URL below from a phone, tablet, or another computer on the same Wi-Fi."
  Write-Host ""
}

Show-Intro

if (-not (Test-Node)) {
  Write-Host "Node.js was not found." -ForegroundColor Yellow
  Write-Host "Install Node.js from https://nodejs.org/ and run this script again."
  Read-Host "Press Enter to close" | Out-Null
  exit 1
}

if ($EnableStockBootstrap -and -not (Test-Path -LiteralPath (Join-Path $root "node_modules\usb"))) {
  Write-Host "Installing the USB helper needed for original-module detection..." -ForegroundColor Yellow
  Set-Location -LiteralPath $root
  & npm.cmd install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) {
    Write-Host "The USB helper could not be installed. Check your internet connection and run the launcher again." -ForegroundColor Red
    Read-Host "Press Enter to close" | Out-Null
    exit 1
  }
}

$urls = @(Get-LanUrls)
if (-not $urls.Count) {
  $urls = @("http://127.0.0.1:$port")
}

Write-Host "Windows PC URL: http://127.0.0.1:$port" -ForegroundColor Green
Write-Host "Optional LAN URLs:" -ForegroundColor Green
foreach ($url in $urls) {
  Write-Host "  $url" -ForegroundColor Green
}

Write-Host ""
Write-Host "This window must stay open while using the web console."
if ($EnableProfileActions) {
  Write-Host "Profile enable/disable controls: ENABLED" -ForegroundColor Yellow
  $env:ALLOW_PROFILE_ACTIONS = "1"
}
else {
  Write-Host "Profile enable/disable controls: locked (read-only mode)"
  $env:ALLOW_PROFILE_ACTIONS = "0"
}
if ($EnableProfileDownload) {
  Write-Host "Profile download controls: ENABLED" -ForegroundColor Yellow
  Write-Host "Only paste an activation code from a plan you own. Existing profiles will not be deleted."
  $env:ALLOW_PROFILE_DOWNLOAD = "1"
}
else {
  Write-Host "Profile download controls: locked (read-only mode)"
  $env:ALLOW_PROFILE_DOWNLOAD = "0"
}
if ($EnableProfileNickname) {
  Write-Host "Profile nickname controls: ENABLED" -ForegroundColor Yellow
  $env:ALLOW_PROFILE_NICKNAME = "1"
}
else {
  $env:ALLOW_PROFILE_NICKNAME = "0"
}
if ($EnableProfileNotifications) {
  Write-Host "Profile notification processing: ENABLED" -ForegroundColor Yellow
  $env:ALLOW_PROFILE_NOTIFICATIONS = "1"
}
else {
  $env:ALLOW_PROFILE_NOTIFICATIONS = "0"
}
if ($EnableSmsSend) {
  Write-Host "SMS sending: ENABLED" -ForegroundColor Yellow
  $env:ALLOW_SMS_SEND = "1"
}
else {
  $env:ALLOW_SMS_SEND = "0"
}
if ($EnableStockBootstrap) {
  Write-Host "Original-module setup: ENABLED" -ForegroundColor Yellow
  Write-Host "This can change a stock 2CA3:4006 module after two explicit confirmations."
  $env:ALLOW_STOCK_BOOTSTRAP = "1"
}
else {
  Write-Host "Original-module setup: locked (read-only mode)"
  $env:ALLOW_STOCK_BOOTSTRAP = "0"
}
Write-Host ""

$env:HOST = if ($env:HOST) { $env:HOST } else { "0.0.0.0" }
$env:PORT = "$port"

Set-Location -LiteralPath $root
node .\web\server.js
