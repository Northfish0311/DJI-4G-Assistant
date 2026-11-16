[CmdletBinding()]
param(
  [ValidateSet('Check','Prefer','Restore')][string]$Mode = 'Check',
  [guid]$ExpectedGuid = [guid]::Empty
)
$ErrorActionPreference = 'Stop'

function Get-Dongle {
  $found = @(Get-NetAdapter -Physical | Where-Object {
    $_.PnPDeviceID -match '^USB\\VID_2C7C&PID_0125&MI_04\\' -and
    $_.InterfaceDescription -match '^Quectel ECM Adapter(?: #\d+)?$'
  })
  if (!$found.Count) { throw 'noDongle' }
  if ($found.Count -ne 1) { throw 'ambiguous' }
  return $found[0]
}
function Get-WifiCost {
  $indices = @(Get-NetAdapter -Physical | Where-Object {
    $_.Status -eq 'Up' -and [int]$_.NdisPhysicalMedium -in @(1,9)
  } | Select-Object -ExpandProperty ifIndex)
  $routes = @(Get-NetRoute -PolicyStore ActiveStore | Where-Object {
    $_.ifIndex -in $indices -and $_.DestinationPrefix -in @('0.0.0.0/0','::/0') -and $_.State -ne 'Dead'
  })
  if (!@($routes | Where-Object DestinationPrefix -eq '0.0.0.0/0').Count) { throw 'noWifi' }
  $costs = @($routes | ForEach-Object { [long]$_.RouteMetric + [long]$_.InterfaceMetric })
  $cost = [long](($costs | Measure-Object -Maximum).Maximum)
  if ($cost -gt 64000) { throw 'unsupported' }
  return [int][math]::Max(600, $cost + 16)
}
function Get-TargetNic([guid]$id, [string]$family, [string]$store='ActiveStore') {
  $target = Get-Dongle
  if ([guid]$target.InterfaceGuid -ne $id) { throw 'changed' }
  $nic = Get-NetIPInterface -InterfaceIndex $target.ifIndex -AddressFamily $family -PolicyStore $store
  if (@($nic).Count -ne 1) { throw 'unsupported' }
  if ($store -eq 'PersistentStore' -and $null -eq $nic.AutomaticMetric -and $null -eq $nic.InterfaceMetric) {
    # Windows represents an unconfigured persistent metric as two empty fields.
    return [pscustomobject]@{AutomaticMetric='Enabled';InterfaceMetric=0;InterfaceIndex=$target.ifIndex}
  }
  if ([string]$nic.AutomaticMetric -notin @('Disabled','Enabled')) { throw 'unsupported' }
  return $nic
}
function Test-Metric($nic, $auto, $metric) {
  return ([string]$nic.AutomaticMetric -eq $auto -and ($auto -eq 'Enabled' -or [int]$nic.InterfaceMetric -eq $metric))
}
function Set-TargetMetric([guid]$id, $family, $auto, $metric) {
  $nic = Get-TargetNic $id $family
  if ((Test-Metric $nic $auto $metric) -and (Test-Metric (Get-TargetNic $id $family PersistentStore) $auto $metric)) { return }
  $argsMap = @{InterfaceIndex=$nic.InterfaceIndex; AddressFamily=$family; AutomaticMetric=$auto; Confirm=$false}
  if ($auto -eq 'Disabled') { $argsMap.InterfaceMetric = $metric }
  Set-NetIPInterface @argsMap
  foreach ($store in 'ActiveStore','PersistentStore') {
    if (!(Test-Metric (Get-TargetNic $id $family $store) $auto $metric)) { throw 'verify' }
  }
}

