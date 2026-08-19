#!/usr/bin/env bash
# Run the host test suite under coverage and fail below a threshold.
#
# Usage: coverage.sh [threshold]        (default: 100)
#
# Env:
#   COVER_PROFILE  where to write the profile (default: <module>/coverage.out)
#   COVER_HTML     if set, also write an HTML report to this path
#
# The Go toolchain has no built-in threshold gate, so this is the equivalent of
# the `thresholds` block the extension and site vitest configs carry.
set -euo pipefail

THRESHOLD="${1:-100}"
MODULE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="${COVER_PROFILE:-$MODULE_ROOT/coverage.out}"

cd "$MODULE_ROOT"
go test ./... -count=1 -coverprofile="$PROFILE"

if [ -n "${COVER_HTML:-}" ]; then
  go tool cover -html="$PROFILE" -o "$COVER_HTML"
  echo "html report: $COVER_HTML"
fi

# Per-function report; the last line is "total:\t(statements)\t<pct>%".
FUNCS="$(go tool cover -func="$PROFILE")"
TOTAL="$(printf '%s\n' "$FUNCS" | awk '/^total:/ { gsub(/%/, "", $NF); print $NF }')"

if [ -z "$TOTAL" ]; then
  echo "coverage: could not read a total out of $PROFILE" >&2
  exit 1
fi

# Below threshold: name the functions that are short, then fail.
if awk -v t="$TOTAL" -v want="$THRESHOLD" 'BEGIN { exit !(t < want) }'; then
  SHORT="$(printf '%s\n' "$FUNCS" | awk '$NF != "100.0%" && !/^total:/')"
  if [ -n "$SHORT" ]; then
    echo >&2
    echo "Functions below 100%:" >&2
    printf '%s\n' "$SHORT" >&2
  fi
  echo >&2
  echo "coverage $TOTAL% is below the $THRESHOLD% threshold" >&2
  exit 1
fi

echo "coverage $TOTAL% meets the $THRESHOLD% threshold"
