$ErrorActionPreference = "Continue"

Write-Host "== Serial ports =="
$ports = [System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object
$ports

$serialDetails = @()
try {
  $serialDetails = @(Get-CimInstance Win32_SerialPort -ErrorAction Stop)
}
catch {
  Write-Host "Windows denied serial-port metadata. Find AT can still probe non-Bluetooth ports."
}

$usbModemPorts = @($serialDetails | Where-Object {
  $identity = "$($_.Name) $($_.Description) $($_.PNPDeviceID)"
  $identity -notmatch "BTHENUM|Bluetooth" -and (
    $identity -match "USB\\VID_|VID_2C7C|VID_2CA3|Quectel|DJI|Baiwang|QDC507|Modem"
  )
})

Write-Host ""
Write-Host "== Read-only device check =="
Write-Host "The serial-port list is available without administrator access."
if ($usbModemPorts.Count -gt 0) {
  Write-Host "USB modem serial interfaces are present; Find AT can identify the control port."
}
elseif ($ports -match "COM") {
  Write-Host "Serial ports were found, but none are USB modem interfaces. Bluetooth serial ports are ignored."
}
else {
  Write-Host "No serial interfaces found. Replug the dongle and check the cable."
}

Write-Host ""
Write-Host "== Optional Windows device details =="
try {
  # Get-PnpDevice costs 10-13 s even in a warm session because it walks every device.
  # The registry keeps the same identifiers and answers in about 0.2 s, so read it instead
  # and label the output honestly: entries here include devices seen before, not only the
  # ones plugged in right now.
  $usbRoot = "HKLM:\SYSTEM\CurrentControlSet\Enum\USB"
  $pnpMatches = @()
  foreach ($vidKey in (Get-ChildItem $usbRoot -ErrorAction SilentlyContinue |
      Where-Object { $_.PSChildName -match "VID_2C7C|VID_2CA3" })) {
    foreach ($instKey in (Get-ChildItem $vidKey.PSPath -ErrorAction SilentlyContinue)) {
      $props = Get-ItemProperty $instKey.PSPath -ErrorAction SilentlyContinue
      $desc = [string]$props.DeviceDesc
      if ($desc -match ';(.+)$') { $desc = $Matches[1].Trim() }
      $pnpMatches += [pscustomobject]@{
        FriendlyName = $desc
        InstanceId   = "USB\$($vidKey.PSChildName)\$($instKey.PSChildName)"
      }
    }
  }

  if ($pnpMatches) {
    Write-Host "Modules Windows has registered (includes devices seen before):"
    $pnpMatches | Select-Object FriendlyName,InstanceId | Format-List
    Write-Host "A module that is plugged in but missing from the serial-port list above did not enumerate; try another cable or port."
  }
  else { Write-Host "No module identifiers registered yet on this computer." }
}
catch {
  Write-Host "Windows denied the optional device query. This does not mean the modem is absent."
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
