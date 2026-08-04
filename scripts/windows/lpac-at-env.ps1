param(
  [string]$PortName = "COM5",
  [string]$LpacPath = ".\lpac.exe"
)

$env:LPAC_APDU = "at"
$env:LPAC_APDU_AT_DEVICE = $PortName
$env:LPAC_CUSTOM_ES10X_MSS = "60"

Write-Host "LPAC_APDU=$env:LPAC_APDU"
Write-Host "LPAC_APDU_AT_DEVICE=$env:LPAC_APDU_AT_DEVICE"
Write-Host "LPAC_CUSTOM_ES10X_MSS=$env:LPAC_CUSTOM_ES10X_MSS"
Write-Host ""
Write-Host "Try:"
Write-Host "  & `"$LpacPath`" chip info"
Write-Host "  & `"$LpacPath`" profile list"
