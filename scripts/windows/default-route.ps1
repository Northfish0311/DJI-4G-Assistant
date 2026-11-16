$ErrorActionPreference = 'Stop'
$interfaces = @{}
foreach ($device in Get-NetIPInterface -AddressFamily IPv4 -PolicyStore ActiveStore) {
  if ($device.ConnectionState -eq 'Connected') { $interfaces[[int]$device.InterfaceIndex] = $device }
}
$routes = @(Get-NetRoute -AddressFamily IPv4 -PolicyStore ActiveStore | Where-Object {
  $_.DestinationPrefix -eq '0.0.0.0/0' -and $_.State -ne 'Dead' -and $interfaces.ContainsKey([int]$_.InterfaceIndex)
} | ForEach-Object {
  $nic = $interfaces[[int]$_.InterfaceIndex]
  [pscustomobject]@{ name = [string]$nic.InterfaceAlias; index = [int]$nic.InterfaceIndex; cost = [long]$nic.InterfaceMetric + [long]$_.RouteMetric }
})
ConvertTo-Json -InputObject $routes -Compress
