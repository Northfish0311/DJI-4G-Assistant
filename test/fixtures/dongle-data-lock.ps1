$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '..\..\scripts\windows\dongle-data-lock.ps1')
$id='USB\VID_2C7C&PID_0125&MI_04\EXAMPLE'
$script:code=0
$script:wifi=$true
$script:ops=@()
function Get-ProblemCode($device) { $script:code }
function Test-WifiRoute { $script:wifi }
function Set-DevNode($device, [bool]$disable) {
  if ($device -ne $id) { throw 'unexpected adapter' }
  if ($disable) { $script:ops+='disable'; $script:code=22 } else { $script:ops+='enable'; $script:code=0 }
}
function Expect-Error($reason,[scriptblock]$call) {
  try { & $call } catch { if ($_.Exception.Message -eq $reason) { return }; throw }
  throw "missing error: $reason"
}
$script:actual=$id
function Get-EcmDevice { [pscustomobject]@{InstanceId=$script:actual} }
Expect-Error changed { Invoke-DataLock Block 'different' }
$script:wifi=$false
Expect-Error noWifi { Invoke-DataLock Block $id }
$script:wifi=$true
Invoke-DataLock Block $id
Invoke-DataLock Block $id
$script:wifi=$false
Invoke-DataLock Unblock $id
Invoke-DataLock Unblock $id
$script:code=28
Expect-Error unsupported { Invoke-DataLock Block $id }
if (($script:ops -join ',') -ne 'disable,enable') { throw 'unexpected changes' }
Write-Output 'PASS: exact target, Wi-Fi guard, block, restore, idempotence, unhealthy target'
