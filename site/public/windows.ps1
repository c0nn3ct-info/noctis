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

# The installer is the one failure the extension never sees: it runs before the
# helper exists, so nobody is left holding diagnostics except the person reading
# the console. On a terminating error, print exactly what a bug report needs —
# and put it on the clipboard, which on Windows we can actually rely on.
#
# $script:Step stays $null until the arguments have been validated, so a usage
# error is not dressed up as an install failure.
$script:Step = $null
function Write-InstallFailure($err) {
  if (-not $script:Step) { return }
  $msg = "$($err.Exception.Message)"
  # An error message often quotes a path under the user's profile.
  if ($env:USERNAME) { $msg = $msg -replace [regex]::Escape($env:USERNAME), '<user>' }
  $report = @"
--- noctis install report ---
os=windows arch=$arch step=$script:Step
tag=$tag cores=$Cores
pins: singbox=$singboxVersion xray=$xrayVersion mihomo=$mihomoVersion
line=$($err.InvocationInfo.ScriptLineNumber) ps=$($PSVersionTable.PSVersion)
error=$msg
--- end ---
"@
  Write-Host ''
  Write-Host "Installation failed at step `"$script:Step`"."
  Write-Host "Please report it - it takes a minute:"
  Write-Host "  https://github.com/$repo/issues/new?template=install_failure.yml"
  try {
    Set-Clipboard -Value $report
    Write-Host 'The block below is already on your clipboard - paste it into the form.'
  } catch {
    Write-Host 'Copy the block below into the form.'
  }
  Write-Host ''
  Write-Host $report
}
trap { Write-InstallFailure $_; break }


# Select-Object -First 1: Win32_Processor returns one object per socket/core, so
# on multi-processor machines .Architecture is an array. Feeding an array to the
# switch makes $arch an array too, which interpolates as "arm64 arm64 ..." into
# the download URL. Pin to a single processor.
$arch = switch -Wildcard ((Get-CimInstance Win32_Processor | Select-Object -First 1).Architecture) {
  9 { 'amd64' }                # x64
  12 { 'arm64' }
  default { 'amd64' }
}

# Whether a tag carries a helper build for this machine. A tag name is a guess
# until the archive answers: the release job builds `v*` and nothing else, but
# nothing keeps another release line in this repository from tagging in the same
# shape, and a guess that is wrong here becomes a 404 with the download already
# announced. One HEAD on the fallback path, none on the path usually taken.
function Test-HostRelease($candidate) {
  $probe = "https://github.com/$repo/releases/download/$candidate/noctis-host-$candidate-windows-$arch.zip"
  try {
    Invoke-WebRequest -UseBasicParsing -Method Head -Uri $probe `
      -Headers @{ 'User-Agent' = 'noctis-installer' } | Out-Null
    return $true
  } catch {
    return $false
  }
}

