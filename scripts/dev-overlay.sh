#!/usr/bin/env bash
# Kurulu Flatpak Marmara'yı temel alıp projedeki arayüz değişikliklerini üstüne uygular.
# LibreWolf'u kurmadan, ham arşiv indirmeden deneme yapmak içindir.
#
# Kullanım:   ./scripts/dev-overlay.sh            # ~/marmara-dev oluşturur
#             ./scripts/dev-overlay.sh /baska/yol
# Hata ayıklama: NO_ICONS=1 ./scripts/dev-overlay.sh   (simgeleri atlar)
#               NO_CSS=1 ./scripts/dev-overlay.sh     (tema CSS'lerini atlar)
# Çalıştırma: ./scripts/dev-run.sh   (Flatpak sandbox'ı içinde, temiz profille)
#
# Üstüne yazılanlar: theme/browser/*.css, theme/global/tokens.css, panels/*, startpage/*, modules/*.sys.mjs
# (ve scripts/patch_omni.py'deki MODULES kayıtları), l10n/*/marmara.ftl
# ve Adwaita simgeleri (scripts/adwaita_icons.py). scripts/patch_omni.py'deki kod
# yamaları (JS düzenlemeleri) buraya DAHİL DEĞİLDİR; onlar tam derlemede uygulanır.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP=io.github.fuzuliorg.Marmara
DEST="${1:-$HOME/marmara-dev}"

if [ -n "${MARMARA_BASE:-}" ]; then
  SRC="$MARMARA_BASE"   # sınama için: Flatpak yerine verilen klasör
else
  LOC="$(flatpak info --show-location "$APP" 2>/dev/null)" || { echo "HATA: $APP Flatpak olarak kurulu değil." >&2; exit 1; }
  SRC="$LOC/files/lib/marmara"
fi
[ -x "$SRC/marmara" ] || { echo "HATA: $SRC içinde marmara bulunamadı." >&2; exit 1; }

for tool in python3 unzip zip; do
  command -v "$tool" >/dev/null || { echo "HATA: '$tool' gerekli (sudo pacman -S --needed python unzip zip)" >&2; exit 1; }
done

echo "==> Flatpak kopyalanıyor: $SRC -> $DEST"
rm -rf "$DEST"
cp -a "$SRC" "$DEST"
chmod -R u+w "$DEST"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unpack() { mkdir -p "$2"; unzip -qo "$1" -d "$2" >/dev/null 2>&1 || [ $? -le 2 ]; }
pack() { rm -f "$2"; (cd "$1" && zip -qr9XD "$2" .); }

echo "==> omni.ja açılıyor"
unpack "$DEST/browser/omni.ja" "$TMP/b"
unpack "$DEST/omni.ja" "$TMP/g"

echo "==> Değişiklikler uygulanıyor"
SKIN="$TMP/b/chrome/browser/skin/classic/browser/marmara"
[ -d "$SKIN" ] || { echo "HATA: bu Flatpak Marmara'nın temasını içermiyor." >&2; exit 1; }
[ -n "${NO_CSS:-}" ] || cp "$ROOT"/theme/browser/*.css "$SKIN/"
# Ortak renk paleti (vurgu rengi kuralları da burada)
[ -n "${NO_CSS:-}" ] || cp "$ROOT/theme/global/tokens.css" "$TMP/g/chrome/toolkit/skin/classic/global/marmara/tokens.css"
rm -rf "$TMP/b/chrome/browser/content/browser/marmara-panels"
cp -r "$ROOT/panels" "$TMP/b/chrome/browser/content/browser/marmara-panels"
if [ -d "$TMP/b/chrome/browser/content/browser/marmara" ]; then
  rm -rf "$TMP/b/chrome/browser/content/browser/marmara"
  cp -r "$ROOT/startpage" "$TMP/b/chrome/browser/content/browser/marmara"
fi
cp "$ROOT"/modules/*.sys.mjs "$TMP/b/modules/"
for lang in tr en-US; do
  f="$TMP/b/localization/$lang/browser/marmara.ftl"
  [ -f "$f" ] && cp "$ROOT/l10n/$lang/marmara.ftl" "$f"
done
python3 -I "$ROOT/scripts/dev-patches.py" "$TMP/b" "$TMP/g"
[ -n "${NO_ICONS:-}" ] || python3 -I - "$ROOT" "$TMP/b" "$TMP/g" <<'PY'
import importlib.util, pathlib, sys
root, browser, gre = sys.argv[1:4]
spec = importlib.util.spec_from_file_location("adwaita_icons", pathlib.Path(root) / "scripts" / "adwaita_icons.py")
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
done, missing = mod.apply(pathlib.Path(browser), pathlib.Path(gre))
print(f"  simgeler: {done} Adwaita simgesi" + (f", {len(missing)} atlandı" if missing else ""))
PY

echo "==> omni.ja yeniden paketleniyor"
pack "$TMP/b" "$DEST/browser/omni.ja"
pack "$TMP/g" "$DEST/omni.ja"

# Başlangıç önbelleği eski içeriği tutmasın
rm -rf "$DEST/browser/startupCache" 2>/dev/null || true

echo
echo "Hazır. Çalıştırmak için:"
echo "  ./scripts/dev-run.sh"
