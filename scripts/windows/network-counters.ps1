$ErrorActionPreference = 'Stop'

try {
  $adapters = @([System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() | Where-Object {
    $_.Description -match 'Quectel|Mobile Broadband|WWAN|Cellular|Remote NDIS|USB Ethernet'
  })
  $performance = @(Get-CimInstance Win32_PerfRawData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue)
  $performanceSampledAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $items = @()
  foreach ($adapter in $adapters) {
    $properties = $adapter.GetIPProperties()
    $addresses = @($properties.UnicastAddresses | Where-Object {
      $_.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
      $_.Address.ToString() -notlike '169.254.*'
    } | ForEach-Object { $_.Address.ToString() })
    if ($addresses.Count -eq 0) { $addresses = @('') }
    $stats = $adapter.GetIPv4Statistics()
    $statsSampledAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $matching = @($performance | Where-Object { $_.Name -ceq $adapter.Description })
    $sameDescription = @($adapters | Where-Object { $_.Description -ceq $adapter.Description })
    $counters = $null
    if ($matching.Count -eq 1 -and $sameDescription.Count -eq 1) {
      $counters = [pscustomobject]@{
        name = [string]$matching[0].Name
        unique = $true
        receivedBytes = $matching[0].BytesReceivedPersec
        sentBytes = $matching[0].BytesSentPersec
      }
    }
    $items += [pscustomobject]@{
      interfaceId = [string]$adapter.Id
      description = [string]$adapter.Description
      status = [string]$adapter.OperationalStatus
      ipv4Addresses = $addresses
      receivedBytes = [long]$stats.BytesReceived
      sentBytes = [long]$stats.BytesSent
      statisticsReliable = $true
      performanceCounters = $counters
      sampledAt = if ($counters) { $performanceSampledAt } else { $statsSampledAt }
    }
  }
  ConvertTo-Json -InputObject @($items) -Depth 5 -Compress
} catch {
  Write-Error 'Windows network counters could not be read.'
  exit 1
}
