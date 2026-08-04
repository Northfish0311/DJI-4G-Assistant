$ErrorActionPreference = "Continue"

$adapterName = "手机网络 2"
$deviceId = "USB\VID_2C7C&PID_0125&MI_04\6&211e2832&1&0004"

Write-Host "== Before =="
Get-NetAdapter -Name $adapterName -ErrorAction SilentlyContinue |
  Select-Object Name,InterfaceDescription,Status,LinkSpeed,MacAddress,ifIndex |
  Format-Table -AutoSize

ipconfig /all

Write-Host ""
Write-Host "== Enable DHCP if Windows exposes an IP interface =="
try {
  Set-NetIPInterface -InterfaceAlias $adapterName -AddressFamily IPv4 -Dhcp Enabled -ErrorAction Continue
  Set-NetIPInterface -InterfaceAlias $adapterName -AddressFamily IPv6 -Dhcp Enabled -ErrorAction Continue
}
catch {
  Write-Host "Set-NetIPInterface skipped or failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "== Restart adapter =="
try {
  Disable-NetAdapter -Name $adapterName -Confirm:$false -ErrorAction Stop
  Start-Sleep -Seconds 3
  Enable-NetAdapter -Name $adapterName -Confirm:$false -ErrorAction Stop
  Start-Sleep -Seconds 8
}
catch {
  Write-Host "NetAdapter restart failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "== Restart PnP device if needed =="
try {
  pnputil /restart-device $deviceId
  Start-Sleep -Seconds 8
}
catch {
  Write-Host "PnP restart failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "== After =="
Get-NetAdapter -Name $adapterName -ErrorAction SilentlyContinue |
  Select-Object Name,InterfaceDescription,Status,LinkSpeed,MacAddress,ifIndex |
  Format-Table -AutoSize

ipconfig /all

Write-Host ""
Write-Host "Done. Press Enter to close."
Read-Host | Out-Null
