#!/usr/bin/env bash
# Noctis helper installer for Linux.
# Usage:  curl -fsSL https://noctis.c0nn3ct.info/linux.sh | bash -s -- <chrome-extension-id> [cores]
#   [cores] = all (default) | comma-separated subset of: sing-box,xray,mihomo
#   (or set NOCTIS_CORES=sing-box,xray in the environment)
set -Eeuo pipefail

OS="linux"
EXT_ID="${1:-}"
if [[ -z "$EXT_ID" ]]; then
  echo "Usage: bash linux.sh <extension-id> [cores]" >&2
  exit 1
fi
if [[ ! "$EXT_ID" =~ ^[a-p]{32}$ ]]; then
  echo "Invalid extension id: $EXT_ID (expected 32 chars a-p)" >&2
  exit 1
fi

# Which proxy cores to install. Positional 2nd arg wins, else $NOCTIS_CORES, else all.
CORES_SEL="${2:-${NOCTIS_CORES:-all}}"
[[ "$CORES_SEL" == "all" ]] && CORES_SEL="sing-box,xray,mihomo"
WANT_CORES=()
IFS=',' read -ra _sel <<< "$CORES_SEL"
for c in "${_sel[@]}"; do
  c="${c//[[:space:]]/}"
  [[ -z "$c" ]] && continue
  case "$c" in
    sing-box|xray|mihomo) WANT_CORES+=("$c") ;;
    *) echo "Unknown core: '$c' (use sing-box, xray, mihomo, or all)" >&2; exit 1 ;;
  esac
