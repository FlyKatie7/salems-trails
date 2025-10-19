#!/usr/bin/env bash
set -euo pipefail
ZIP="${1:-}"
if [[ -z "$ZIP" || ! -f "$ZIP" ]]; then
  echo "Usage: scripts/sync-from-rosebud.sh /path/to/rosebud.zip"
  exit 1
fi
TMP="$(mktemp -d)"
unzip -q "$ZIP" -d "$TMP"
rsync -av --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude ".DS_Store" \
  "$TMP"/ ./
git status
echo "✅ Synced files from $ZIP. Next:"
echo "   git checkout -b rosebud/$(date +%Y%m%d-%H%M)"
echo "   git add -A && git commit -m 'Rosebud sync' && git push -u origin HEAD"
