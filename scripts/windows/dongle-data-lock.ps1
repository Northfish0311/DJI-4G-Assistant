[CmdletBinding()]
param([ValidateSet('Check','Block','Unblock')][string]$Mode='Check', [string]$ExpectedId='')
$ErrorActionPreference='Stop'

function Get-EcmDevice {
  $devices=@(Get-PnpDevice -PresentOnly -Class Net | Where-Object {
    $_.InstanceId -match '^USB\\VID_2C7C&PID_0125&MI_04\\[A-Z0-9&._-]+$' -and
    $_.FriendlyName -match '^Quectel ECM Adapter(?: #\d+)?$'
  })
  if (!$devices.Count) { throw 'noDongle' }
  if ($devices.Count -ne 1) { throw 'ambiguous' }
  $devices[0]
}
function Get-ProblemCode($id) {
  $code=(Get-PnpDeviceProperty -InstanceId $id -KeyName 'DEVPKEY_Device_ProblemCode').Data
  if ($null -eq $code) { throw 'unsupported' }
  [int]$code
}
function Test-WifiRoute {
  $ids=@(Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' -and [int]$_.NdisPhysicalMedium -in @(1,9) } | Select-Object -ExpandProperty ifIndex)
  $routes=@(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -PolicyStore ActiveStore | Where-Object { $_.ifIndex -in $ids -and $_.State -ne 'Dead' })
  return $routes.Count -gt 0
}
function Invoke-DataLock($action,$id) {
  if ((Get-EcmDevice).InstanceId -ne $id) { throw 'changed' }
  $code=Get-ProblemCode $id
  if ($code -notin @(0,22)) { throw 'unsupported' }
  if ($action -eq 'Block') {
    if ($code -eq 22) { return }
    if (!(Test-WifiRoute)) { throw 'noWifi' }
    Disable-PnpDevice -InstanceId $id -Confirm:$false
    $expected=22
  } elseif ($action -eq 'Unblock') {
    if ($code -eq 0) { return }
    Enable-PnpDevice -InstanceId $id -Confirm:$false
    $expected=0
  } else { throw 'unsupported' }
  for ($i=0;$i -lt 12;$i++) {
    if ((Get-ProblemCode $id) -eq $expected) { return }
    Start-Sleep -Milliseconds 250
  }
  throw 'verify'
}
if ($MyInvocation.InvocationName -eq '.') { return }
try {
  $id=(Get-EcmDevice).InstanceId
  if ($ExpectedId -and $ExpectedId -ne $id) { throw 'changed' }
  if ($Mode -eq 'Check') { Write-Output $id; exit 0 }
  $principal=[Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $argsLine='-NoProfile -ExecutionPolicy Bypass -File "{0}" -Mode {1} -ExpectedId "{2}"' -f $PSCommandPath,$Mode,$id
    $child=Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $argsLine -Verb RunAs -WindowStyle Hidden -Wait -PassThru
    exit $child.ExitCode
  }
  Invoke-DataLock $Mode $id
  exit 0
} catch {
  $codes=@{noDongle=10;ambiguous=11;noWifi=12;changed=14;unsupported=20;verify=21}
  if ($codes.ContainsKey($_.Exception.Message)) { exit $codes[$_.Exception.Message] }
  if ($_.Exception.NativeErrorCode -eq 1223) { exit 15 }
  exit 21
}
