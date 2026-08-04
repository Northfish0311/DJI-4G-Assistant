$ErrorActionPreference = "Continue"

$ports = [System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object

if (-not $ports) {
  Write-Host "No serial ports found."
  exit 0
}

foreach ($portName in $ports) {
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

Write-Host "No AT port responded."
