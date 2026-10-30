#!/usr/bin/env bash
# Marmara derleme (repack) betiği.
#
# Kullanım:
#   ./build.sh                       # kurulu LibreWolf'tan (/usr/lib/librewolf)
#   ./build.sh librewolf-*.tar.xz    # LibreWolf'un resmi Linux arşivinden
#   ./build.sh librewolf-*.zip       # LibreWolf'un resmi Windows arşivinden (Windows paketi üretir)
#   ./build.sh /yol/librewolf        # başka bir LibreWolf klasöründen
#
# Seçenekler:
#   --offline    Eklenti kimliklerini addons.mozilla.org'dan doğrulama
#   --tarball    Sonuçtan ayrıca arşiv üret: Linux'ta dist/marmara-<sürüm>-linux-x86_64.tar.xz,
#                Windows'ta dist/marmara-<sürüm>-windows-x86_64.zip
#   --debug-tabs Sekme çubuğundaki kutuları renklendirir (boşluk teşhisi için)
#
# Çıktı: dist/marmara/  →  Linux'ta ./dist/marmara/marmara, Windows'ta marmara.exe
#        ile doğrudan çalıştırılabilir.
# Derleme yapılmaz; LibreWolf'un hazır dosyaları değiştirilip yeniden paketlenir.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$ROOT/build"
OUT="$ROOT/dist/marmara"

SRC="/usr/lib/librewolf"
OFFLINE=""
TARBALL=0
for arg in "$@"; do
  case "$arg" in
    --offline) OFFLINE="--offline" ;;
    --tarball) TARBALL=1 ;;
    --debug-tabs) export MARMARA_DEBUG_TABS=1 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) SRC="$arg" ;;
  esac
done

step() { printf '\n\033[1;34m==>\033[0m \033[1m%s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mHATA:\033[0m %s\n' "$*" >&2; exit 1; }

for tool in python3 unzip zip; do
  command -v "$tool" >/dev/null || die "'$tool' bulunamadı. Arch: sudo pacman -S --needed python unzip zip"
done

ini_get() {  # ini_get <dosya> <anahtar>
  sed -n "s/^$2=//p" "$1" | head -n1
}

unpack_omni() {  # unpack_omni <omni.ja> <hedef-klasör>
  rm -rf "$2"; mkdir -p "$2"
  # Firefox'un omni.ja'sı "optimize edilmiş" zip'tir; unzip uyarı verir (çıkış 1-2) ama doğru açar.
  local rc=0
  unzip -qo "$1" -d "$2" >/dev/null 2>&1 || rc=$?
  [ "$rc" -le 2 ] || die "$1 açılamadı (unzip çıkış kodu $rc)"
  [ -f "$2/chrome.manifest" ] || die "$1 beklenen içeriği taşımıyor"
}

pack_omni() {  # pack_omni <klasör> <omni.ja>
  rm -f "$2"
  # Sıkıştırılmış (deflate): LibreWolf sıkıştırmasız paketliyor ve ~170 MB fazla yer
  # kaplıyor. Açılışa etkisi ölçülemeyecek kadar küçük.
  (cd "$1" && zip -qr9XD "$2" .)
}

# ---------------------------------------------------------------------------
step "Kaynak hazırlanıyor: $SRC"
rm -rf "$WORK" "$OUT"
mkdir -p "$WORK" "$(dirname "$OUT")"

PLATFORM=linux
if [ -f "$SRC" ]; then
  mkdir -p "$WORK/src"
  case "$SRC" in
    *.zip)
      unzip -q "$SRC" -d "$WORK/src"
      SRC_DIR="$(dirname "$(find "$WORK/src" -maxdepth 3 -type f -name librewolf.exe | head -n1)")"
      [ -n "$SRC_DIR" ] && [ "$SRC_DIR" != "." ] || die "arşivde 'librewolf.exe' bulunamadı"
      ;;
    *)
      tar -xf "$SRC" -C "$WORK/src"
      SRC_DIR="$(dirname "$(find "$WORK/src" -maxdepth 3 -type f -name librewolf -perm -u+x | head -n1)")"
      [ -n "$SRC_DIR" ] && [ "$SRC_DIR" != "." ] || die "arşivde 'librewolf' çalıştırılabilir dosyası bulunamadı"
      ;;
  esac
