$ErrorActionPreference = "Continue"

Write-Host "== Serial ports =="
$ports = [System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object
$ports

Write-Host ""
Write-Host "== Read-only device check =="
Write-Host "The serial-port list is available without administrator access."
if ($ports -match "COM") {
  Write-Host "USB modem serial interfaces are present; Find AT can identify the control port."
}
else {
  Write-Host "No serial interfaces found. Replug the dongle and check the cable."
}

Write-Host ""
Write-Host "== Optional Windows device details =="
try {
  $pnpMatches = Get-PnpDevice -PresentOnly -ErrorAction Stop |
    Where-Object {
      $_.InstanceId -match "VID_2C7C|VID_2CA3" -or
      $_.FriendlyName -match "Quectel|DJI|Cellular|Mobile|Wireless Ethernet"
    } |
    Select-Object Class,FriendlyName,Status,InstanceId

  if ($pnpMatches) { $pnpMatches | Format-List }
  else { Write-Host "No matching PnP detail returned." }
}
catch {
  Write-Host "Windows denied the optional PnP query. This does not mean the modem is absent."
  Write-Host "Run the launcher as administrator only if you need detailed adapter diagnostics."
}

try {
  $adapterMatches = Get-NetAdapter -ErrorAction Stop |
    Where-Object {
      $_.Name -match "Mobile|Cellular|Quectel|Ethernet" -or
      $_.InterfaceDescription -match "Quectel|Mobile|Cellular|Wireless Ethernet"
    } |
    Select-Object Name,InterfaceDescription,Status,LinkSpeed,MacAddress,ifIndex

  if ($adapterMatches) { $adapterMatches | Format-Table -AutoSize }
  else { Write-Host "No matching network adapter detail returned." }
}
catch {
  Write-Host "Windows denied the optional network-adapter query. The AT and module checks remain usable."
}
