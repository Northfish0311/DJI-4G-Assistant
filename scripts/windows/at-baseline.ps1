param(
  [Parameter(Mandatory=$true)]
  [string]$PortName,

  [int]$BaudRate = 115200
)

$ErrorActionPreference = "Stop"

$commands = @(
  'ATI',
  'AT+GMR',
  'AT+CGMM',
  'AT+QCFG="usbnet"',
  'AT+QCFG="usbcfg"',
  'AT+CPIN?',
  'AT+CIMI',
  'AT+COPS?',
  'AT+CEREG?',
  'AT+CGREG?',
  'AT+CSQ',
  'AT+QNWINFO',
  'AT+QENG="servingcell"',
  'AT+CGDCONT?',
  'AT+CGACT?',
  'AT+CGPADDR=1',
  'AT+QNETDEVSTATUS?'
)

$sp = New-Object System.IO.Ports.SerialPort $PortName,$BaudRate,'None',8,'One'
$sp.ReadTimeout = 1600
$sp.WriteTimeout = 1600
$sp.NewLine = "`r"

try {
  $sp.Open()
  foreach ($cmd in $commands) {
    $sp.DiscardInBuffer()
    $sp.WriteLine($cmd)
    Start-Sleep -Milliseconds 450

    $output = ""
    $deadline = (Get-Date).AddSeconds(3)
    while ((Get-Date) -lt $deadline) {
      $output += $sp.ReadExisting()
      if ($output -match "(`r|`n)(OK|ERROR)(`r|`n)") {
        break
      }
      Start-Sleep -Milliseconds 120
    }

    Write-Host "----- $cmd -----"
    Write-Host ($output -replace "`r","")
  }
}
finally {
  if ($sp.IsOpen) {
    $sp.Close()
  }
}
