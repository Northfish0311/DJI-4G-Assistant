$ErrorActionPreference = "Continue"

$ports = [System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object

$serialDetails = @{}
try {
  Get-CimInstance Win32_SerialPort -ErrorAction Stop | ForEach-Object {
    $serialDetails[$_.DeviceID.ToUpperInvariant()] = $_
  }
}
catch {
  # Port probing still works when Windows blocks the optional metadata query.
}

if (-not $ports) {
  Write-Host "No serial ports found."
  exit 0
}

$attempted = 0

foreach ($portName in $ports) {
  $detail = $serialDetails[$portName.ToUpperInvariant()]
  $identity = if ($detail) {
    "$($detail.Name) $($detail.Description) $($detail.PNPDeviceID)"
  }
  else {
    ""
  }

  if ($identity -match "BTHENUM|Bluetooth") {
    Write-Host "Skipping Bluetooth serial port: $portName"
    continue
  }

  $attempted += 1
  Write-Host "----- $portName -----"

  $sp = New-Object System.IO.Ports.SerialPort $portName,115200,'None',8,'One'
  $sp.ReadTimeout = 900
  $sp.WriteTimeout = 900
  $sp.NewLine = "`r"

  try {
    $sp.Open()
    $sp.DiscardInBuffer()
    $sp.WriteLine("AT")
    Start-Sleep -Milliseconds 450
    $output = $sp.ReadExisting()

    if ($output -match "OK") {
      Write-Host "AT response: OK"
      Write-Host "AT_PORT=$portName"
      exit 0
    }

    if ([string]::IsNullOrWhiteSpace($output)) {
      Write-Host "No AT response"
    }
    else {
      Write-Host ($output -replace "`r","")
    }
  }
  catch {
    Write-Host "Error: $($_.Exception.Message)"
  }
  finally {
    if ($sp.IsOpen) {
      $sp.Close()
    }
  }
}

if ($attempted -eq 0) {
  Write-Host "No eligible serial ports found. Bluetooth serial ports are ignored."
}
else {
  Write-Host "No AT port responded."
}