done
if [[ ${#WANT_CORES[@]} -eq 0 ]]; then
  echo "No cores selected." >&2; exit 1
fi

REPO="c0nn3ct-info/noctis"

uname_m="$(uname -m)"
case "$uname_m" in
  x86_64|amd64)  ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported Linux arch: $uname_m" >&2; exit 1 ;;
esac

# The installer is the one failure the extension never sees: it runs before the
# helper exists, so nobody is left holding diagnostics except the person reading
# the terminal. When a step dies, print exactly what a bug report needs and the
# link to the form that takes it. STEP is set by each stage below.
STEP="startup"
report_failure() {                      # $1 = exit code, $2 = line
  cat >&2 <<REPORT

Installation failed at step "$STEP" (line $2, exit $1).

Please report it — it takes a minute:
  https://github.com/$REPO/issues/new?template=install_failure.yml

Attach this block (it names versions and the failing step, nothing from your
home directory and nothing about your servers):

--- noctis install report ---
os=$OS arch=$ARCH step=$STEP exit=$1 line=$2
tag=${TAG:-unresolved} cores=${CORES_SEL:-?}
pins: singbox=${SINGBOX_VERSION:-?} xray=${XRAY_VERSION:-?} mihomo=${MIHOMO_VERSION:-?}
curl=$(curl --version 2>/dev/null | head -1 | cut -d" " -f2) bash=${BASH_VERSION:-?}
browsers_written=${written:-0}
--- end ---
REPORT
}
trap 'report_failure $? $LINENO' ERR

TAG="$(curl -fsSLI -o /dev/null -w '%{url_effective}\n' \
  "https://github.com/$REPO/releases/latest" | sed 's|.*/tag/||')"
if [[ -z "$TAG" || "$TAG" == *"/releases/latest"* ]]; then
  echo "Failed to resolve latest noctis-host release tag." >&2
  exit 1
fi
# The repository carries site tags (bare `0.5.1`) beside helper tags (`v1.2.5`),
# and only the helper ones have an archive built for them. The redirect above
# resolves to a published release, so it gets this right today; the check is what
# keeps a wrong answer from becoming a 404 halfway through the download, with
# nothing on screen naming the version it went looking for.
if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  echo "Resolved '$TAG', which is not a noctis-host release tag (expected vX.Y.Z)." >&2
  exit 1
fi

INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/noctis"
mkdir -p "$INSTALL_DIR"
HOST_BIN="$INSTALL_DIR/noctis-host"

# Replace a file that may be in use: write <dst>.new, then rename over <dst>.
# The live process keeps the old inode and the next spawn picks up the new file,
# where writing to <dst> in place would fail with ETXTBSY. The rename is also
# what makes a half-written geo database impossible: a core either reads the
# whole old file or the whole new one.
install_file() {                        # $1 = src, $2 = dst, $3 = mode
  install -m "$3" "$1" "$2.new"
  mv -f "$2.new" "$2"
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
STAGE="$TMP/stage"
mkdir -p "$STAGE"

# Pinned core versions — single source of truth served alongside this script.
# Override NOCTIS_CORES_ENV_URL to test against a local copy (e.g. a file:// URL).
STEP="core version pins"
CORES_ENV_URL="${NOCTIS_CORES_ENV_URL:-https://noctis.c0nn3ct.info/cores.env}"
if ! curl -fsSL "$CORES_ENV_URL" -o "$TMP/cores.env"; then
  echo "Failed to fetch core version pins ($CORES_ENV_URL)." >&2
  # Worth telling us about: the pins are served from one host, and it being
  # unreachable stops every install cold.
  report_failure 1 $LINENO
  exit 1
fi
# shellcheck disable=SC1091
source "$TMP/cores.env"
: "${SINGBOX_VERSION:?cores.env missing SINGBOX_VERSION}"
: "${XRAY_VERSION:?cores.env missing XRAY_VERSION}"
: "${MIHOMO_VERSION:?cores.env missing MIHOMO_VERSION}"
# Each upstream writes its tag differently and cores.env has been edited both
# ways; normalize here so a stray `v` is a typo that costs nothing instead of a
# 404 halfway through an install.
SINGBOX_VERSION="${SINGBOX_VERSION#v}"  # sing-box: bare in the asset name, v-tagged in the URL
XRAY_VERSION="v${XRAY_VERSION#v}"       # xray: v-tagged everywhere
MIHOMO_VERSION="v${MIHOMO_VERSION#v}"   # mihomo: v-tagged everywhere

# Everything is downloaded and unpacked into $STAGE first and only copied into
# place once all of it is there. Installing as we went left a machine with the
# new helper and no core the moment an upstream asset 404'd or the connection
# dropped — a state the extension reports as "sing-box binary not found" and no
# amount of reconnecting fixes.

# --- noctis-host binary (from our release; the tarball's bundled sing-box is
#     ignored — cores are fetched from upstream at pinned versions below) ---
stage_host() {
  STEP="noctis-host"
  local archive="noctis-host-${TAG}-${OS}-${ARCH}.tar.gz"
  echo "→ downloading $archive"
  curl -fL --progress-bar "https://github.com/$REPO/releases/download/$TAG/$archive" -o "$TMP/$archive"
  tar -xzf "$TMP/$archive" -C "$TMP"
  cp "$TMP/noctis-host-${TAG}-${OS}-${ARCH}/noctis-host" "$STAGE/noctis-host"
}

# --- proxy cores from upstream (pinned in cores.env) ---
stage_singbox() {
  STEP="sing-box"
  local v="$SINGBOX_VERSION" name="sing-box-${SINGBOX_VERSION}-${OS}-${ARCH}"
  echo "→ sing-box ${v}"
  curl -fL --progress-bar "https://github.com/SagerNet/sing-box/releases/download/v${v}/${name}.tar.gz" -o "$TMP/sb.tar.gz"
  tar -xzf "$TMP/sb.tar.gz" -C "$TMP"
  cp "$TMP/${name}/sing-box" "$STAGE/sing-box"
}
stage_xray() {
  STEP="xray"
  local v="$XRAY_VERSION" xos xarch
  case "$OS" in darwin) xos="macos" ;; linux) xos="linux" ;; esac
  case "$ARCH" in amd64) xarch="64" ;; arm64) xarch="arm64-v8a" ;; esac
  echo "→ xray ${v}"
  curl -fL --progress-bar "https://github.com/XTLS/Xray-core/releases/download/${v}/Xray-${xos}-${xarch}.zip" -o "$TMP/xray.zip"
  unzip -oq "$TMP/xray.zip" -d "$TMP/xray"
  cp "$TMP/xray/xray" "$STAGE/xray"
}
stage_mihomo() {
  STEP="mihomo"
  local v="$MIHOMO_VERSION" name="mihomo-${OS}-${ARCH}-${MIHOMO_VERSION}"
  echo "→ mihomo ${v}"
  curl -fL --progress-bar "https://github.com/MetaCubeX/mihomo/releases/download/${v}/${name}.gz" -o "$TMP/mihomo.gz"
  gunzip -c "$TMP/mihomo.gz" > "$STAGE/mihomo"
}
stage_geo() {
  STEP="geo assets"
  echo "→ geo assets (geoip, geosite)"
  curl -fsSL -o "$STAGE/geoip.dat"   https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geoip.dat
  curl -fsSL -o "$STAGE/geosite.dat" https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat
}

stage_host
need_geo=0
for c in "${WANT_CORES[@]}"; do
  case "$c" in
    sing-box) stage_singbox ;;
    xray)     stage_xray;   need_geo=1 ;;
    mihomo)   stage_mihomo; need_geo=1 ;;
  esac
done
(( need_geo )) && stage_geo

# Stop any helper/core still running from a previous install; the browser
# respawns the helper from the new build on its next native message. A courtesy,
# not a guarantee — the browser can respawn it between this line and the next,
# so every file still goes in through install_file.
STEP="installing files"
pkill -f "$INSTALL_DIR/" 2>/dev/null || true