elif [ -d "$SRC" ]; then
  SRC_DIR="$SRC"
else
  die "kaynak bulunamadı: $SRC (LibreWolf kurulu mu? sudo pacman -S librewolf)"
fi
[ -f "$SRC_DIR/librewolf.exe" ] && PLATFORM=windows
echo "  Platform: $PLATFORM"
[ -f "$SRC_DIR/browser/omni.ja" ] && [ -f "$SRC_DIR/omni.ja" ] || die "$SRC_DIR bir LibreWolf kurulumu gibi görünmüyor"

cp -a "$SRC_DIR" "$OUT"
chmod -R u+w "$OUT"

VERSION="$(ini_get "$OUT/application.ini" Version)"
SOURCESTAMP="$(ini_get "$OUT/application.ini" SourceStamp)"
TESTED="$(cat "$ROOT/LIBREWOLF_VERSION")"
echo "  LibreWolf sürümü: $VERSION (tema en son $TESTED ile denendi)"
[ "$VERSION" = "$TESTED" ] || echo "  ! Sürüm farklı. Tema kontrolünün sonucuna dikkat edin."

# ---------------------------------------------------------------------------
step "Dosya adları değiştiriliyor"
if [ "$PLATFORM" = windows ]; then
  mv "$OUT/librewolf.exe" "$OUT/marmara-bin.exe"
  rm -f "$OUT/librewolf.cfg" "$OUT/application.ini"
  # LibreWolf'a bağlı yardımcılar ve Başlat menüsü kutucukları: Marmara'da işe yaramaz
  rm -rf "$OUT/private_browsing.exe" "$OUT/uninstall" "$OUT/desktop-launcher" \
         "$OUT"/*.VisualElementsManifest.xml "$OUT/browser/VisualElements"
  echo "  librewolf.exe → marmara-bin.exe"
else
  mv "$OUT/librewolf" "$OUT/marmara-bin"
  rm -f "$OUT/librewolf-bin" "$OUT/librewolf.cfg" "$OUT/application.ini"
  echo "  librewolf → marmara-bin"
fi

# ---------------------------------------------------------------------------
step "omni.ja dosyaları açılıyor"
unpack_omni "$OUT/browser/omni.ja" "$WORK/omni-browser"
unpack_omni "$OUT/omni.ja" "$WORK/omni-gre"
echo "  tamam"

step "Yamalar uygulanıyor"
python3 -I "$ROOT/scripts/patch_omni.py" --browser "$WORK/omni-browser" --gre "$WORK/omni-gre"

step "Tema bu sürüme karşı kontrol ediliyor"
python3 -I "$ROOT/scripts/check_theme.py" --browser "$WORK/omni-browser" --gre "$WORK/omni-gre"

step "omni.ja dosyaları paketleniyor"
pack_omni "$WORK/omni-browser" "$OUT/browser/omni.ja"
pack_omni "$WORK/omni-gre" "$OUT/omni.ja"
echo "  tamam"

# ---------------------------------------------------------------------------
step "Ayarlar ve politikalar"
{
  echo "// İlk satır Firefox tarafından atlanır"
  tail -n +2 "$SRC_DIR/librewolf.cfg"
  cat "$ROOT/config/marmara-prefs.js"
} > "$OUT/marmara.cfg"
echo "  marmara.cfg (LibreWolf ayarları + Marmara eklemeleri)"

python3 -I "$ROOT/scripts/make_policies.py" "$OUT/distribution/policies.json" $OFFLINE
cp "$ROOT/config/distribution.ini" "$OUT/distribution/distribution.ini"

BUILDID="$(date -u +%Y%m%d%H%M%S)"
sed -e "s/@VERSION@/$VERSION/g" -e "s/@BUILDID@/$BUILDID/g" -e "s/@SOURCESTAMP@/$SOURCESTAMP/g" \
  "$ROOT/config/application.ini.in" > "$OUT/browser/application.ini"
echo "  browser/application.ini (BuildID $BUILDID)"

# ---------------------------------------------------------------------------
step "Simgeler ve başlatıcı"
if [ -d "$OUT/browser/chrome/icons/default" ]; then
  for s in 16 32 48 64 128; do
    cp "$ROOT/branding/icons/icon$s.png" "$OUT/browser/chrome/icons/default/default$s.png"
  done
fi
install -Dm644 "$ROOT/branding/marmara-icon.svg" "$OUT/marmara.svg"
# Lisans metinleri (MPL-2.0, Adwaita simgeleri) uygulama paketinin içinde, licenses/ klasöründe
mkdir -p "$OUT/licenses"
cp "$ROOT"/licenses/* "$OUT/licenses/"
cp "$ROOT/branding/adwaita-icons/NOTICE.md" "$OUT/licenses/Adwaita-icons-NOTICE.md"
cp "$ROOT/branding/adwaita-icons/AUTHORS" "$OUT/licenses/Adwaita-icons-AUTHORS"
if [ "$PLATFORM" = windows ]; then
  MINGW="x86_64-w64-mingw32"
  for tool in "$MINGW-gcc" "$MINGW-windres"; do
    command -v "$tool" >/dev/null || die "'$tool' bulunamadı. Debian/Ubuntu: sudo apt install gcc-mingw-w64-x86-64"
  done
  mkdir -p "$WORK/launcher"
  python3 -I "$ROOT/scripts/make_ico.py" "$WORK/launcher/marmara.ico" \
    "$ROOT"/branding/icons/icon{16,32,48,64,128,256}.png
  cp "$ROOT/packaging/windows/marmara.rc" "$ROOT/packaging/windows/launcher.c" "$WORK/launcher/"
  # marmara-bin.exe'nin kendi (LibreWolf) simgesini değiştirmek için: Windows'ta CI
  # rcedit ile gömer ve bu dosyayı siler
  cp "$WORK/launcher/marmara.ico" "$OUT/marmara.ico"
  (cd "$WORK/launcher" &&
    "$MINGW-windres" marmara.rc -O coff -o marmara-res.o &&
    "$MINGW-gcc" -Os -municode -mwindows -o "$OUT/marmara.exe" launcher.c marmara-res.o -static -s)
  [ -f "$OUT/marmara.exe" ] || die "marmara.exe derlenemedi"
  echo "  marmara.exe (başlatıcı)"
else
  install -Dm755 "$ROOT/packaging/linux/marmara" "$OUT/marmara"
  install -Dm644 "$ROOT/packaging/linux/marmara.desktop" "$OUT/marmara.desktop"
fi
echo "  tamam"

# ---------------------------------------------------------------------------
step "Marka kontrolü"
LEFT="$(cd "$WORK" && grep -rIl "LibreWolf" omni-browser/localization omni-gre/localization \
         omni-browser/chrome omni-gre/chrome 2>/dev/null || true)"
if [ -z "$LEFT" ]; then
  echo "  arayüz metinlerinde 'LibreWolf' kalmadı ✓"
else
  echo "  hâlâ 'LibreWolf' geçen dosyalar (görünmeyen yerler olabilir):"
  echo "$LEFT" | sed 's/^/    /'
fi

if [ "$TARBALL" = 1 ]; then
  step "Arşiv oluşturuluyor"
  if [ "$PLATFORM" = windows ]; then
    rm -f "$ROOT/dist/marmara-$VERSION-windows-x86_64.zip"
    (cd "$(dirname "$OUT")" && zip -qr9 "$ROOT/dist/marmara-$VERSION-windows-x86_64.zip" marmara)
    echo "  dist/marmara-$VERSION-windows-x86_64.zip"
  else
    tar -C "$(dirname "$OUT")" -cJf "$ROOT/dist/marmara-$VERSION-linux-x86_64.tar.xz" marmara
    echo "  dist/marmara-$VERSION-linux-x86_64.tar.xz"
  fi
fi

rm -rf "$WORK"
step "Bitti"
if [ "$PLATFORM" = windows ]; then
  echo "  Çalıştırmak için:        $OUT/marmara.exe (Windows'ta)"
else
  echo "  Çalıştırmak için:        $OUT/marmara"
  echo "  Menüye eklemek için:     $ROOT/scripts/install-local.sh"
fi