# Machine-wide, admin-owned key. Do not accept a backup path or interface index from the UI.
function Get-Backup([guid]$id) {
  $key = "HKLM:\SOFTWARE\DJI4GAssistant\NetworkPreference\$($id.ToString('D'))"
  if (!(Test-Path -LiteralPath $key)) { return $null }
  $json = Get-ItemPropertyValue -LiteralPath $key -Name 'Snapshot' -ErrorAction SilentlyContinue
  if (!$json) { return $null }
  $data = $json | ConvertFrom-Json
  if ($data.version -ne 1 -or $data.guid -ne $id.ToString('D') -or @($data.rows).Count -ne 2) { throw 'unsupported' }
  foreach ($family in @('IPv4','IPv6')) {
    $row = @($data.rows | Where-Object family -eq $family)
    if ($row.Count -ne 1 -or $row[0].auto -notin @('Disabled','Enabled') -or [long]$row[0].metric -lt 0 -or [long]$row[0].metric -gt 65535 -or [long]$row[0].managed -lt 600 -or [long]$row[0].managed -gt 65535) { throw 'unsupported' }
  }
  return $data
}
function Save-Backup([guid]$id, $snapshot) {
  $key = "HKLM:\SOFTWARE\DJI4GAssistant\NetworkPreference\$($id.ToString('D'))"
  if (!(Test-Path -LiteralPath $key)) { $null = New-Item -Path $key -Force }
  $null = New-ItemProperty -LiteralPath $key -Name Snapshot -PropertyType String -Value (ConvertTo-Json $snapshot -Depth 5 -Compress)
}
function Clear-Backup([guid]$id) {
  Remove-ItemProperty -LiteralPath "HKLM:\SOFTWARE\DJI4GAssistant\NetworkPreference\$($id.ToString('D'))" -Name Snapshot
}
function Restore-Snapshot([guid]$id, $rows) {
  foreach ($row in $rows) {
    foreach ($store in 'ActiveStore','PersistentStore') {
      $nic = Get-TargetNic $id $row.family $store
      if (!(Test-Metric $nic $row.auto $row.metric) -and !(Test-Metric $nic 'Disabled' $row.managed)) { throw 'conflict' }
    }
  }
  foreach ($row in $rows) {
    foreach ($store in 'ActiveStore','PersistentStore') {
      $nic = Get-TargetNic $id $row.family $store
      if (!(Test-Metric $nic $row.auto $row.metric) -and !(Test-Metric $nic 'Disabled' $row.managed)) { throw 'conflict' }
    }
    Set-TargetMetric $id $row.family $row.auto $row.metric
  }
  Clear-Backup $id
}
function Invoke-Preference([string]$action, [guid]$id) {
  $dongle = Get-Dongle
  if ([guid]$dongle.InterfaceGuid -ne $id) { throw 'changed' }
  $snapshot = Get-Backup $id
  if ($action -eq 'Restore') {
    if (!$snapshot) { throw 'noBackup' }
    Restore-Snapshot $id $snapshot.rows
    return
  }
  $goal = Get-WifiCost
  if ($snapshot) {
    foreach ($row in $snapshot.rows) {
      foreach ($store in 'ActiveStore','PersistentStore') {
        if ($row.managed -lt $goal -or !(Test-Metric (Get-TargetNic $id $row.family $store) 'Disabled' $row.managed)) { throw 'conflict' }
      }
    }
    return
  }
  $rows = @(foreach ($family in 'IPv4','IPv6') {
    $nic = Get-TargetNic $id $family
    if (!(Test-Metric (Get-TargetNic $id $family PersistentStore) ([string]$nic.AutomaticMetric) $nic.InterfaceMetric)) { throw 'conflict' }
    [pscustomobject]@{family=$family;auto=[string]$nic.AutomaticMetric;metric=[int]$nic.InterfaceMetric;managed=[math]::Max($goal,[int]$nic.InterfaceMetric)}
  })
  Save-Backup $id @{version=1;guid=$id.ToString('D');rows=$rows}
  try {
    foreach ($row in $rows) {
      foreach ($store in 'ActiveStore','PersistentStore') {
        if (!(Test-Metric (Get-TargetNic $id $row.family $store) $row.auto $row.metric)) { throw 'conflict' }
      }
      Set-TargetMetric $id $row.family 'Disabled' $row.managed
    }
  } catch {
    try { Restore-Snapshot $id $rows } catch { throw 'partial' }
    throw 'rolledBack'
  }
}
if ($MyInvocation.InvocationName -eq '.') { return }
try {
  $id = [guid](Get-Dongle).InterfaceGuid
  if ($ExpectedGuid -ne [guid]::Empty -and $ExpectedGuid -ne $id) { throw 'changed' }
  if ($Mode -eq 'Check') { Write-Output $id.ToString('D'); exit 0 }
  if ($Mode -eq 'Prefer') { $null = Get-WifiCost }
  elseif (!(Get-Backup $id)) { throw 'noBackup' }
  $principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Mode {1} -ExpectedGuid {2}' -f $PSCommandPath,$Mode,$id.ToString('D')
    $child = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -Wait -PassThru
    exit $child.ExitCode
  }
  $mutex = New-Object Threading.Mutex($false,'Global\DJI4GAssistant.NetworkPreference')
  try {
    try { $held = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $held = $true }
    if (!$held) { throw 'busy' }
    try { Invoke-Preference $Mode $id } finally { $mutex.ReleaseMutex() }
  } finally { $mutex.Dispose() }
  exit 0
} catch {
  $codes = @{noDongle=10;ambiguous=11;noWifi=12;noBackup=13;changed=14;conflict=16;rolledBack=17;partial=18;busy=19;unsupported=20}
  $cause = $_.Exception
  while ($cause) {
    if ($cause.NativeErrorCode -eq 1223 -or ($cause.HResult -band 65535) -eq 1223) { exit 15 }
    $cause = $cause.InnerException
  }
  if ($codes.ContainsKey($_.Exception.Message)) { exit $codes[$_.Exception.Message] }
  exit 21
}
