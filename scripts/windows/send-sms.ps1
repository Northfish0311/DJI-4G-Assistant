param([string]$PortName, [string]$Payload)

function Read-SmsReply($Port, [string]$Phase, [int]$TimeoutMs) {
  $timer = [Diagnostics.Stopwatch]::StartNew()
  $pending = ''
  $reference = $false
  do {
    $chunk = $Port.ReadExisting()
    $pending += $chunk
    $lines = [regex]::Split($pending, '[\r\n]+')
    $pending = $lines[-1]
    for ($i = 0; $i -lt $lines.Length - 1; $i++) {
      $line = $lines[$i].Trim()
      if ($line -match '^(ERROR|\+CM[ES] ERROR\s*:[^\r\n]*)$') {
        return @{ kind = 'rejected'; reason = $line.Substring(0, [Math]::Min(120, $line.Length)) }
      }
      if ($Phase -eq 'prompt' -and $line -eq '>') { return @{ kind = 'ready' } }
      if ($Phase -eq 'submit' -and $line -match '^\+CMGS:\s*[0-9]+(?:\s*,\s*[0-9a-fA-F]+)?$') { $reference = $true }
      if ($line -eq 'OK') {
        if ($Phase -eq 'mode' -or ($Phase -eq 'submit' -and $reference)) { return @{ kind = 'ready' } }
        return @{ kind = 'incomplete' }
      }
    }
    # The SMS entry prompt normally has no trailing newline.
    if ($Phase -eq 'prompt' -and $pending -match '^>[ \t]*$') { return @{ kind = 'ready' } }
    if ($pending.Length -gt 4096) { return @{ kind = 'incomplete' } }
    if (!$chunk) { Start-Sleep -Milliseconds 35 }
  } while ($timer.ElapsedMilliseconds -lt $TimeoutMs)
  return @{ kind = 'incomplete' }
}

function Invoke-SmsSubmit($Port, [object[]]$Pdus, [int]$ModeMs = 8000, [int]$PromptMs = 10000, [int]$SubmitMs = 60000) {
  $result = @{ status = 'not-submitted'; submittedSegments = 0; totalSegments = $Pdus.Count; modemError = $null }
  $cancelEntry = $false
  try {
    $Port.Open()
    $Port.DiscardInBuffer()
    $Port.WriteLine('AT+CMGF=0')
    $reply = Read-SmsReply $Port mode $ModeMs
    if ($reply.kind -ne 'ready') {
      if ($reply.kind -eq 'rejected') { $result.status = 'rejected'; $result.modemError = $reply.reason }
      return $result
    }
    foreach ($item in $Pdus) {
      $cancelEntry = $true
      $Port.WriteLine(('AT+CMGS={0}' -f $item.length))
      $reply = Read-SmsReply $Port prompt $PromptMs
      if ($reply.kind -ne 'ready') {
        if ($reply.kind -eq 'rejected') { $cancelEntry = $false; $result.status = 'rejected'; $result.modemError = $reply.reason }
        return $result
      }
      $Port.Write([string]$item.pdu)
      # Once Ctrl-Z is attempted the modem may have accepted this segment, even if USB disconnects.
      $cancelEntry = $false
      $result.status = 'unconfirmed'
      $Port.Write([string][char]26)
      $reply = Read-SmsReply $Port submit $SubmitMs
      if ($reply.kind -ne 'ready') {
        if ($reply.kind -eq 'rejected') { $result.status = 'rejected'; $result.modemError = $reply.reason }
        return $result
      }
      $result.submittedSegments++
      $result.status = 'not-submitted'
    }
    $result.status = 'submitted'
  } catch {
    # The stage above distinguishes a failed setup from an unknown submission.
    return $result
  } finally {
    if ($Port.IsOpen) {
      try { if ($cancelEntry) { $Port.Write([string][char]27) } }
      catch { $result.cleanupFailed = $true }
      try { $Port.Close() }
      catch { $result.cleanupFailed = $true }
    }
  }
  return $result
}

if ($MyInvocation.InvocationName -ne '.') {
  $ErrorActionPreference = 'Stop'
  $request = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload)) | ConvertFrom-Json
  $port = [IO.Ports.SerialPort]::new($PortName, 115200, 'None', 8, 'One')
  $port.NewLine = [string][char]13
  $port.WriteTimeout = 1800
  Invoke-SmsSubmit $port @($request.pdus) | ConvertTo-Json -Compress
}
