#!/usr/bin/env bash
# Package the ANVIX Chrome extension into a store-ready zip.
# Usage: bash scripts/build-extension.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/anvix-scanner-v1.0.0.zip"

rm -f "$OUT"
cd "$ROOT/extension"

# Include only production files; exclude source-map, listing docs, submission notes.
nix run nixpkgs#zip -- -r "$OUT" . \
  -x "SUBMISSION.md" \
  -x "store-listing.md" \
  -x "store-assets/*" \
  -x "*.map"

echo "Wrote $OUT"