install_file "$STAGE/noctis-host" "$HOST_BIN" 0755
for c in "${WANT_CORES[@]}"; do
  install_file "$STAGE/$c" "$INSTALL_DIR/$c" 0755
done
if (( need_geo )); then
  for dat in geoip.dat geosite.dat; do
    install_file "$STAGE/$dat" "$INSTALL_DIR/$dat" 0644
  done
fi

NM_NAME="com.noctis.host"
CONFIG_BASE="${XDG_CONFIG_HOME:-$HOME/.config}"
# One entry per <UserDataDir>/NativeMessagingHosts. A browser missing from this
# list is one where the helper installs fine and the extension then reports it
# as not found, so every channel the site advertises belongs here — including
# the sandboxed packagings, which keep their config tree somewhere else
# entirely. A Flatpak browser also needs to be able to execute $HOST_BIN
# (`flatpak override --filesystem=home`, or the equivalent in Flatseal);
# writing the manifest is necessary but not always sufficient there.
FLATPAK_BASE="$HOME/.var/app"
SNAP_BASE="$HOME/snap"
TARGETS=(
  "$CONFIG_BASE/google-chrome/NativeMessagingHosts"
  "$CONFIG_BASE/google-chrome-beta/NativeMessagingHosts"
  "$CONFIG_BASE/google-chrome-unstable/NativeMessagingHosts"
  "$CONFIG_BASE/chromium/NativeMessagingHosts"
  "$CONFIG_BASE/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  "$CONFIG_BASE/BraveSoftware/Brave-Browser-Beta/NativeMessagingHosts"
  "$CONFIG_BASE/BraveSoftware/Brave-Browser-Nightly/NativeMessagingHosts"
  "$CONFIG_BASE/microsoft-edge/NativeMessagingHosts"
  "$CONFIG_BASE/microsoft-edge-beta/NativeMessagingHosts"
  "$CONFIG_BASE/microsoft-edge-dev/NativeMessagingHosts"
  "$CONFIG_BASE/vivaldi/NativeMessagingHosts"
  "$CONFIG_BASE/vivaldi-snapshot/NativeMessagingHosts"
  "$CONFIG_BASE/opera/NativeMessagingHosts"
  "$CONFIG_BASE/opera-beta/NativeMessagingHosts"
  "$CONFIG_BASE/yandex-browser/NativeMessagingHosts"
  # Flatpak: each app keeps its own ~/.config equivalent.
  "$FLATPAK_BASE/com.google.Chrome/config/google-chrome/NativeMessagingHosts"
  "$FLATPAK_BASE/com.github.Eloston.UngoogledChromium/config/chromium/NativeMessagingHosts"
  "$FLATPAK_BASE/org.chromium.Chromium/config/chromium/NativeMessagingHosts"
  "$FLATPAK_BASE/com.brave.Browser/config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  "$FLATPAK_BASE/com.microsoft.Edge/config/microsoft-edge/NativeMessagingHosts"
  "$FLATPAK_BASE/com.vivaldi.Vivaldi/config/vivaldi/NativeMessagingHosts"
  "$FLATPAK_BASE/com.opera.Opera/config/opera/NativeMessagingHosts"
  # Snap: confined browsers read from the snap's own home.
  "$SNAP_BASE/chromium/current/.config/chromium/NativeMessagingHosts"
  "$SNAP_BASE/brave/current/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
)

# Merge ids into allowed_origins instead of overwriting: each browser/profile has
# its own extension id, so running this from a second browser must not evict the
# first. Union of (ids already in the file) + the passed EXT_ID, deduped.
build_origins() {                       # $1 = manifest path
  { [[ -f "$1" ]] && grep -oE 'chrome-extension://[a-p]{32}/' "$1"
    echo "chrome-extension://$EXT_ID/"; } | sort -u \
  | awk 'NR>1{printf ",\n    "} {printf "\"%s\"", $0}'
}

STEP="browser registration"
written=0
for dir in "${TARGETS[@]}"; do
  parent="$(dirname "$dir")"
  [[ -d "$parent" ]] || continue
  mkdir -p "$dir"
  manifest="$dir/$NM_NAME.json"
  origins="$(build_origins "$manifest")"
  cat > "$manifest" <<JSON
{
  "name": "$NM_NAME",
  "description": "Noctis native helper",
  "path": "$HOST_BIN",
  "type": "stdio",
  "allowed_origins": [
    $origins
  ]
}
JSON
  echo "  wrote $manifest"
  written=$((written + 1))
done

if (( written == 0 )); then
  echo "No supported browser data dirs found." >&2
  exit 1
fi

echo
echo "Done. Installed for $written browser(s)."
echo "Helper:  $HOST_BIN"
echo "Reload Noctis on chrome://extensions to pick up the helper."
