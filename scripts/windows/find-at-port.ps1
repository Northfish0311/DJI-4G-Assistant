$ErrorActionPreference = "Continue"

function Get-SerialInventory {
  $details = @{}
  try {
    Get-CimInstance Win32_SerialPort -ErrorAction Stop | ForEach-Object {
      $details[$_.DeviceID.ToUpperInvariant()] = $_
    }
  }
  catch {
    # Port probing still works when Windows blocks the optional metadata query.
  }

  $items = foreach ($portName in ([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object)) {
    $detail = $details[$portName.ToUpperInvariant()]
    $identity = if ($detail) {
      "$($detail.Name) $($detail.Description) $($detail.PNPDeviceID)"
    }
    else {
      ""
    }

    [PSCustomObject]@{
      PortName = $portName
      Identity = $identity
      Preferred = [bool]($identity -match "Quectel|QDC507|Baiwang|USB.*(AT|Modem)|AT Port|Diagnostics")
      Bluetooth = [bool]($identity -match "BTHENUM|Bluetooth")
    }
  }

  return @($items | Sort-Object @{ Expression = "Preferred"; Descending = $true }, @{ Expression = "PortName"; Descending = $false })
}

function Test-AtPort {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PortName
  )

  $sp = New-Object System.IO.Ports.SerialPort $PortName,115200,'None',8,'One'
  $sp.ReadTimeout = 1100
  $sp.WriteTimeout = 1100
  $sp.NewLine = "`r"

  try {
    $sp.Open()
    $sp.DiscardInBuffer()

    foreach ($command in @("AT", "ATI")) {
      $sp.WriteLine($command)
      Start-Sleep -Milliseconds 550
      $output = $sp.ReadExisting()

      if ($output -match "OK") {
        Write-Host "AT response: OK"
        return $true
      }

      if (-not [string]::IsNullOrWhiteSpace($output)) {
        Write-Host ($output -replace "`r", "")
      }
    }

    Write-Host "No AT response"
  }
  catch {
    Write-Host "Error: $($_.Exception.Message)"
  }
  finally {
    if ($sp.IsOpen) {
      $sp.Close()
    }
  }

  return $false
}

$attempted = 0
$seen = @{}

for ($pass = 1; $pass -le 2; $pass += 1) {
  $ports = @(Get-SerialInventory)

  if ($ports.Count -eq 0) {
    Write-Host "No serial ports found on scan $pass."
  }

  foreach ($port in $ports) {
    if ($port.Bluetooth) {
      if (-not $seen.ContainsKey($port.PortName)) {
        Write-Host "Skipping Bluetooth serial port: $($port.PortName)"
        $seen[$port.PortName] = $true
      }
      continue
    }

    $seen[$port.PortName] = $true
    $attempted += 1
    Write-Host "----- $($port.PortName) -----"

    if (Test-AtPort -PortName $port.PortName) {
      Write-Host "AT_PORT=$($port.PortName)"
      exit 0
    }
  }

  if ($pass -eq 1) {
    Write-Host "Waiting briefly for newly attached USB serial interfaces..."
    Start-Sleep -Milliseconds 1500
  }
}

if ($attempted -eq 0) {
  Write-Host "No eligible serial ports found. Bluetooth serial ports are ignored."
}
else {
  Write-Host "No AT port responded. Close other modem tools and run Auto Scan again."
}
