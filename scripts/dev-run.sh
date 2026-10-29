#!/usr/bin/env bash
# ~/marmara-dev'i Flatpak'ın kendi ortamında (sandbox) çalıştırır; ana makinenin
# kitaplıkları/teması karışmaz. Temiz profil her seferinde sıfırlanır.
#   ./scripts/dev-run.sh            # yeni profil
#   ./scripts/dev-run.sh --keep     # önceki dev profili korunur
set -euo pipefail
APP=io.github.fuzuliorg.Marmara
DEST="${MARMARA_DEV:-$HOME/marmara-dev}"
[ -x "$DEST/marmara" ] || { echo "Önce ./scripts/dev-overlay.sh çalıştır." >&2; exit 1; }
[ "${1:-}" = "--keep" ] || rm -rf "$DEST/profile"
mkdir -p "$DEST/profile" "$HOME/.cache/tmp"
exec flatpak run --filesystem="$DEST" --env=TMPDIR="$HOME/.cache/tmp" \
  --command="$DEST/marmara" "$APP" --profile "$DEST/profile" --no-remote
