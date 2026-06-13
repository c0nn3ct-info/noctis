# Noctis helper installer for Windows.
# Usage:
#   $env:NOCTIS_EXT_ID='<extension-id>'; iwr -useb https://noctis.c0nn3ct.xyz/windows.ps1 | iex
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

$repo = 'c0nn3ct-xyz/noctis-host'

$arch = switch -Wildcard ((Get-CimInstance Win32_Processor).Architecture) {
  9 { 'amd64' }                # x64
  12 { 'arm64' }
  default { 'amd64' }
}

$latest = Invoke-WebRequest -UseBasicParsing -MaximumRedirection 5 -Uri "https://github.com/$repo/releases/latest"
$tag = ($latest.BaseResponse.ResponseUri.AbsolutePath -replace '.*/tag/','').Trim('/')
if (-not $tag -or $tag -match 'releases/latest') {
  Write-Error 'Failed to resolve latest noctis-host release tag.'
  exit 1
}

# Pinned core versions — single source of truth served alongside this script.
# Override $env:NOCTIS_CORES_ENV_URL to test against a local copy.
$coresEnvUrl = if ($env:NOCTIS_CORES_ENV_URL) { $env:NOCTIS_CORES_ENV_URL } else { 'https://noctis.c0nn3ct.xyz/cores.env' }
$pins = @{}
try {
  $envText = (Invoke-WebRequest -UseBasicParsing -Uri $coresEnvUrl).Content
} catch {
  Write-Error "Failed to fetch core version pins ($coresEnvUrl)."
  exit 1
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
  Copy-Item (Join-Path $src 'noctis-host.exe') $hostBin -Force

  foreach ($c in $wantCores) {
    switch ($c) {
      'sing-box' {
        $name = "sing-box-$singboxVersion-windows-$arch"
        Write-Host "-> sing-box $singboxVersion"
        $z = Join-Path $tmp 'sb.zip'
        Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/SagerNet/sing-box/releases/download/v$singboxVersion/$name.zip" -OutFile $z
        Expand-Archive -Path $z -DestinationPath (Join-Path $tmp 'sb') -Force
        Copy-Item (Join-Path $tmp "sb\$name\sing-box.exe") (Join-Path $installDir 'sing-box.exe') -Force
      }
      'xray' {
        Write-Host "-> xray $xrayVersion"
        $z = Join-Path $tmp 'xray.zip'
        Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/XTLS/Xray-core/releases/download/$xrayVersion/Xray-windows-$xarch.zip" -OutFile $z
        Expand-Archive -Path $z -DestinationPath (Join-Path $tmp 'xray') -Force
        Copy-Item (Join-Path $tmp 'xray\xray.exe') (Join-Path $installDir 'xray.exe') -Force
        $needGeo = $true
      }
      'mihomo' {
        $name = "mihomo-windows-$arch-$mihomoVersion"
        Write-Host "-> mihomo $mihomoVersion"
        $z = Join-Path $tmp 'mihomo.zip'
        Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/MetaCubeX/mihomo/releases/download/$mihomoVersion/$name.zip" -OutFile $z
        Expand-Archive -Path $z -DestinationPath (Join-Path $tmp 'mihomo') -Force
        $exe = Get-ChildItem -Path (Join-Path $tmp 'mihomo') -Filter *.exe -Recurse | Select-Object -First 1
        Copy-Item $exe.FullName (Join-Path $installDir 'mihomo.exe') -Force
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
