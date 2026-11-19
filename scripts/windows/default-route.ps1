$ErrorActionPreference = 'Stop'
$interfaces = @{}
foreach ($device in Get-NetIPInterface -AddressFamily IPv4 -PolicyStore ActiveStore) {
  if ($device.ConnectionState -eq 'Connected') { $interfaces[[int]$device.InterfaceIndex] = $device }
}
$adapters = @{}
try {
  foreach ($adapter in Get-NetAdapter -ErrorAction SilentlyContinue) {
    $adapters[[int]$adapter.ifIndex] = $adapter
  }
}
catch {
  # Adapter descriptions are a convenience; the route decision still works without them.
}
$routes = @(Get-NetRoute -AddressFamily IPv4 -PolicyStore ActiveStore | Where-Object {
  $_.DestinationPrefix -eq '0.0.0.0/0' -and $_.State -ne 'Dead' -and $interfaces.ContainsKey([int]$_.InterfaceIndex)
} | ForEach-Object {
  $nic = $interfaces[[int]$_.InterfaceIndex]
  $adapter = $adapters[[int]$nic.InterfaceIndex]
  [pscustomobject]@{
    name = [string]$nic.InterfaceAlias
    index = [int]$nic.InterfaceIndex
    cost = [long]$nic.InterfaceMetric + [long]$_.RouteMetric
    # Callers classify the egress (module, Wi-Fi, VPN/TUN) from these two fields.
    description = if ($adapter) { [string]$adapter.InterfaceDescription } else { '' }
    hardware = if ($adapter) { [bool]$adapter.HardwareInterface } else { $true }
  }
})
ConvertTo-Json -InputObject $routes -Compress
