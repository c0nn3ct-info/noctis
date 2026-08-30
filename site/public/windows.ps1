# Noctis helper installer for Windows.
# Usage:
#   $env:NOCTIS_EXT_ID='<extension-id>'; iwr -useb https://noctis.c0nn3ct.info/windows.ps1 | iex
#   # optionally choose cores: $env:NOCTIS_CORES='sing-box,xray' (default: all)
# Or, if you have the script saved locally:
#   .\windows.ps1 -ExtensionId <extension-id> -Cores sing-box,xray

[CmdletBinding()]
param(
  [string]$ExtensionId = $env:NOCTIS_EXT_ID,
  [string]$Cores = $env:NOCTIS_CORES
)

$ErrorActionPreference = 'Stop'

if (-not $ExtensionId) {
  Write-Error 'Pass the extension ID via $env:NOCTIS_EXT_ID or -ExtensionId.'
  exit 1
}
if ($ExtensionId -notmatch '^[a-p]{32}$') {
  Write-Error "Invalid extension id: $ExtensionId (expected 32 chars a-p)"
  exit 1
}

# Which proxy cores to install. -Cores / $env:NOCTIS_CORES, else all.
if (-not $Cores) { $Cores = 'all' }
if ($Cores -eq 'all') { $Cores = 'sing-box,xray,mihomo' }
$wantCores = @()
foreach ($c in ($Cores -split ',')) {
  $c = $c.Trim()
  if (-not $c) { continue }
  if ($c -notin @('sing-box', 'xray', 'mihomo')) {
    Write-Error "Unknown core: '$c' (use sing-box, xray, mihomo, or all)"
    exit 1
  }
  $wantCores += $c
}
if ($wantCores.Count -eq 0) {
  Write-Error 'No cores selected.'
  exit 1
}

$repo = 'c0nn3ct-info/noctis'

# Select-Object -First 1: Win32_Processor returns one object per socket/core, so
# on multi-processor machines .Architecture is an array. Feeding an array to the
# switch makes $arch an array too, which interpolates as "arm64 arm64 ..." into
# the download URL. Pin to a single processor.
$arch = switch -Wildcard ((Get-CimInstance Win32_Processor | Select-Object -First 1).Architecture) {
  9 { 'amd64' }                # x64
  12 { 'arm64' }
  default { 'amd64' }
}

# Resolve latest noctis-host tag via the GitHub API. The redirect from
# github.com/.../releases/latest is unreliable across PowerShell versions:
# BaseResponse exposes ResponseUri only on Windows PowerShell 5.1, not 7+.
try {
  $tag = (Invoke-RestMethod -UseBasicParsing -Uri "https://api.github.com/repos/$repo/releases/latest" `
    -Headers @{ 'User-Agent' = 'noctis-installer' }).tag_name
} catch {
  Write-Error "Failed to resolve latest noctis-host release tag: $($_.Exception.Message)"
  exit 1
}
if (-not $tag) {
  Write-Error 'Failed to resolve latest noctis-host release tag (empty tag_name).'
  exit 1
}

# Pinned core versions — single source of truth served alongside this script.
# Override $env:NOCTIS_CORES_ENV_URL to test against a local copy.
$coresEnvUrl = if ($env:NOCTIS_CORES_ENV_URL) { $env:NOCTIS_CORES_ENV_URL } else { 'https://noctis.c0nn3ct.info/cores.env' }
$pins = @{}
$tmpEnv = Join-Path $env:TEMP ("noctis-cores-" + [guid]::NewGuid() + ".env")
try {
  # -OutFile writes the raw bytes regardless of the served content-type; reading
  # back with Get-Content -Raw decodes to text. Fetching into .Content instead
  # breaks on GitHub Pages, which serves .env as application/octet-stream and
  # makes PowerShell's .Content a byte[] rather than a parseable string.
  Invoke-WebRequest -UseBasicParsing -Uri $coresEnvUrl -OutFile $tmpEnv
  $envText = Get-Content -Raw -Path $tmpEnv
} catch {
  Write-Error "Failed to fetch core version pins ($coresEnvUrl)."
  exit 1
} finally {
  Remove-Item -Force -ErrorAction SilentlyContinue $tmpEnv
}
foreach ($line in ($envText -split "`n")) {
  $line = $line.Trim()
  if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
    $kv = $line -split '=', 2
    $pins[$kv[0].Trim()] = $kv[1].Trim()
  }
}
$singboxVersion = $pins['SINGBOX_VERSION']
$xrayVersion    = $pins['XRAY_VERSION']
$mihomoVersion  = $pins['MIHOMO_VERSION']
if (-not $singboxVersion -or -not $xrayVersion -or -not $mihomoVersion) {
  Write-Error 'cores.env is missing one or more version pins.'
  exit 1
}

