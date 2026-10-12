#!/usr/bin/env bash
# Install the native messaging manifest for noctis on macOS.
# Usage: install-macos.sh <chrome-extension-id>
set -euo pipefail

EXT_ID="${1:-}"
if [[ -z "$EXT_ID" ]]; then
  echo "Usage: $0 <extension-id>" >&2
  exit 1
fi
if [[ ! "$EXT_ID" =~ ^[a-p]{32}$ ]]; then
  echo "Invalid extension id: $EXT_ID (expected 32 chars a-p)" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NATIVE_HOST_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOST_BIN_SRC="$NATIVE_HOST_DIR/noctis-host"

if [[ ! -x "$HOST_BIN_SRC" ]]; then
  if command -v go >/dev/null 2>&1; then
    echo "noctis-host not built — building…"
    ( cd "$NATIVE_HOST_DIR" && go build -o noctis-host . )
  else
    echo "Helper binary missing: $HOST_BIN_SRC" >&2
    echo "Install Go, or build first:  (cd host && go build -o noctis-host .)" >&2
    exit 1
  fi
fi

INSTALL_DIR="$HOME/.local/share/noctis"
mkdir -p "$INSTALL_DIR"
HOST_BIN_DEST="$INSTALL_DIR/noctis-host"
# rm before cp: overwriting a signed Mach-O in place reuses the inode, and the
# kernel's per-inode code-signing cache keeps the OLD binary's cdhash bound to
# it. The new bytes then fail signature validation at exec -> "Killed: 9". A
# fresh inode (rm + cp) sidesteps the stale cache.
rm -f "$HOST_BIN_DEST"
cp "$HOST_BIN_SRC" "$HOST_BIN_DEST"
chmod +x "$HOST_BIN_DEST"
/usr/bin/xattr -d com.apple.quarantine "$HOST_BIN_DEST" 2>/dev/null || true

# Make this a one-shot install: fetch any core missing from embed/ (a clean
# checkout leaves it empty — the binaries are gitignored). Per-core so present
# ones aren't re-downloaded.
FETCH="$NATIVE_HOST_DIR/scripts/fetch-cores.sh"
for core in sing-box xray mihomo; do
  if [[ ! -x "$NATIVE_HOST_DIR/embed/$core" && -f "$FETCH" ]]; then
    echo "fetching ${core}..."
    bash "$FETCH" "$core"
  fi
done

# Install whichever proxy cores are in embed/. The helper finds them beside
# itself (locateBinary), so copying enables them; `hello` then reports each as
# available and the extension's core picker offers it.
install_blob() {                        # $1 = src path, $2 = dest name
  rm -f "$INSTALL_DIR/$2"
  cp "$1" "$INSTALL_DIR/$2"
  /usr/bin/xattr -d com.apple.quarantine "$INSTALL_DIR/$2" 2>/dev/null || true
}

cores_installed=0
for core in sing-box xray mihomo; do
  src="$NATIVE_HOST_DIR/embed/$core"
  if [[ -x "$src" ]]; then
    install_blob "$src" "$core"
    chmod +x "$INSTALL_DIR/$core"
    echo "copied $core -> $INSTALL_DIR/$core"
    cores_installed=$((cores_installed + 1))
  fi
done
if (( cores_installed == 0 )); then
  echo "warn: no cores in embed/ — run scripts/fetch-cores.sh all first" >&2
fi

# xray reads geoip.dat/geosite.dat from beside its binary; ship them when present
# so GEOIP/GEOSITE routing rules work offline.
for dat in geoip.dat geosite.dat; do
  if [[ -f "$NATIVE_HOST_DIR/embed/$dat" ]]; then
    install_blob "$NATIVE_HOST_DIR/embed/$dat" "$dat"
    echo "copied $dat -> $INSTALL_DIR/$dat"
  fi
done

NM_NAME="com.noctis.host"

# Each entry must point to <UserDataDir>/NativeMessagingHosts.
TARGETS=(
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  "$HOME/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
  "$HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
  "$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
  "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
  "$HOME/Library/Application Support/Arc/User Data/NativeMessagingHosts"
  "$HOME/Library/Application Support/net.imput.helium/NativeMessagingHosts"
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
  if [[ ! -d "$parent" ]]; then
    continue
  fi
  mkdir -p "$dir"
  manifest="$dir/$NM_NAME.json"
  origins="$(build_origins "$manifest")"
  cat > "$manifest" <<JSON
{
  "name": "$NM_NAME",
  "description": "Noctis native helper",
  "path": "$HOST_BIN_DEST",
  "type": "stdio",
  "allowed_origins": [
    $origins
  ]
}
JSON
  echo "wrote $manifest"
  written=$((written + 1))
done

if (( written == 0 )); then
  echo "No supported browser data dirs found." >&2
  exit 1
fi

echo "Done. Installed for $written browser(s)."
echo "Helper at: $HOST_BIN_DEST"
echo "Reload the unpacked extension in chrome://extensions to pick up changes."
echo "Using more browsers/profiles? Re-run with each browser's id — ids accumulate."
