#!/usr/bin/env bash
# Noctis helper installer for macOS.
# Usage:  curl -fsSL https://noctis.c0nn3ct.xyz/macos.sh | bash -s -- <chrome-extension-id> [cores]
#   [cores] = all (default) | comma-separated subset of: sing-box,xray,mihomo
#   (or set NOCTIS_CORES=sing-box,xray in the environment)
set -euo pipefail

OS="darwin"
EXT_ID="${1:-}"
if [[ -z "$EXT_ID" ]]; then
  echo "Usage: bash macos.sh <extension-id> [cores]" >&2
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

REPO="c0nn3ct-xyz/noctis-host"

uname_m="$(uname -m)"
case "$uname_m" in
  arm64|aarch64) ARCH="arm64" ;;
  x86_64|amd64)  ARCH="amd64" ;;
  *) echo "Unsupported macOS arch: $uname_m" >&2; exit 1 ;;
esac

TAG="$(curl -fsSLI -o /dev/null -w '%{url_effective}\n' \
  "https://github.com/$REPO/releases/latest" | sed 's|.*/tag/||')"
if [[ -z "$TAG" || "$TAG" == *"/releases/latest"* ]]; then
  echo "Failed to resolve latest noctis-host release tag." >&2
  exit 1
fi

INSTALL_DIR="$HOME/.local/share/noctis"
mkdir -p "$INSTALL_DIR"
HOST_BIN="$INSTALL_DIR/noctis-host"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Pinned core versions — single source of truth served alongside this script.
# Override NOCTIS_CORES_ENV_URL to test against a local copy (e.g. a file:// URL).
CORES_ENV_URL="${NOCTIS_CORES_ENV_URL:-https://noctis.c0nn3ct.xyz/cores.env}"
if ! curl -fsSL "$CORES_ENV_URL" -o "$TMP/cores.env"; then
  echo "Failed to fetch core version pins ($CORES_ENV_URL)." >&2; exit 1
fi
# shellcheck disable=SC1091
source "$TMP/cores.env"
: "${SINGBOX_VERSION:?cores.env missing SINGBOX_VERSION}"
: "${XRAY_VERSION:?cores.env missing XRAY_VERSION}"
: "${MIHOMO_VERSION:?cores.env missing MIHOMO_VERSION}"

# --- noctis-host binary (from our release; the tarball's bundled sing-box is
#     ignored — cores are fetched from upstream at pinned versions below) ---
ARCHIVE="noctis-host-${TAG}-${OS}-${ARCH}.tar.gz"
echo "→ downloading $ARCHIVE"
curl -fL --progress-bar "https://github.com/$REPO/releases/download/$TAG/$ARCHIVE" -o "$TMP/$ARCHIVE"
tar -xzf "$TMP/$ARCHIVE" -C "$TMP"
install -m 0755 "$TMP/noctis-host-${TAG}-${OS}-${ARCH}/noctis-host" "$HOST_BIN"

# --- proxy cores from upstream (pinned in cores.env) ---
fetch_singbox() {
  local v="$SINGBOX_VERSION" name="sing-box-${SINGBOX_VERSION}-${OS}-${ARCH}"
  echo "→ sing-box ${v}"
  curl -fL --progress-bar "https://github.com/SagerNet/sing-box/releases/download/v${v}/${name}.tar.gz" -o "$TMP/sb.tar.gz"
  tar -xzf "$TMP/sb.tar.gz" -C "$TMP"
  install -m 0755 "$TMP/${name}/sing-box" "$INSTALL_DIR/sing-box"
}
fetch_xray() {
  local v="$XRAY_VERSION" xos xarch
  case "$OS" in darwin) xos="macos" ;; linux) xos="linux" ;; esac
  case "$ARCH" in amd64) xarch="64" ;; arm64) xarch="arm64-v8a" ;; esac
  echo "→ xray ${v}"
  curl -fL --progress-bar "https://github.com/XTLS/Xray-core/releases/download/${v}/Xray-${xos}-${xarch}.zip" -o "$TMP/xray.zip"
  unzip -oq "$TMP/xray.zip" -d "$TMP/xray"
  install -m 0755 "$TMP/xray/xray" "$INSTALL_DIR/xray"
}
fetch_mihomo() {
  local v="$MIHOMO_VERSION" name="mihomo-${OS}-${ARCH}-${MIHOMO_VERSION}"
  echo "→ mihomo ${v}"
  curl -fL --progress-bar "https://github.com/MetaCubeX/mihomo/releases/download/${v}/${name}.gz" -o "$TMP/mihomo.gz"
  gunzip -c "$TMP/mihomo.gz" > "$INSTALL_DIR/mihomo"
  chmod +x "$INSTALL_DIR/mihomo"
}
fetch_geo() {
  echo "→ geo assets (geoip, geosite)"
  curl -fsSL -o "$INSTALL_DIR/geoip.dat"   https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geoip.dat
  curl -fsSL -o "$INSTALL_DIR/geosite.dat" https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat
}

need_geo=0
for c in "${WANT_CORES[@]}"; do
  case "$c" in
    sing-box) fetch_singbox ;;
    xray)     fetch_xray;   need_geo=1 ;;
    mihomo)   fetch_mihomo; need_geo=1 ;;
  esac
done
(( need_geo )) && fetch_geo

# Clear the quarantine bit so Gatekeeper doesn't block the freshly downloaded binaries.
xattr -dr com.apple.quarantine "$INSTALL_DIR" 2>/dev/null || true

NM_NAME="com.noctis.host"
TARGETS=(
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  "$HOME/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
  "$HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
  "$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
  "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
  "$HOME/Library/Application Support/Arc/User Data/NativeMessagingHosts"
  "$HOME/Library/Application Support/Vivaldi/NativeMessagingHosts"
  "$HOME/Library/Application Support/com.operasoftware.Opera/NativeMessagingHosts"
  "$HOME/Library/Application Support/Yandex/YandexBrowser/NativeMessagingHosts"
)

# Merge ids into allowed_origins instead of overwriting: each browser/profile has
# its own extension id, so running this from a second browser must not evict the
# first. Union of (ids already in the file) + the passed EXT_ID, deduped.
build_origins() {                       # $1 = manifest path
  { [[ -f "$1" ]] && grep -oE 'chrome-extension://[a-p]{32}/' "$1"
    echo "chrome-extension://$EXT_ID/"; } | sort -u \
  | awk 'NR>1{printf ",\n    "} {printf "\"%s\"", $0}'
}

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
echo "Using more browsers/profiles? Run the command shown in each — ids accumulate."
