param([Parameter(Mandatory)][string]$Executable)
$ErrorActionPreference = 'Stop'
$exe = (Resolve-Path -LiteralPath $Executable).Path
$node = Join-Path (Split-Path -Parent $exe) 'payload/node.exe'
function Find-LabNode {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.ExecutablePath -eq $node.Replace('/','\') }
}
$first = $null
$second = $null
try {
  $first = Start-Process -FilePath $exe -WindowStyle Hidden -PassThru
  $until = [DateTime]::UtcNow.AddSeconds(50)
  do {
    if ($first.HasExited) { throw "First instance exited before readiness" }
    $workers = @(Find-LabNode)
    if ($workers.Count -eq 1 -and $workers[0].ParentProcessId -eq $first.Id) {
      $listener = @(Get-NetTCPConnection -OwningProcess $workers[0].ProcessId -State Listen -ErrorAction SilentlyContinue)
      if ($listener.Count -eq 1 -and $listener[0].LocalAddress -eq '127.0.0.1') { break }
    }
    Start-Sleep -Milliseconds 250
  } while ([DateTime]::UtcNow -lt $until)
  if (!$listener -or $listener.Count -ne 1 -or $listener[0].LocalAddress -ne '127.0.0.1') { throw "First loopback listener not ready" }
  $workerId = $workers[0].ProcessId
  $port = $listener[0].LocalPort
  $second = Start-Process -FilePath $exe -ArgumentList '--lan' -WindowStyle Hidden -PassThru
  if (!$second.WaitForExit(20000) -or $second.ExitCode -ne 0) { throw "Second launch did not exit cleanly" }
  $workers = @(Find-LabNode)
  $listeners = @(Get-NetTCPConnection -OwningProcess $workerId -State Listen)
  if ($first.HasExited -or $workers.Count -ne 1 -or $workers[0].ProcessId -ne $workerId -or $listeners.Count -ne 1 -or $listeners[0].LocalPort -ne $port -or $listeners[0].LocalAddress -ne '127.0.0.1') {
    throw "Original instance, backend or loopback listener changed"
  }
  Write-Output 'PASS: duplicate launch exited; original backend PID, port and loopback mode unchanged.'
} finally {
  foreach ($proc in @($second,$first)) {
    if ($proc -and !$proc.HasExited) { $proc.Kill(); $proc.WaitForExit() }
  }
}