$script:Step = "release lookup"
# Resolve latest noctis-host tag via the GitHub API. The redirect from
# github.com/.../releases/latest is unreliable across PowerShell versions:
# BaseResponse exposes ResponseUri only on Windows PowerShell 5.1, not 7+.
$tag = $null
try {
  $tag = (Invoke-RestMethod -UseBasicParsing -Uri "https://api.github.com/repos/$repo/releases/latest" `
    -Headers @{ 'User-Agent' = 'noctis-installer' }).tag_name
} catch {
  Write-Host "-> release API unavailable ($($_.Exception.Message)); trying the release feed"
}
if (-not $tag) {
  # api.github.com is rate limited per IP (60/h unauthenticated), and one office
  # or one carrier-grade NAT shares that budget — a 403 there is not a reason to
  # abandon the install. The releases atom feed is plain HTML hosting, no quota.
  #
  # The feed carries every tag in the repository, not only the ones with a
  # release attached, and this repository tags the site (bare `0.5.1`) beside the
  # helper (`v1.2.5`). Taking the newest entry resolved a site version as the
  # helper version, and the install died on a 404 for an archive the release job
  # never built. Entries come newest first, so walk them and keep the first tag
  # that has the archive this machine is about to download: the shape check skips
  # the obvious misses without spending a round trip on them, and what settles it
  # is the archive.
  try {
    $feed = Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$repo/releases.atom" `
      -Headers @{ 'User-Agent' = 'noctis-installer' }
    $seen = @()
    foreach ($m in [regex]::Matches([string]$feed.Content, '/releases/tag/([^"<]+)')) {
      $candidate = $m.Groups[1].Value
      if ($seen -contains $candidate) { continue }
      $seen += $candidate
      if ($candidate -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+') { continue }
      if (Test-HostRelease $candidate) { $tag = $candidate; break }
    }
    if (-not $tag -and $seen.Count -gt 0) {
      Write-Host "-> no noctis-host release among the feed's $($seen.Count) newest tags"
    }
  } catch {
    Write-Host "-> release feed unavailable ($($_.Exception.Message))"
  }
}
if (-not $tag) {
  Write-Error 'Failed to resolve latest noctis-host release tag.'
  exit 1
}
# Whichever lookup answered, the tag has to be one the release job built for.
# Refusing here costs a line and replaces a 404 halfway through the download
# with a message that names what was resolved.
if ($tag -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+') {
  Write-Error "Resolved '$tag', which is not a noctis-host release tag (expected vX.Y.Z)."
  exit 1
}

# Pinned core versions — single source of truth served alongside this script.
# Override $env:NOCTIS_CORES_ENV_URL to test against a local copy.
$script:Step = "core version pins"
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
# Each upstream writes its tag differently and cores.env has been edited both
# ways; normalize here so a stray `v` is a typo that costs nothing instead of a
# 404 halfway through an install.
$singboxVersion = $singboxVersion -replace '^v', ''   # bare in the asset name, v-tagged in the URL
$xrayVersion    = 'v' + ($xrayVersion   -replace '^v', '')
$mihomoVersion  = 'v' + ($mihomoVersion -replace '^v', '')

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

# Geo databases are read by a core that may be running right now. Write beside
# the target and rename over it, so nobody ever opens a half-downloaded
# database — the old failure was a truncated geoip.dat that made xray refuse to
# start, with the install reporting success.
function Install-DataFile($src, $dst) {
  for ($i = 1; $i -le 6; $i++) {
    try {
      Copy-Item $src "$dst.new" -Force -ErrorAction Stop
      Move-Item "$dst.new" $dst -Force -ErrorAction Stop
      return
    } catch {
      if ($i -eq 6) {
        throw "Could not replace $dst - it is still in use. Close the browser and re-run this command.`n$($_.Exception.Message)"
      }
      # A core holding the old database open is the only thing that blocks the
      # rename; it is the same process Copy-Binary has to get out of the way.
      Stop-NoctisProcesses
      Start-Sleep -Milliseconds 400
    }
  }
}

$hostBin = Join-Path $installDir 'noctis-host.exe'
# xray arch token differs from the Go arch: amd64 -> 64, arm64 -> arm64-v8a.
$xarch = if ($arch -eq 'arm64') { 'arm64-v8a' } else { '64' }

$archive = "noctis-host-$tag-windows-$arch.zip"
$url     = "https://github.com/$repo/releases/download/$tag/$archive"

$tmp = Join-Path $env:TEMP ("noctis-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$stage = Join-Path $tmp 'stage'
New-Item -ItemType Directory -Force -Path $stage | Out-Null
$needGeo = $false
try {
  # Everything is downloaded and unpacked into $stage first and only copied into
  # place once all of it is there. Installing as we went left a machine with the
  # new helper and no core the moment an upstream asset 404'd or the connection
  # dropped — a state the extension reports as "sing-box binary not found" and
  # no amount of reconnecting fixes.

  # noctis-host binary (the tarball's bundled sing-box is ignored — cores are
  # fetched from upstream at pinned versions below).
  $script:Step = "noctis-host"
  Write-Host "-> downloading $archive"
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile (Join-Path $tmp $archive)
  Expand-Archive -Path (Join-Path $tmp $archive) -DestinationPath $tmp -Force
  $src = Join-Path $tmp "noctis-host-$tag-windows-$arch"
  Copy-Item (Join-Path $src 'noctis-host.exe') (Join-Path $stage 'noctis-host.exe') -Force

  foreach ($c in $wantCores) {
    switch ($c) {
      'sing-box' {
        $name = "sing-box-$singboxVersion-windows-$arch"
        $script:Step = "sing-box"
        Write-Host "-> sing-box $singboxVersion"
        $z = Join-Path $tmp 'sb.zip'
        Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/SagerNet/sing-box/releases/download/v$singboxVersion/$name.zip" -OutFile $z
        Expand-Archive -Path $z -DestinationPath (Join-Path $tmp 'sb') -Force
        Copy-Item (Join-Path $tmp "sb\$name\sing-box.exe") (Join-Path $stage 'sing-box.exe') -Force
      }
      'xray' {
        $script:Step = "xray"
        Write-Host "-> xray $xrayVersion"
        $z = Join-Path $tmp 'xray.zip'
        Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/XTLS/Xray-core/releases/download/$xrayVersion/Xray-windows-$xarch.zip" -OutFile $z
        Expand-Archive -Path $z -DestinationPath (Join-Path $tmp 'xray') -Force
        Copy-Item (Join-Path $tmp 'xray\xray.exe') (Join-Path $stage 'xray.exe') -Force
        $needGeo = $true
      }
      'mihomo' {
        $name = "mihomo-windows-$arch-$mihomoVersion"
        $script:Step = "mihomo"
        Write-Host "-> mihomo $mihomoVersion"
        $z = Join-Path $tmp 'mihomo.zip'
        Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/MetaCubeX/mihomo/releases/download/$mihomoVersion/$name.zip" -OutFile $z
        Expand-Archive -Path $z -DestinationPath (Join-Path $tmp 'mihomo') -Force
        $exe = Get-ChildItem -Path (Join-Path $tmp 'mihomo') -Filter *.exe -Recurse | Select-Object -First 1
        Copy-Item $exe.FullName (Join-Path $stage 'mihomo.exe') -Force
        $needGeo = $true
      }
    }
  }

  if ($needGeo) {
    $script:Step = 'geo assets'
    Write-Host '-> geo assets (geoip, geosite)'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geoip.dat'   -OutFile (Join-Path $stage 'geoip.dat')
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat' -OutFile (Join-Path $stage 'geosite.dat')
  }

  # Nothing above touched $installDir. From here on the download can no longer
  # fail, so a half-installed helper is no longer reachable.
  $script:Step = 'installing files'
  Copy-Binary (Join-Path $stage 'noctis-host.exe') $hostBin
  foreach ($c in $wantCores) {
    Copy-Binary (Join-Path $stage "$c.exe") (Join-Path $installDir "$c.exe")
  }
  if ($needGeo) {
    foreach ($dat in @('geoip.dat', 'geosite.dat')) {
      Install-DataFile (Join-Path $stage $dat) (Join-Path $installDir $dat)
    }
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

# One entry per browser/channel. A channel missing from this list is one where
# the helper installs fine and the extension then reports it as not found, so
# every channel the site advertises belongs here. Writing a key for a browser
# nobody installed costs an empty registry entry and nothing else.
$registryRoots = @(
  'Software\Google\Chrome\NativeMessagingHosts',
  'Software\Google\Chrome Beta\NativeMessagingHosts',
  'Software\Google\Chrome Dev\NativeMessagingHosts',
  'Software\Google\Chrome SxS\NativeMessagingHosts',
  'Software\Chromium\NativeMessagingHosts',
  'Software\BraveSoftware\Brave-Browser\NativeMessagingHosts',
  'Software\BraveSoftware\Brave-Browser-Beta\NativeMessagingHosts',
  'Software\BraveSoftware\Brave-Browser-Nightly\NativeMessagingHosts',
  'Software\Microsoft\Edge\NativeMessagingHosts',
  'Software\Microsoft\Edge Beta\NativeMessagingHosts',
  'Software\Microsoft\Edge Dev\NativeMessagingHosts',
  'Software\Vivaldi\NativeMessagingHosts',
  'Software\Opera Software\Opera Stable\NativeMessagingHosts',
  'Software\Opera Software\Opera GX Stable\NativeMessagingHosts',
  'Software\Yandex\YandexBrowser\NativeMessagingHosts'
)

$script:Step = 'browser registration'
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