$installDir = Join-Path $env:LOCALAPPDATA 'Noctis'
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

# Stop any helper/core still running from the install dir so the (locked) .exe
# files can be overwritten; the browser respawns the helper from the new build.
function Stop-NoctisProcesses {
  Get-CimInstance Win32_Process |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath -like "$installDir\*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

# Windows refuses to overwrite a running .exe, and killing once up front is not
# enough: the browser respawns the helper on its next native message, which lands
# while this script is still downloading. So each binary is copied through here,
# which stops whatever holds the file and retries — no need to close the browser.
function Copy-Binary($src, $dst) {
  for ($i = 1; $i -le 6; $i++) {
    Stop-NoctisProcesses
    try {
      Copy-Item $src $dst -Force -ErrorAction Stop
      return
    } catch {
      if ($i -eq 6) {
        throw "Could not replace $dst - it is still in use. Close the browser and re-run this command.`n$($_.Exception.Message)"
      }
      Start-Sleep -Milliseconds 400
    }
  }
}

Stop-NoctisProcesses

$hostBin = Join-Path $installDir 'noctis-host.exe'
# xray arch token differs from the Go arch: amd64 -> 64, arm64 -> arm64-v8a.
$xarch = if ($arch -eq 'arm64') { 'arm64-v8a' } else { '64' }

$archive = "noctis-host-$tag-windows-$arch.zip"
$url     = "https://github.com/$repo/releases/download/$tag/$archive"

$tmp = Join-Path $env:TEMP ("noctis-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$needGeo = $false
try {
  # noctis-host binary (the tarball's bundled sing-box is ignored — cores are
  # fetched from upstream at pinned versions below).
  Write-Host "-> downloading $archive"
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile (Join-Path $tmp $archive)
  Expand-Archive -Path (Join-Path $tmp $archive) -DestinationPath $tmp -Force
  $src = Join-Path $tmp "noctis-host-$tag-windows-$arch"
  Copy-Binary (Join-Path $src 'noctis-host.exe') $hostBin

  foreach ($c in $wantCores) {
    switch ($c) {
      'sing-box' {
        $name = "sing-box-$singboxVersion-windows-$arch"
        Write-Host "-> sing-box $singboxVersion"
        $z = Join-Path $tmp 'sb.zip'
        Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/SagerNet/sing-box/releases/download/v$singboxVersion/$name.zip" -OutFile $z
        Expand-Archive -Path $z -DestinationPath (Join-Path $tmp 'sb') -Force
        Copy-Binary (Join-Path $tmp "sb\$name\sing-box.exe") (Join-Path $installDir 'sing-box.exe')
      }
      'xray' {
        Write-Host "-> xray $xrayVersion"
        $z = Join-Path $tmp 'xray.zip'
        Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/XTLS/Xray-core/releases/download/$xrayVersion/Xray-windows-$xarch.zip" -OutFile $z
        Expand-Archive -Path $z -DestinationPath (Join-Path $tmp 'xray') -Force
        Copy-Binary (Join-Path $tmp 'xray\xray.exe') (Join-Path $installDir 'xray.exe')
        $needGeo = $true
      }
      'mihomo' {
        $name = "mihomo-windows-$arch-$mihomoVersion"
        Write-Host "-> mihomo $mihomoVersion"
        $z = Join-Path $tmp 'mihomo.zip'
        Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/MetaCubeX/mihomo/releases/download/$mihomoVersion/$name.zip" -OutFile $z
        Expand-Archive -Path $z -DestinationPath (Join-Path $tmp 'mihomo') -Force
        $exe = Get-ChildItem -Path (Join-Path $tmp 'mihomo') -Filter *.exe -Recurse | Select-Object -First 1
        Copy-Binary $exe.FullName (Join-Path $installDir 'mihomo.exe')
        $needGeo = $true
      }
    }
  }

  if ($needGeo) {
    Write-Host '-> geo assets (geoip, geosite)'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geoip.dat'   -OutFile (Join-Path $installDir 'geoip.dat')
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat' -OutFile (Join-Path $installDir 'geosite.dat')
  }
} finally {
  Remove-Item -Recurse -Force $tmp
}

$manifestPath = Join-Path $installDir 'com.noctis.host.json'

# Merge ids into allowed_origins instead of overwriting: each browser/profile has
# its own extension id, so re-running from another browser must not evict the
# first. Union of (ids already in the file) + the passed id, deduped.
$origins = New-Object System.Collections.Generic.List[string]
if (Test-Path $manifestPath) {
  try {
    $prev = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
    foreach ($o in @($prev.allowed_origins)) { if ($o) { $origins.Add([string]$o) } }
  } catch { }
}
$origins.Add("chrome-extension://$ExtensionId/")
$uniqueOrigins = @($origins | Sort-Object -Unique)

# Hand-build the JSON so a single-element array still serializes as an array
# (ConvertTo-Json unwraps one-item arrays into a bare scalar). Each value goes
# through ConvertTo-Json individually for correct quoting/escaping.
$originsJson = ($uniqueOrigins | ForEach-Object { $_ | ConvertTo-Json }) -join ",`n    "
$pathJson = $hostBin | ConvertTo-Json
$manifest = @"
{
  "name": "com.noctis.host",
  "description": "Noctis native helper",
  "path": $pathJson,
  "type": "stdio",
  "allowed_origins": [
    $originsJson
  ]
}
"@
[System.IO.File]::WriteAllText($manifestPath, $manifest)

$registryRoots = @(
  'Software\Google\Chrome\NativeMessagingHosts',
  'Software\Chromium\NativeMessagingHosts',
  'Software\BraveSoftware\Brave-Browser\NativeMessagingHosts',
  'Software\Microsoft\Edge\NativeMessagingHosts',
  'Software\Vivaldi\NativeMessagingHosts',
  'Software\Opera Software\Opera Stable\NativeMessagingHosts',
  'Software\Yandex\YandexBrowser\NativeMessagingHosts'
)

$written = 0
foreach ($root in $registryRoots) {
  $key = "$root\com.noctis.host"
  try {
    # Registry.SetValue creates the key (and intermediates) when missing and never
    # deletes existing subkeys. New-Item -Force delete-recreates instead, which both
    # wipes sibling host registrations and hits a Windows PowerShell 5.1 bug
    # ("Cannot delete a subkey tree because the subkey does not exist").
    [Microsoft.Win32.Registry]::SetValue("HKEY_CURRENT_USER\$key", '', $manifestPath)
    Write-Host "  registered HKCU\$key"
    $written++
  } catch {
    Write-Warning "  skipped HKCU\$key ($($_.Exception.Message))"
  }
}

if ($written -eq 0) {
  Write-Error 'Could not register the helper for any browser.'
  exit 1
}

Write-Host ''
Write-Host "Done. Registered for $written browser(s)."
Write-Host "Helper:    $hostBin"
Write-Host "Manifest:  $manifestPath"
Write-Host 'Reload Noctis on chrome://extensions to pick up the helper.'
Write-Host 'Using more browsers/profiles? Re-run with each browser id - ids accumulate.'
