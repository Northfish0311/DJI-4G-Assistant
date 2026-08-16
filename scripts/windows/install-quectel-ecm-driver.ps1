[CmdletBinding()]
param(
  [switch]$Elevated,
  [string]$ResultPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$officialUrl = "https://www.quectel.com/content/uploads/2024/05/Quectel_Windows_USB_DriverQ_ECM_V1.0_EN.zip"
$expectedZipSha256 = "7F80F1BFDD0EB4C0C5A53212D758659E373525A5BDB98185F66D56084B058DC8"
$targetNetworkId = "USB\VID_2C7C&PID_0125&MI_04*"
$minimumDriverVersion = [version]"19.0.33.201"
$programRoot = Join-Path $env:ProgramData "DJIRoamDock\ECMDriver"
$setupProcessIds = @()

function Test-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-EcmStatus {
  $target = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
    Where-Object { $_.InstanceId -like $targetNetworkId } |
    Select-Object -First 1

  $driver = Get-CimInstance Win32_PnPSignedDriver -ErrorAction SilentlyContinue |
    Where-Object { $_.DeviceID -like $targetNetworkId } |
    Sort-Object DriverDate -Descending |
    Select-Object -First 1

  $adapter = Get-NetAdapter -IncludeHidden -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceDescription -match "Quectel.*(ECM|Ethernet)" } |
    Sort-Object @{ Expression = { if ($_.Status -eq "Up") { 0 } else { 1 } } }, ifIndex |
    Select-Object -First 1

  $ip = $null
  $dhcp = $null
  if ($adapter) {
    $ip = Get-NetIPConfiguration -InterfaceIndex $adapter.ifIndex -ErrorAction SilentlyContinue
    $dhcp = Get-NetIPInterface -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
  }

  $version = $null
  if ($driver -and $driver.DriverVersion) {
    try { $version = [version]$driver.DriverVersion } catch { $version = $null }
  }

  [ordered]@{
    targetPresent = [bool]$target
    ready = [bool]($target -and $driver -and $driver.DeviceName -eq "Quectel ECM Adapter" -and $version -and $version -ge $minimumDriverVersion)
    deviceName = if ($driver) { [string]$driver.DeviceName } else { "" }
    driverVersion = if ($driver) { [string]$driver.DriverVersion } else { "" }
    infName = if ($driver) { [string]$driver.InfName } else { "" }
    signed = if ($driver) { [bool]$driver.IsSigned } else { $false }
    adapterName = if ($adapter) { [string]$adapter.Name } else { "" }
    adapterStatus = if ($adapter) { [string]$adapter.Status } else { "" }
    ipv4 = if ($ip) { [string]$ip.IPv4Address.IPAddress } else { "" }
    gateway = if ($ip) { [string]$ip.IPv4DefaultGateway.NextHop } else { "" }
    dhcp = if ($dhcp) { [string]$dhcp.Dhcp } else { "" }
  }
}

function Publish-Result {
  param([hashtable]$Value)

  $Value.timestamp = (Get-Date).ToString("o")
  $json = $Value | ConvertTo-Json -Depth 6
  if ($ResultPath) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ResultPath) | Out-Null
    $json | Set-Content -LiteralPath $ResultPath -Encoding UTF8
  }
  Write-Output $json
}

function Invoke-ProcessWithEnvironment {
  param(
    [string]$FilePath,
    [string]$Arguments,
    [hashtable]$Environment = @{},
    [int]$TimeoutSeconds = 180
  )

  $startInfo = New-Object Diagnostics.ProcessStartInfo
  $startInfo.FileName = $FilePath
  $startInfo.Arguments = $Arguments
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  foreach ($entry in $Environment.GetEnumerator()) {
    $startInfo.EnvironmentVariables[$entry.Key] = [string]$entry.Value
  }

  $process = New-Object Diagnostics.Process
  $process.StartInfo = $startInfo
  if (-not $process.Start()) { throw "Could not start $FilePath" }
  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    try { $process.Kill() } catch {}
    throw "$FilePath timed out after $TimeoutSeconds seconds."
  }
  return $process.ExitCode
}

function Get-NewSetupProcesses {
  Get-Process setup -ErrorAction SilentlyContinue |
    Where-Object { $setupProcessIds -notcontains $_.Id }
}

function Stop-NewSetupProcesses {
  foreach ($process in @(Get-NewSetupProcesses)) {
    try { Stop-Process -Id $process.Id -Force -ErrorAction Stop } catch {}
  }
}

