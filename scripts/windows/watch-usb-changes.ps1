param(
  [int]$Seconds = 90,
  [int]$IntervalSeconds = 2
)

$ErrorActionPreference = "Continue"

function Get-UsbSnapshot {
  Get-PnpDevice -PresentOnly |
    Where-Object {
      $_.InstanceId -match "USB\\VID_|VID_2C7C|VID_2CA3|Quectel|DJI" -or
      $_.FriendlyName -match "Quectel|DJI|QIink|Cellular|Mobile|Wireless Ethernet|USB"
    } |
    Select-Object Class,FriendlyName,Status,InstanceId |
    Sort-Object InstanceId
}

function Format-DeviceLine {
  param($Device)
  "{0} | {1} | {2} | {3}" -f $Device.Class,$Device.Status,$Device.FriendlyName,$Device.InstanceId
}

Write-Host "Watching USB/PnP changes for $Seconds seconds."
Write-Host "Plug or unplug the DJI dongle now."
Write-Host ""

$previous = Get-UsbSnapshot
$previousMap = @{}
foreach ($item in $previous) {
  $previousMap[$item.InstanceId] = $item
}

Write-Host "Initial matching devices:"
foreach ($item in $previous) {
  Format-DeviceLine $item
}

$end = (Get-Date).AddSeconds($Seconds)

while ((Get-Date) -lt $end) {
  Start-Sleep -Seconds $IntervalSeconds

  $current = Get-UsbSnapshot
  $currentMap = @{}
  foreach ($item in $current) {
    $currentMap[$item.InstanceId] = $item
  }

  foreach ($id in $currentMap.Keys) {
    if (-not $previousMap.ContainsKey($id)) {
      Write-Host ""
      Write-Host "[ADDED] $(Get-Date -Format 'HH:mm:ss')"
      Format-DeviceLine $currentMap[$id]
    }
  }

  foreach ($id in $previousMap.Keys) {
    if (-not $currentMap.ContainsKey($id)) {
      Write-Host ""
      Write-Host "[REMOVED] $(Get-Date -Format 'HH:mm:ss')"
      Format-DeviceLine $previousMap[$id]
    }
  }

  $previousMap = $currentMap
}

Write-Host ""
Write-Host "Done."
