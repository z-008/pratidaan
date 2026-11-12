#!/usr/bin/env bash
# Renders Meera's sample lab report (data/demo/sample-lab-report-meera.html) to
# frontend/public/demo/sample-lab-report-meera.png, 800 × 560, with headless Chrome.
# Usage: data/demo/render-sample-lab-report.sh [output.png]
# Set CHROME to the Chrome or Chromium binary if it isn't found.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
src="$here/sample-lab-report-meera.html"
out="${1:-$root/frontend/public/demo/sample-lab-report-meera.png}"

chrome="${CHROME:-}"
if [ -z "$chrome" ]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$c" >/dev/null 2>&1 || [ -x "$c" ]; then chrome="$c"; break; fi
  done
fi
[ -n "$chrome" ] || { echo "Chrome not found; set CHROME=/path/to/chrome" >&2; exit 1; }

profile="$(mktemp -d)"
tmp="$profile/report.png"
trap 'pkill -f -- "--user-data-dir=$profile" 2>/dev/null || true; rm -rf "$profile"' EXIT
"$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --no-first-run --no-default-browser-check --use-mock-keychain --password-store=basic \
  --user-data-dir="$profile" --window-size=800,560 \
  --screenshot="$tmp" "file://$src" >/dev/null 2>&1 &
pid=$!
# Some Chrome builds stay open after writing the screenshot, so stop once it's there
for _ in $(seq 1 300); do
  if [ -s "$tmp" ] || ! kill -0 "$pid" 2>/dev/null; then break; fi
  sleep 0.1
done
sleep 0.5
kill "$pid" 2>/dev/null || true
wait "$pid" 2>/dev/null || true
[ -s "$tmp" ] || { echo "Chrome did not write the image" >&2; exit 1; }
mv "$tmp" "$out"
echo "Wrote $out"