$initial = Get-EcmStatus
if (-not $initial.targetPresent) {
  Publish-Result ([ordered]@{
    ok = $false
    changed = $false
    error = "No USB\\VID_2C7C&PID_0125&MI_04 network interface was found. No driver change was made."
    status = $initial
  })
  exit 2
}

if ($initial.ready) {
  Publish-Result ([ordered]@{
    ok = $true
    changed = $false
    message = "The verified Quectel ECM driver is already installed."
    status = $initial
  })
  exit 0
}

if (-not $Elevated) {
  if (-not $ResultPath) {
    $ResultPath = Join-Path $env:TEMP ("roamdock-ecm-result-{0}.json" -f $PID)
  }
  $escapedScript = $PSCommandPath.Replace("'", "''")
  $escapedResult = $ResultPath.Replace("'", "''")
  $command = "& '$escapedScript' -Elevated -ResultPath '$escapedResult'"
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))

  try {
    $child = Start-Process -FilePath (Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe") `
      -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encoded `
      -Verb RunAs -WindowStyle Hidden -Wait -PassThru
    if (Test-Path -LiteralPath $ResultPath) {
      $json = Get-Content -LiteralPath $ResultPath -Raw -Encoding UTF8
      Write-Output $json
      $parsed = $json | ConvertFrom-Json
      if ($parsed.ok) { exit 0 }
      exit 1
    }
    throw "The elevated driver process returned no result (exit code $($child.ExitCode))."
  }
  catch {
    Publish-Result ([ordered]@{
      ok = $false
      changed = $false
      error = "Administrator approval was cancelled or failed: $($_.Exception.Message)"
      status = Get-EcmStatus
    })
    exit 1
  }
}

if (-not (Test-Administrator)) {
  Publish-Result ([ordered]@{
    ok = $false
    changed = $false
    error = "The driver installer did not receive administrator rights."
    status = Get-EcmStatus
  })
  exit 1
}

try {
  New-Item -ItemType Directory -Force -Path $programRoot | Out-Null
  $runName = "{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), $PID
  $runRoot = Join-Path $programRoot ("Runs\" + $runName)
  $packageRoot = Join-Path $runRoot "package"
  $tempRoot = Join-Path $runRoot "temp"
  $adminImage = Join-Path $runRoot "admin-image"
  $backupRoot = Join-Path $programRoot ("Backups\" + $runName)
  New-Item -ItemType Directory -Force -Path $runRoot, $packageRoot, $tempRoot, $backupRoot | Out-Null

  $zipPath = Join-Path $runRoot "quectel-ecm-v1.0.zip"
  Invoke-WebRequest -UseBasicParsing -Uri $officialUrl -OutFile $zipPath -TimeoutSec 120
  $actualHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($actualHash -ne $expectedZipSha256) {
    throw "Official package hash mismatch. Expected $expectedZipSha256 but received $actualHash."
  }

  Expand-Archive -LiteralPath $zipPath -DestinationPath $packageRoot -Force
  $compressedSetup = Get-ChildItem -LiteralPath $packageRoot -Recurse -File -Filter "setup.ex_" | Select-Object -First 1
  if (-not $compressedSetup) { throw "The official package did not contain setup.ex_." }

  $setupPath = Join-Path $runRoot "setup.exe"
  $expandOutput = & (Join-Path $env:WINDIR "System32\expand.exe") $compressedSetup.FullName $setupPath 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $setupPath)) {
    throw "Could not expand the official setup.exe: $expandOutput"
  }
  $company = (Get-Item -LiteralPath $setupPath).VersionInfo.CompanyName
  if ($company -notmatch "Quectel Wireless Solutions") {
    throw "The downloaded installer did not report Quectel as its publisher."
  }

  $setupProcessIds = @(Get-Process setup -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $setupLog = Join-Path $runRoot "setup.log"
  $setupArguments = "/s /v`"/qn REBOOT=ReallySuppress`" /debuglog`"$setupLog`""
  $setupExit = Invoke-ProcessWithEnvironment -FilePath $setupPath -Arguments $setupArguments `
    -Environment @{ TEMP = $tempRoot; TMP = $tempRoot } -TimeoutSeconds 180

  Start-Sleep -Seconds 8
  $afterOfficialSetup = Get-EcmStatus
  if ($afterOfficialSetup.ready) {
    Publish-Result ([ordered]@{
      ok = $true
      changed = $true
      message = "The official Quectel ECM package installed successfully."
      source = $officialUrl
      zipSha256 = $actualHash
      setupExitCode = $setupExit
      backupDirectory = ""
      status = $afterOfficialSetup
    })
    exit 0
  }

  $waitUntil = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $waitUntil -and @(Get-NewSetupProcesses).Count -gt 0) {
    Start-Sleep -Seconds 2
  }
  Stop-NewSetupProcesses

  $extractedMsi = Get-ChildItem -LiteralPath $tempRoot -Recurse -File -Filter "*.msi" -ErrorAction SilentlyContinue |
    Sort-Object Length -Descending |
    Select-Object -First 1
  if (-not $extractedMsi) {
    throw "The official installer did not bind the driver and its internal MSI could not be recovered (setup exit $setupExit)."
  }

  $msiPath = Join-Path $runRoot "driver.msi"
  Copy-Item -LiteralPath $extractedMsi.FullName -Destination $msiPath -Force
  New-Item -ItemType Directory -Force -Path $adminImage | Out-Null
  $adminLog = Join-Path $runRoot "admin-extract.log"
  $msiArguments = "/a `"$msiPath`" /qn TARGETDIR=`"$adminImage`" /l*v `"$adminLog`""
  $msiExit = Invoke-ProcessWithEnvironment -FilePath (Join-Path $env:WINDIR "System32\msiexec.exe") `
    -Arguments $msiArguments -TimeoutSeconds 180
  if ($msiExit -ne 0) { throw "Administrative MSI extraction failed with exit code $msiExit." }

  $inf = Get-ChildItem -LiteralPath $adminImage -Recurse -File -Filter "qcecm.inf" | Select-Object -First 1
  if (-not $inf) { throw "The administrative image did not contain qcecm.inf." }
  $infText = Get-Content -LiteralPath $inf.FullName -Raw
  if ($infText -notmatch 'USB\\VID_2C7C&PID_0125&MI_04' -or
      $infText -notmatch 'DriverVer\s*=\s*03/18/2024,19\.0\.33\.201' -or
      $infText -notmatch 'EnableDhcp\s*=\s*1') {
    throw "qcecm.inf did not match the verified 2C7C:0125 ECM profile."
  }

  $cat = Join-Path $inf.DirectoryName "qcecm.cat"
  $sys = Join-Path $inf.DirectoryName "ecm\X64\QuectelECMDriverV2.sys"
  $catSignature = Get-AuthenticodeSignature -FilePath $cat
  $sysSignature = Get-AuthenticodeSignature -FilePath $sys
  if ($catSignature.Status -ne "Valid" -or $catSignature.SignerCertificate.Subject -notmatch "Microsoft Windows Hardware Compatibility Publisher") {
    throw "The ECM catalog signature is not a valid Microsoft WHCP signature."
  }
  if ($sysSignature.Status -ne "Valid" -or $sysSignature.SignerCertificate.Subject -notmatch "Quectel Wireless Solutions") {
    throw "The ECM driver binary signature is not a valid Quectel signature."
  }

  $pnputil = Join-Path $env:WINDIR "System32\pnputil.exe"
  $existingInfs = Get-CimInstance Win32_PnPSignedDriver -ErrorAction SilentlyContinue |
    Where-Object { $_.DeviceID -like "USB\VID_2C7C&PID_0125*" -and $_.InfName } |
    Select-Object -ExpandProperty InfName -Unique
  $backupLog = Join-Path $runRoot "driver-backup.log"
  foreach ($infName in $existingInfs) {
    (& $pnputil /export-driver $infName $backupRoot 2>&1 | Out-String) |
      Add-Content -LiteralPath $backupLog -Encoding UTF8
  }

  $installOutput = & $pnputil /add-driver $inf.FullName /install 2>&1 | Out-String
  $installExit = $LASTEXITCODE
  $installOutput | Set-Content -LiteralPath (Join-Path $runRoot "pnputil-install.log") -Encoding UTF8
  if ($installExit -ne 0) { throw "PnPUtil rejected qcecm.inf with exit code ${installExit}: $installOutput" }
  & $pnputil /scan-devices | Out-Null
  Start-Sleep -Seconds 10

  $final = Get-EcmStatus
  if (-not $final.ready) {
    throw "The signed ECM driver was added, but Windows did not bind it to the target interface."
  }

  Publish-Result ([ordered]@{
    ok = $true
    changed = $true
    message = "The verified Quectel ECM driver was installed and bound to the module."
    source = $officialUrl
    zipSha256 = $actualHash
    setupExitCode = $setupExit
    backupDirectory = $backupRoot
    status = $final
  })
  exit 0
}
catch {
  Stop-NewSetupProcesses
  Publish-Result ([ordered]@{
    ok = $false
    changed = $false
    error = $_.Exception.Message
    source = $officialUrl
    status = Get-EcmStatus
  })
  exit 1
}
