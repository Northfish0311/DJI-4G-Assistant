$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../../scripts/windows/send-sms.ps1')

class FakeSmsPort {
  [string[]]$Chunks
  [int]$Reads
  [bool]$IsOpen
  [Collections.Generic.List[string]]$Writes = [Collections.Generic.List[string]]::new()
  [void] Open() { $this.IsOpen = $true }
  [void] Close() { $this.IsOpen = $false }
  [void] DiscardInBuffer() {}
  [void] WriteLine([string]$command) { $this.Writes.Add($command) }
  [void] Write([string]$data) {
    if ($data -eq [string][char]26) { $this.Writes.Add('submit') }
    elseif ($data -eq [string][char]27) { $this.Writes.Add('escape') }
    else { $this.Writes.Add('pdu') }
  }
  [string] ReadExisting() {
    $idx = $this.Reads++
    if ($idx -ge $this.Chunks.Length) { return '' }
    if ($this.Chunks[$idx] -eq '!disconnect!') { throw [IO.IOException]::new('Disconnected') }
    return $this.Chunks[$idx]
  }
}

$cases = [Console]::In.ReadToEnd() | ConvertFrom-Json
$outcomes = foreach ($case in $cases) {
  $port = [FakeSmsPort]::new()
  $port.Chunks = $case.chunks
  $pdus = @(1..$case.parts | ForEach-Object { [pscustomobject]@{length = 1; pdu = '0000'} })
  $result = Invoke-SmsSubmit $port $pdus 750 250 250
  [pscustomobject]@{result=$result; writes=$port.Writes; reads=$port.Reads; closed=!$port.IsOpen}
}
ConvertTo-Json -InputObject @($outcomes) -Compress -Depth 5
