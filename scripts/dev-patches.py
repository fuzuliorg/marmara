#!/usr/bin/env python3
"""dev-overlay.sh için: Flatpak'taki hazır omni.ja'ya sonradan eklenen KOD yamaları.

Her yama tekrar çalıştırılabilir (zaten uygulanmışsa dokunmaz). Tam derlemede
aynı değişiklikler scripts/patch_omni.py içinde yapılır; bu dosya yalnızca
hızlı deneme içindir.
Kullanım: python3 -I dev-patches.py <browser-omni-klasörü> <gre-omni-klasörü>
"""
import pathlib
import sys

browser = pathlib.Path(sys.argv[1])
PANELS_URL = "chrome://browser/content/marmara-panels/"


def patch(path, old, new, marker):
    text = path.read_text(encoding="utf-8")
    if marker in text:
        return "zaten var"
    if old not in text:
        return "UYARI: yer bulunamadı"
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    return "uygulandı"


sidebar = browser / "chrome/browser/content/browser/sidebar/browser-sidebar.js"
print("  indirilenler yan paneli:", patch(
    sidebar,
    '      [\n        "viewBookmarksSidebar",',
    f'''      [
        "viewDownloadsSidebar",
        this.makeSidebar({{
          name: "downloads",
          elementId: "sidebar-switcher-downloads",
          url: "{PANELS_URL}downloads.html",
          menuId: "menu_downloadsSidebar",
          menuL10nId: "menu-view-history-button",
          revampL10nId: "sidebar-menu-history-label",
          iconUrl: "chrome://browser/skin/downloads/downloads.svg",
        }}),
      ],
      [
        "viewBookmarksSidebar",''',
    '"viewDownloadsSidebar"',
))

commands = browser / "chrome/browser/content/browser/browser-commands.js"
text = commands.read_text(encoding="utf-8")
if 'toggle("viewDownloadsSidebar")' in text:
    print("  indirilenler komutu: zaten var")
else:
    old = '''        ChromeUtils.importESModule(
          "resource:///modules/MarmaraSettings.sys.mjs"
        ).MarmaraSettings.showDownloads(window);'''
    plain = '''    } else {
      PlacesCommandHook.showPlacesOrganizer("Downloads");
    }'''
    new_body = 'window.SidebarController.toggle("viewDownloadsSidebar");'
    if old in text:
        commands.write_text(text.replace(old, "        " + new_body, 1), encoding="utf-8")
        print("  indirilenler komutu: uygulandı")
    elif plain in text:
        commands.write_text(text.replace(plain, f'''    }} else {{
      try {{
        {new_body}
      }} catch (e) {{
        console.error("Marmara indirilenler:", e);
        PlacesCommandHook.showPlacesOrganizer("Downloads");
      }}
    }}''', 1), encoding="utf-8")
        print("  indirilenler komutu: uygulandı")
    else:
        print("  indirilenler komutu: UYARI: yer bulunamadı")

downloads = browser / "chrome/browser/content/browser/downloads/downloads.js"
print("  indirme başlayınca yan panel:", patch(
    downloads,
    "  showPanel(openedManually = false, isKeyPress = false) {\n",
    """  showPanel(openedManually = false, isKeyPress = false) {
    try {
      if (PrivateBrowsingUtils.isWindowPrivate(window)) {
        BrowserCommands.downloadsUI();
      } else {
        window.SidebarController.show("viewDownloadsSidebar");
      }
      return;
    } catch (e) {
      console.error("Marmara indirilenler:", e);
    }
""",
    'show("viewDownloadsSidebar")',
))
