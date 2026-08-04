$ErrorActionPreference = "Continue"

Write-Host "== First Run Check =="

Write-Host ""
Write-Host "Node.js:"
if (Get-Command node -ErrorAction SilentlyContinue) {
  node --version
}
else {
  Write-Host "Missing"
}

Write-Host ""
Write-Host "Serial ports:"
[System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object

Write-Host ""
Write-Host "DJI / Quectel devices:"
Get-PnpDevice -PresentOnly |
  Where-Object {
    $_.InstanceId -match "VID_2C7C|VID_2CA3|Quectel|DJI" -or
    $_.FriendlyName -match "Quectel|DJI|Cellular|Wireless Ethernet"
  } |
  Select-Object Class,FriendlyName,Status,InstanceId |
  Format-List

Write-Host ""
Write-Host "LAN IPv4 addresses:"
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254.*" -and
    $_.InterfaceAlias -notmatch "Loopback|Bluetooth|TAP"
  } |
  Select-Object InterfaceAlias,IPAddress |
  Format-Table -AutoSize
