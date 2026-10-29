#!/usr/bin/env python3
"""branding/marmara.svg dosyasından tüm PNG simgelerini üretir.

Kullanım: python3 scripts/render-icons.py

Sistemde rsvg-convert varsa onu (Arch: librsvg paketi), yoksa Playwright
ile Chromium'u kullanır. Üretilen dosyalar branding/icons/ altına yazılır ve
repoya eklenir, yani derleme sırasında bu betiğe gerek yoktur. Yalnızca logo
değiştiğinde çalıştırın.
"""
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SVG = ROOT / "branding" / "marmara.svg"
# Uygulama simgeleri için daha dar kadraj: simge kendi alanını doldurur, kenar boşluğu azdır.
SVG_ICON = ROOT / "branding" / "marmara-icon.svg"
OUT = ROOT / "branding" / "icons"

# ad -> (genişlik, yükseklik). Kare olmayanlarda logo ortalanır.
SIZES = {
    "icon16.png": (16, 16),
    "icon32.png": (32, 32),
    "icon48.png": (48, 48),
    "icon64.png": (64, 64),
    "icon128.png": (128, 128),
    "icon256.png": (256, 256),
    "icon512.png": (512, 512),
    "about-logo.png": (192, 192),
    "about-logo@2x.png": (384, 384),
    "about.png": (300, 236),
}


def render_rsvg(svg: pathlib.Path, out: pathlib.Path, w: int, h: int) -> None:
    side = min(w, h)
    tmp = out.with_suffix(".tmp.png")
    subprocess.run(["rsvg-convert", "-w", str(side), "-h", str(side), "-o", str(tmp), str(svg)], check=True)
    if (w, h) == (side, side):
        tmp.rename(out)
        return
    # Kare olmayan tuval: ImageMagick ile ortala
    subprocess.run(["magick", str(tmp), "-background", "none", "-gravity", "center",
                    "-extent", f"{w}x{h}", str(out)], check=True)
    tmp.unlink()


def render_playwright(svg: pathlib.Path, jobs: dict) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for name, (w, h) in jobs.items():
            data = (SVG_ICON if name.startswith("icon") else svg).read_text()
            side = min(w, h)
            page.set_viewport_size({"width": w, "height": h})
            page.set_content(
                f"""<html><body style="margin:0;width:{w}px;height:{h}px;display:grid;place-items:center;background:transparent">
                <div style="width:{side}px;height:{side}px">{data.replace('<svg ', f'<svg style="width:{side}px;height:{side}px;display:block" ', 1)}</div>
                </body></html>"""
            )
            page.screenshot(path=str(OUT / name), omit_background=True)
        browser.close()


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    if shutil.which("rsvg-convert") and shutil.which("magick"):
        for name, (w, h) in SIZES.items():
            render_rsvg(SVG_ICON if name.startswith("icon") else SVG, OUT / name, w, h)
    else:
        render_playwright(SVG, SIZES)
    for name in SIZES:
        print("  ", OUT / name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
