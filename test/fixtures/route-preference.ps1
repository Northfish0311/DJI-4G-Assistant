$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\..\scripts\windows\wifi-preference.ps1')
$id = [guid]'11223344-1234-1234-1234-112233445566'
$usb = [pscustomobject]@{PnPDeviceID='USB\VID_2C7C&PID_0125&MI_04\test';InterfaceDescription='Quectel ECM Adapter';InterfaceGuid=$id;ifIndex=44;NdisPhysicalMedium=14;Status='Up'}
$wifi = [pscustomobject]@{PnPDeviceID='PCI\test';InterfaceDescription='Wireless';ifIndex=23;NdisPhysicalMedium=9;Status='Up'}
function Reset-Lab {
  $script:nics=@($usb,$wifi); $script:backup=$null; $script:fail=$false; $script:writes=0; $script:persistentOverride=$null
  $script:families=@{IPv4=[pscustomobject]@{AutomaticMetric='Enabled';InterfaceMetric=5;InterfaceIndex=44};IPv6=[pscustomobject]@{AutomaticMetric='Disabled';InterfaceMetric=41;InterfaceIndex=44}}
}
function Get-NetAdapter { param([switch]$Physical) $script:nics }
function Get-NetRoute {param($PolicyStore) [pscustomobject]@{ifIndex=23;RouteMetric=0;InterfaceMetric=35;DestinationPrefix='0.0.0.0/0';State='Alive'}}
function Get-NetIPInterface {param($InterfaceIndex,$AddressFamily,$PolicyStore) if($InterfaceIndex -ne 44){throw 'unexpected index'}; if($PolicyStore -eq 'PersistentStore' -and $AddressFamily -eq 'IPv4' -and $script:persistentOverride){return $script:persistentOverride}; $script:families[$AddressFamily]}
function Set-NetIPInterface {
  param($InterfaceIndex,$AddressFamily,$AutomaticMetric,$InterfaceMetric,[switch]$Confirm)
  if ($InterfaceIndex -ne 44 -or !$script:backup) {throw 'unsafe write'}
  if($AddressFamily -eq 'IPv6' -and $script:fail){throw 'injected failure'}
  $script:writes++;$script:families[$AddressFamily].AutomaticMetric=$AutomaticMetric
  $script:families[$AddressFamily].InterfaceMetric=if ($AutomaticMetric -eq 'Enabled'){5}else{$InterfaceMetric}
}
function Get-Backup([guid]$id){return $script:backup}
function Save-Backup([guid]$id,$snapshot){if($script:backup){throw 'backup replaced'};$script:backup=$snapshot}
function Clear-Backup([guid]$id){$script:backup=$null}
function Expect-Error($name,[scriptblock]$action){
  $caught='';try{& $action}catch{$caught=$_.Exception.Message};if($caught -ne $name){throw "Expected $name but got '$caught'"}
}
Reset-Lab
Invoke-Preference Prefer $id
if ($writes -ne 2 -or $families.IPv4.InterfaceMetric -ne 600 -or $families.IPv6.InterfaceMetric -ne 600) {throw 'apply'}
Invoke-Preference Prefer $id
if($writes -ne 2){throw 'repeat'}
$script:nics=@($usb)
Invoke-Preference Restore $id
if ($backup -or $families.IPv4.AutomaticMetric -ne 'Enabled' -or $families.IPv6.InterfaceMetric -ne 41){throw 'restore'}
Reset-Lab
$script:fail=$true
Expect-Error 'rolledBack' {Invoke-Preference Prefer $id}
if ($backup -or $families.IPv4.AutomaticMetric -ne 'Enabled'){throw 'partial change'}
Reset-Lab
Invoke-Preference Prefer $id
$families.IPv6.InterfaceMetric=45
Expect-Error 'conflict' {Invoke-Preference Restore $id}
if (!$backup -or $families.IPv6.InterfaceMetric -ne 45 -or $writes -ne 2){throw 'manual change lost'}
Reset-Lab
Expect-Error 'noBackup' {Invoke-Preference Restore $id}
Expect-Error 'changed' {Invoke-Preference Prefer ([guid]::NewGuid())}
$script:nics=@($wifi)
Expect-Error 'noDongle' {Invoke-Preference Prefer $id}
$script:nics=@($usb,$usb,$wifi)
Expect-Error 'ambiguous' {Invoke-Preference Prefer $id}
$script:nics=@($usb)
Expect-Error 'noWifi' {Invoke-Preference Prefer $id}
if ($writes -or $backup){throw 'unexpected changes'}
Reset-Lab
$script:persistentOverride=[pscustomobject]@{AutomaticMetric='Disabled';InterfaceMetric=1234;InterfaceIndex=44}
Expect-Error 'conflict' {Invoke-Preference Prefer $id}
if ($writes -or $backup){throw 'persisted manual setting overwrote'}
Write-Output 'route-policy fixtures passed'
