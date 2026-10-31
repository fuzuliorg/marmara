#!/usr/bin/env bash
# Marmara'nın Linux arşivinden (ya da dist/marmara klasöründen) tek dosyalık AppImage üretir.
#
#   packaging/appimage/build-appimage.sh dist/marmara-1.0.20-linux-x86_64.tar.xz
#   packaging/appimage/build-appimage.sh dist/marmara            # build.sh çıktısı
#
# Sürüm: MARMARA_VERSION ortam değişkeni, yoksa VERSION dosyası.
# Sonuç: dist/Marmara-<sürüm>-x86_64.AppImage (+ varsa .zsync). Gereken: bash, tar, xz,
# curl. appimagetool yoksa GitHub'dan indirilir (FUSE gerekmez). AppImage, sistemin GTK3
# ve temel kitaplıklarını kullanır (Firefox/LibreWolf'un resmi arşivi gibi).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="${1:?Kullanım: $0 <marmara-linux-x86_64.tar.xz | marmara klasörü>}"
OUTDIR="$ROOT/dist"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$OUTDIR"

APPDIR="$WORK/Marmara.AppDir"
mkdir -p "$APPDIR/usr/lib" "$APPDIR/usr/share/metainfo"

if [ -d "$SRC" ]; then
  cp -a "$SRC" "$APPDIR/usr/lib/marmara"
else
  tar -xf "$SRC" -C "$WORK"                      # arşivin içinde "marmara/" klasörü var
  mv "$WORK/marmara" "$APPDIR/usr/lib/marmara"
fi
BIN="$APPDIR/usr/lib/marmara"
[ -x "$BIN/marmara" ] && [ -f "$BIN/browser/application.ini" ] || { echo "Beklenen Marmara dosyaları yok: $BIN" >&2; exit 1; }

VERSION="${MARMARA_VERSION:-$(cat "$ROOT/VERSION")}"   # CI release sürümünü verir
APPID="io.github.fuzuliorg.Marmara"

# Başlatıcı: Marmara'nın kendi "marmara" betiği profili (~/.marmara) ve pencere sınıfını ayarlar
cat > "$APPDIR/AppRun" <<'RUN'
#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
exec "$HERE/usr/lib/marmara/marmara" "$@"
RUN
chmod 755 "$APPDIR/AppRun"

# Masaüstü girdisi ve simge (AppImage kökünde olmalı)
sed -e 's|^Name=Marmara$|Name=Marmara Browser|' \
    -e '/^Name=Marmara Browser$/a Name[tr]=Marmara Tarayıcı' \
    "$ROOT/packaging/linux/marmara.desktop" > "$APPDIR/$APPID.desktop"
sed -i 's|^Icon=.*|Icon=marmara|' "$APPDIR/$APPID.desktop"
install -Dm644 "$ROOT/branding/marmara-icon.svg" "$APPDIR/marmara.svg"
install -Dm644 "$ROOT/branding/icons/icon256.png" "$APPDIR/marmara.png"
ln -sf marmara.png "$APPDIR/.DirIcon"
install -Dm644 "$ROOT/flatpak/$APPID.metainfo.xml" "$APPDIR/usr/share/metainfo/$APPID.appdata.xml"

# appimagetool
TOOL="${APPIMAGETOOL:-$(command -v appimagetool || true)}"
if [ -z "$TOOL" ]; then
  TOOL="$WORK/appimagetool"
  curl -fL --retry 3 -o "$TOOL" \
    "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"
  chmod +x "$TOOL"
fi

OUT="$OUTDIR/Marmara-$VERSION-x86_64.AppImage"
rm -f "$OUT" "$OUT.zsync"
# Güncelleme bilgisi: AppImageUpdate gibi araçlar en son release'i izler
ARCH=x86_64 "$TOOL" --appimage-extract-and-run --no-appstream \
  -u "gh-releases-zsync|fuzuliorg|marmara|latest|Marmara-*-x86_64.AppImage.zsync" \
  "$APPDIR" "$OUT"
chmod +x "$OUT"
echo "  $OUT"
