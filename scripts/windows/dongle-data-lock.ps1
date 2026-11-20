[CmdletBinding()]
param([ValidateSet('Check','Block','Unblock')][string]$Mode='Check', [string]$ExpectedId='')
$ErrorActionPreference='Stop'

# Every PnP cmdlet on some machines takes ~11 s because it walks the whole device tree:
# Get-PnpDevice, Get-PnpDeviceProperty, Disable-PnpDevice and Enable-PnpDevice all measured
# above 11 s here, while the same work through cfgmgr32 answers in milliseconds.

if (-not ('DjiDongleLock' -as [type])) {
  Add-Type -Namespace '' -Name 'DjiDongleLock' -MemberDefinition @'
[DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)]
public static extern int CM_Locate_DevNodeW(out uint pdnDevInst, string pDeviceID, uint ulFlags);
[DllImport("cfgmgr32.dll")]
public static extern int CM_Get_DevNode_Status(out uint pulStatus, out uint pulProblemNumber, uint dnDevInst, uint ulFlags);
[DllImport("cfgmgr32.dll")]
public static extern int CM_Disable_DevNode(uint dnDevInst, uint ulFlags);
[DllImport("cfgmgr32.dll")]
public static extern int CM_Enable_DevNode(uint dnDevInst, uint ulFlags);
'@
}

$script:EcmKey = 'HKLM:\SYSTEM\CurrentControlSet\Enum\USB\VID_2C7C&PID_0125&MI_04'

function Get-DevNode([string]$id) {
  $inst = 0
  $rc = [DjiDongleLock]::CM_Locate_DevNodeW([ref]$inst, $id, 0)
  if ($rc -ne 0) { return $null }
  return [uint32]$inst
}

function Get-EcmDevice {
  # The registry keeps instances of unplugged modules, so presence is decided by cfgmgr32,
  # not by the key's existence.
  $devices = @()
  foreach ($entry in (Get-ChildItem $script:EcmKey -ErrorAction SilentlyContinue)) {
    $props = Get-ItemProperty $entry.PSPath -ErrorAction SilentlyContinue
    $desc = [string]$props.DeviceDesc
    if ($desc -match ';(.+)$') { $desc = $Matches[1].Trim() }
    if ($desc -notmatch '^Quectel ECM Adapter(?: #\d+)?$') { continue }
    $id = 'USB\VID_2C7C&PID_0125&MI_04\' + $entry.PSChildName
    $node = Get-DevNode $id
    if ($null -eq $node) { continue }
    $devices += [pscustomobject]@{ InstanceId = $id; Node = $node }
  }
  if (!$devices.Count) { throw 'noDongle' }
  if ($devices.Count -ne 1) { throw 'ambiguous' }
  $devices[0]
}

function Get-ProblemCode($device) {
  $id = if ($device -is [string]) { $device } else { [string]$device.InstanceId }
  $node = Get-DevNode $id
  if ($null -eq $node) { throw 'noDongle' }
  $status = 0
  $problem = 0
  if ([DjiDongleLock]::CM_Get_DevNode_Status([ref]$status, [ref]$problem, $node, 0) -ne 0) { throw 'unsupported' }
  [int]$problem
}

function Test-WifiRoute {
  $ids = @(Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' -and [int]$_.NdisPhysicalMedium -in @(1,9) } | Select-Object -ExpandProperty ifIndex)
  $routes = @(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -PolicyStore ActiveStore | Where-Object { $_.ifIndex -in $ids -and $_.State -ne 'Dead' })
  return $routes.Count -gt 0
}

function Set-DevNode($device, [bool]$disable) {
  $id = if ($device -is [string]) { $device } else { [string]$device.InstanceId }
  $node = Get-DevNode $id
  if ($null -eq $node) { throw 'changed' }
  $rc = if ($disable) { [DjiDongleLock]::CM_Disable_DevNode($node, 0) } else { [DjiDongleLock]::CM_Enable_DevNode($node, 0) }
  # 1223 is the cancelled UAC prompt surfaced as a native error.
  if ($rc -eq 1223) { throw 'cancelled' }
  if ($rc -ne 0) { throw 'unsupported' }
}

function Invoke-DataLock($action, $id) {
  if ((Get-EcmDevice).InstanceId -ne $id) { throw 'changed' }
  $code = Get-ProblemCode $id
  if ($code -notin @(0,22)) { throw 'unsupported' }
  if ($action -eq 'Block') {
    if ($code -eq 22) { return }
    if (!(Test-WifiRoute)) { throw 'noWifi' }
    Set-DevNode $id $true
    $expected = 22
  } elseif ($action -eq 'Unblock') {
    if ($code -eq 0) { return }
    Set-DevNode $id $false
    $expected = 0
  } else { throw 'unsupported' }
  for ($i = 0; $i -lt 12; $i++) {
    if ((Get-ProblemCode $id) -eq $expected) { return }
    Start-Sleep -Milliseconds 250
  }
  throw 'verify'
}

if ($MyInvocation.InvocationName -eq '.') { return }
try {
  $id = (Get-EcmDevice).InstanceId
  if ($ExpectedId -and $ExpectedId -ne $id) { throw 'changed' }
  if ($Mode -eq 'Check') { Write-Output $id; exit 0 }
  $principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $argsLine = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Mode {1} -ExpectedId "{2}"' -f $PSCommandPath,$Mode,$id
    $child = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $argsLine -Verb RunAs -WindowStyle Hidden -Wait -PassThru
    exit $child.ExitCode
  }
  Invoke-DataLock $Mode $id
  exit 0
} catch {
  $codes = @{noDongle=10;ambiguous=11;noWifi=12;changed=14;cancelled=15;unsupported=20;verify=21}
  if ($codes.ContainsKey($_.Exception.Message)) { exit $codes[$_.Exception.Message] }
  if ($_.Exception.NativeErrorCode -eq 1223) { exit 15 }
  exit 21
}
