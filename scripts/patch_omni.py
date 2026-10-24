#!/usr/bin/env python3
"""Açılmış omni.ja klasörlerine Marmara yamalarını uygular.

Kullanım:
  python3 scripts/patch_omni.py --browser <browser-omni-klasörü> --gre <gre-omni-klasörü>

Her adım ne yaptığını yazar. Beklenen bir dosya ya da metin bulunamazsa
"HATA" ile durur: bu, yeni bir LibreWolf sürümünde bir şeyin değiştiği
anlamına gelir ve sessizce yarım bir paket üretmekten iyidir.
"""
from __future__ import annotations

import argparse
import os
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BRANDING = ROOT / "branding"
THEME = ROOT / "theme"
CONFIG = ROOT / "config"

OLD_NAME = "LibreWolf"
NEW_NAME = "Marmara"

MARKER = "/* marmara-patch */"


class PatchError(Exception):
    pass


def log(msg: str) -> None:
    print(f"  • {msg}")


def need(path: pathlib.Path) -> pathlib.Path:
    if not path.exists():
        raise PatchError(f"beklenen dosya yok: {path}")
    return path


def replace_once(path: pathlib.Path, old: str, new: str, *, count_expected: int | None = 1) -> None:
    text = need(path).read_text(encoding="utf-8")
    n = text.count(old)
    if count_expected is not None and n != count_expected:
        raise PatchError(f"{path.name}: '{old[:60]}' metni {count_expected} kez bekleniyordu, {n} kez bulundu")
    path.write_text(text.replace(old, new), encoding="utf-8")


# ---------------------------------------------------------------------------
# Marka
# ---------------------------------------------------------------------------

TEXT_SUFFIXES = {".ftl", ".properties", ".dtd", ".xhtml", ".html", ".js", ".mjs", ".json", ".css"}


def patch_brand_files(browser: pathlib.Path) -> None:
    ftl = list(browser.glob("localization/*/branding/brand.ftl"))
    dtd = list(browser.glob("chrome/*/locale/branding/brand.dtd"))
    props = list(browser.glob("chrome/*/locale/branding/brand.properties"))
    if not ftl or not dtd or not props:
        raise PatchError("marka dosyaları (brand.ftl / brand.dtd / brand.properties) bulunamadı")
    for files, src in ((ftl, "brand.ftl"), (dtd, "brand.dtd"), (props, "brand.properties")):
        for f in files:
            shutil.copyfile(BRANDING / src, f)
    log(f"marka adı: {len(ftl)} dil için brand.ftl, {len(dtd)} dil için brand.dtd/properties")


def replace_name_in_tree(base: pathlib.Path, globs: list[str]) -> int:
    """Görünen metinlerde LibreWolf -> Marmara. Küçük harfli 'librewolf'
    (adresler, ayar adları) bilerek değiştirilmez."""
    changed = 0
    for pattern in globs:
        for f in base.glob(pattern):
            if not f.is_file() or f.suffix not in TEXT_SUFFIXES:
                continue
            try:
                text = f.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            if OLD_NAME in text:
                f.write_text(text.replace(OLD_NAME, NEW_NAME), encoding="utf-8")
                changed += 1
    return changed


def patch_brand_strings(browser: pathlib.Path, gre: pathlib.Path) -> None:
    n = replace_name_in_tree(browser, ["localization/**/*", "chrome/*/locale/**/*",
                                       "chrome/browser/content/browser/aboutDialog.xhtml"])
    n += replace_name_in_tree(gre, ["localization/**/*", "chrome/*/locale/**/*",
                                    "moz-src/**/*.mjs", "modules/AppConstants.sys.mjs"])
    log(f"metinlerde '{OLD_NAME}' → '{NEW_NAME}': {n} dosya")

    consts = need(gre / "modules/AppConstants.sys.mjs")
    text = consts.read_text(encoding="utf-8")
    text, k = re.subn(r'MOZ_APP_NAME: "librewolf"', 'MOZ_APP_NAME: "marmara"', text)
    if k != 1:
        raise PatchError("AppConstants.sys.mjs içinde MOZ_APP_NAME bulunamadı")
    consts.write_text(text, encoding="utf-8")
    log("AppConstants: MOZ_APP_NAME = marmara")


def patch_brand_images(browser: pathlib.Path) -> None:
    dst = need(browser / "chrome/browser/content/branding")
    icons = BRANDING / "icons"
    mapping = {
        "icon16.png": "icon16.png", "icon32.png": "icon32.png", "icon48.png": "icon48.png",
        "icon64.png": "icon64.png", "icon128.png": "icon128.png",
        "about-logo.png": "about-logo.png", "about-logo@2x.png": "about-logo@2x.png",
        "about-logo-private.png": "about-logo.png", "about-logo-private@2x.png": "about-logo@2x.png",
        "about.png": "about.png",
    }
    for target, src in mapping.items():
        shutil.copyfile(icons / src, dst / target)
    shutil.copyfile(BRANDING / "marmara.svg", dst / "about-logo.svg")
    for wm in ("about-wordmark.svg", "firefox-wordmark.svg"):
        shutil.copyfile(BRANDING / "wordmark.svg", dst / wm)
    log(f"marka görselleri: {len(mapping) + 3} dosya")

    pane_icon = browser / "chrome/browser/skin/classic/browser/preferences/category-librewolf.svg"
    if pane_icon.exists():
        shutil.copyfile(BRANDING / "settings-symbolic.svg", pane_icon)
        log("ayarlar: LibreWolf bölüm simgesi değiştirildi")


def patch_about_dialog(browser: pathlib.Path) -> None:
    css = need(browser / "chrome/browser/content/browser/aboutDialog.css")
    text = css.read_text(encoding="utf-8")
    if MARKER in text:
        return
    text, k = re.subn(r'background-image:\s*url\("data:image/svg\+xml;base64,[^"]+"\);',
                      'background-image: url("chrome://branding/content/about-logo.svg");', text)
    if k != 1:
        raise PatchError("aboutDialog.css: gömülü logo bulunamadı")
    text = text.replace("border-bottom: #00acff 2px solid;", "border-bottom: none;")
    text = text.replace("color: #00acff;", "color: AccentColor;")
    css.write_text(MARKER + "\n" + text, encoding="utf-8")
    log("Hakkında penceresi: logo ve renkler")


# ---------------------------------------------------------------------------
# Tema
# ---------------------------------------------------------------------------

def install_theme(browser: pathlib.Path, gre: pathlib.Path) -> None:
    # Genel token'lar: chrome://global/skin/marmara/
    gdst = gre / "chrome/toolkit/skin/classic/global/marmara"
    shutil.rmtree(gdst, ignore_errors=True)
    shutil.copytree(THEME / "global", gdst)

    shared = need(gre / "chrome/toolkit/skin/classic/global/design-system/tokens-shared.css")
    text = shared.read_text(encoding="utf-8")
    if MARKER not in text:
        # @import, @layer bildiriminden önce gelebilir; dosyanın en başına koyuyoruz.
        imp = f'{MARKER}\n@import url("chrome://global/skin/marmara/tokens.css");\n'
        shared.write_text(imp + text, encoding="utf-8")
    log("tema: genel token'lar tokens-shared.css'e bağlandı")

    # Tarayıcı penceresi: chrome://browser/skin/marmara/
    bdst = browser / "chrome/browser/skin/classic/browser/marmara"
    shutil.rmtree(bdst, ignore_errors=True)
    shutil.copytree(THEME / "browser", bdst)
    if os.environ.get("MARMARA_DEBUG_TABS") == "1":
        shutil.copyfile(THEME / "debug" / "tabs-debug.css", bdst / "tabs-debug.css")
        with open(bdst / "marmara.css", "a", encoding="utf-8") as f:
            f.write('\n@import url("chrome://browser/skin/marmara/tabs-debug.css");\n')
        log("TEŞHİS: sekme çubuğu renkli kutularla boyanıyor")

    shutil.copyfile(THEME / "preferences" / "preferences.css", bdst / "preferences.css")
    shutil.copyfile(THEME / "preferences" / "adwaita.css", bdst / "preferences-adwaita.css")

    xhtml = need(browser / "chrome/browser/content/browser/browser.xhtml")
    text = xhtml.read_text(encoding="utf-8")
    if "chrome://browser/skin/marmara/marmara.css" not in text:
        anchor = '  <link rel="localization" href="branding/brand.ftl"/>'
        if text.count(anchor) != 1:
            raise PatchError("browser.xhtml: stil dosyalarının bittiği yer bulunamadı")
        link = '  <link rel="stylesheet" href="chrome://browser/skin/marmara/marmara.css" />\n\n'
        xhtml.write_text(text.replace(anchor, link + anchor), encoding="utf-8")
    log("tema: marmara.css browser.xhtml'e eklendi")

    prefs = need(browser / "chrome/browser/content/browser/preferences/preferences.xhtml")
    text = prefs.read_text(encoding="utf-8")
    if "chrome://browser/skin/marmara/preferences.css" not in text:
        anchor = '  <link rel="localization" href="branding/brand.ftl"/>'
        if text.count(anchor) != 1:
            raise PatchError("preferences.xhtml: stil dosyalarının bittiği yer bulunamadı")
        link = '  <link rel="stylesheet" href="chrome://browser/skin/marmara/preferences.css" />\n\n'
        prefs.write_text(text.replace(anchor, link + anchor), encoding="utf-8")
    log("ayarlar sayfası: Mozilla bölümleri gizleniyor (preferences.css)")

    # Yardım ve sorun giderme (about:support): menüden kaldırılan "Yardım" yerine
    text = prefs.read_text(encoding="utf-8")
    if 'id="marmaraHelpButton"' not in text:
        anchor = '      <html:moz-page-nav-button id="helpButton"'
        if text.count(anchor) != 1:
            raise PatchError("preferences.xhtml: yardım düğmesi bulunamadı")
        button = ('      <html:moz-page-nav-button id="marmaraHelpButton"\n'
                  '        slot="secondary-nav"\n'
                  '        href="about:support"\n'
                  '        iconsrc="chrome://global/skin/icons/help.svg"\n'
                  '        data-l10n-id="marmara-settings-help">\n'
                  '      </html:moz-page-nav-button>\n')
        prefs.write_text(text.replace(anchor, button + anchor), encoding="utf-8")
    log("ayarlar: Yardım ve sorun giderme (about:support)")


# ---------------------------------------------------------------------------
# GNOME Web davranışları
# ---------------------------------------------------------------------------

def patch_tab_bar_autohide(browser: pathlib.Path) -> None:
    """Tek sekme varken sekme çubuğunu gizle. Firefox bunu açılır pencereler
    için zaten yapıyor; aynı mekanizmaya bir koşul ekliyoruz. Kapatmak için:
    about:config → marmara.tabs.autohide = false"""
    f = browser / "chrome/browser/content/browser/tabbrowser/tab-bar-visibility.js"
    old = ("    let hideTabsToolbar =\n"
           "      (isSingleTabWindow && hasSingleTab) || hasVerticalTabs;\n")
    new = ("    let hideTabsToolbar =\n"
           "      (isSingleTabWindow && hasSingleTab) || hasVerticalTabs ||\n"
           "      (hasSingleTab && Services.prefs.getBoolPref(\"marmara.tabs.autohide\", true)); // marmara\n")
    if "marmara.tabs.autohide" not in need(f).read_text(encoding="utf-8"):
        replace_once(f, old, new)
    log("tek sekmede sekme çubuğu gizleniyor")


def patch_tab_shortcuts(browser: pathlib.Path) -> None:
    """Sekmeler arası geçiş: Linux'ta Firefox Alt+1..9 kullanıyor; Marmara'da
    Ctrl+1..9 (Windows/macOS ve çoğu tarayıcıdaki gibi)."""
    f = need(browser / "chrome/browser/content/browser/browser.xhtml")
    text = f.read_text(encoding="utf-8")
    pattern = r'(<key id="key_select(?:Tab[1-8]|LastTab)" key="[1-9]" modifiers=")alt("/>)'
    text, n = re.subn(pattern, r"\1accel\2", text)
    if n == 0 and 'id="key_selectTab1" key="1" modifiers="accel"' in text:
        log("sekme kısayolları zaten Ctrl+1..9")
        return
    if n != 9:
        raise PatchError(f"browser.xhtml: 9 sekme kısayolu bekleniyordu, {n} bulundu")
    f.write_text(text, encoding="utf-8")
    log("sekme kısayolları: Ctrl+1..9")


# Motor listesine eklenen motorlar (LibreWolf'un listesinde yok). Logoları
# tarayıcıyla zaten geliyor (search-config-icons); yalnızca kayıtları eksik.
EXTRA_ENGINES = [
    {
        "identifier": "google", "name": "Google", "aliases": ["google", "g"],
        "search": "https://www.google.com/search", "param": "q",
        "suggest": ("https://www.google.com/complete/search", [{"name": "client", "value": "firefox"}]),
    },
    {
        "identifier": "bing", "name": "Bing", "aliases": ["bing"],
        "search": "https://www.bing.com/search", "param": "q",
        "suggest": ("https://www.bing.com/osjson.aspx", []), "suggest_param": "query",
    },
    {
        "identifier": "ecosia", "name": "Ecosia", "aliases": ["ecosia"],
        "search": "https://www.ecosia.org/search", "param": "q",
        "suggest": ("https://ac.ecosia.org/autocomplete", [{"name": "type", "value": "list"}]),
    },
]


def set_dump_timestamp(browser: pathlib.Path, collection: str, timestamp: int) -> None:
    """Paketlenmiş uzak ayar (remote settings) dosyasının zaman damgasını duyurur.

    Tarayıcı, profildeki kopyanın paketlenmiş dosyadan eski olup olmadığını
    dosyanın kendi "timestamp" alanına değil defaults/settings/last_modified.json
    içindeki değere bakarak anlıyor. Yalnızca dosyayı değiştirip burayı
    güncellemezsek, tarayıcıyı daha önce çalıştırmış profiller yeni motor
    listesini hiç yüklemez."""
    import json

    path = need(browser / "defaults/settings/last_modified.json")
    stamps = json.loads(path.read_text(encoding="utf-8"))
    if collection not in stamps:
        raise PatchError(f"last_modified.json: {collection} kaydı bulunamadı")
    stamps[collection] = timestamp
    path.write_text(json.dumps(stamps, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def add_extra_engines(browser: pathlib.Path, data: dict) -> None:
    import json
    import time
    import uuid

    now = int(time.time() * 1000)
    icons_dir = need(browser / "defaults/settings/main/search-config-icons")
    icons_json = need(browser / "defaults/settings/main/search-config-icons.json")
    icons = json.loads(icons_json.read_text(encoding="utf-8"))
    metas = [json.loads(m.read_text(encoding="utf-8")) for m in icons_dir.glob("*.meta.json")]

    for e in EXTRA_ENGINES:
        suggest_base, suggest_params = e["suggest"]
        data["data"].append({
            "base": {
                "aliases": e["aliases"],
                "classification": "general",
                "name": e["name"],
                "urls": {
                    "search": {"base": e["search"], "searchTermParamName": e["param"]},
                    "suggestions": {
                        "base": suggest_base,
                        "params": suggest_params,
                        "searchTermParamName": e.get("suggest_param", e["param"]),
                    },
                },
            },
            "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{e['identifier']}.marmara")),
            "identifier": e["identifier"],
            "last_modified": now,
            "recordType": "engine",
            "schema": now,
            "variants": [{"environment": {"allRegionsAndLocales": True}}],
        })
        found = next((m for m in metas if m.get("engineIdentifiers") == [e["identifier"]]), None)
        if not found:
            raise PatchError(f"search-config-icons: {e['name']} logosu bulunamadı")
        if not (icons_dir / found["id"]).exists():
            raise PatchError(f"search-config-icons: {e['name']} logo dosyası yok")
        icons["data"].append(found)
        log(f"arama: {e['name']} motor listesine eklendi")

    icons["timestamp"] = max(now, int(icons.get("timestamp", 0)) + 1)
    icons_json.write_text(json.dumps(icons, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    set_dump_timestamp(browser, "main/search-config-icons", icons["timestamp"])


def patch_default_search(browser: pathlib.Path) -> None:
    """Varsayılan arama motoru Startpage (normal ve gizli pencere).

    Motor listesi tarayıcıyla birlikte geliyor (search-config-v2.json); Startpage
    zaten listede, yalnızca "varsayılan" kaydını değiştiriyoruz. Kullanıcı
    ayarlardan başka bir motor seçebilir."""
    import json

    path = need(browser / "defaults/settings/main/search-config-v2.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    engines = {r.get("identifier") for r in data["data"] if r.get("recordType") == "engine"}
    if "startpage" not in engines:
        raise PatchError("search-config-v2.json: Startpage motoru bulunamadı")
    if "google" not in engines:
        add_extra_engines(browser, data)
    records = [r for r in data["data"] if r.get("recordType") == "defaultEngines"]
    if len(records) != 1:
        raise PatchError("search-config-v2.json: varsayılan motor kaydı bulunamadı")
    records[0]["globalDefault"] = "startpage"
    records[0]["globalDefaultPrivate"] = "startpage"
    # Uzak ayarlar (remote settings) paketlenmiş listeyi yalnızca profildeki
    # kopyadan YENİ olduğunda alır. Zaman damgası değişmeseydi, bu tarayıcıyı
    # daha önce çalıştırmış profiller eski varsayılanı (DuckDuckGo) kullanmaya
    # devam ederdi.
    import time

    now = int(time.time() * 1000)
    data["timestamp"] = max(now, int(data.get("timestamp", 0)) + 1)
    records[0]["last_modified"] = data["timestamp"]
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    set_dump_timestamp(browser, "main/search-config-v2", data["timestamp"])
    log("arama: varsayılan motor Startpage")


def patch_settings_pages(browser: pathlib.Path) -> None:
    """Ayarlar: Temel ayarlar sayfası, logolu arama motoru seçici, dikey
    sekme seçeneğinin kaldırılması.

    - "Temel ayarlar" (paneGeneral): Görünüm, Arama motoru, Dil ve "Tarayıcı
      verilerini içe aktar" gruplarını tek sayfada toplar ve ayarlar açılınca ilk o gelir. Firefox'un "Genel"
      sayfası yeni ayarlarda kapalı, ona kendi içeriğimizi veriyoruz.
    - Görünüm sayfası Temel ayarlar'a taşındığı için sol menüden kalkar; dil
      grupları da oraya taşındı, Diller sayfasında yalnızca çeviri ve yazım
      denetimi kalır.
    - "Hesap ve eşitleme" sayfası (Mozilla hesabı) kaldırıldı; içe aktarma grubu
      Temel ayarlar'a taşındı.
    - Sekmeler ve gezinti: "Tarayıcı düzeni" (dikey sekmeler) kaldırıldı.
    """
    prefs_dir = need(browser / "chrome/browser/content/browser/preferences")
    pjs = need(prefs_dir / "preferences.js")
    text = pjs.read_text(encoding="utf-8")

    def swap(old: str, new: str) -> None:
        nonlocal text
        if text.count(old) != 1:
            first = old.strip().splitlines()[0][:70]
            raise PatchError(f"preferences.js: bulunamadı ya da birden fazla: '{first}'")
        text = text.replace(old, new)

    swap(
        '  general: {\n'
        '    l10nId: "pane-general-title",\n'
        '    groupIds: [],\n'
        '    visible: () => !srdSectionPrefs.all,\n'
        '  },',
        '  general: {\n'
        '    l10nId: "marmara-pane-basics",\n'
        '    iconSrc: "chrome://browser/skin/preferences/category-general.svg",\n'
        '    groupIds: [\n'
        '      "marmaraDefaultBrowser", "appearance", "marmaraEngine", "browserLanguage",\n'
        '      "websiteLanguage",\n'
        '      "importBrowserData", "marmaraExport",\n'
        '    ],\n'
        '    module: "chrome://browser/content/preferences/config/marmara-basics.mjs",\n'
        '    visible: () => true,\n'
        '  },',
    )
    swap(
        '    iconSrc: "chrome://global/skin/icons/eye.svg",\n'
        '    visible: () => srdSectionPrefs.all,',
        '    iconSrc: "chrome://global/skin/icons/eye.svg",\n'
        '    visible: () => false, // marmara: Temel ayarlar sayfasına taşındı',
    )
    swap(
        '    groupIds: [\n'
        '      "browserLanguage",\n'
        '      "websiteLanguage",\n'
        '      "translations",\n'
        '      "spellCheck",\n'
        '    ],',
        '    groupIds: ["translations", "spellCheck"], // marmara: dil grupları Temel ayarlar sayfasında',
    )
    swap(
        '    module: "chrome://browser/content/preferences/config/account-sync.mjs",\n'
        '    replaces: "sync",',
        '    module: "chrome://browser/content/preferences/config/account-sync.mjs",\n'
        '    visible: () => false, // marmara: Mozilla hesabı/eşitleme yok\n'
        '    replaces: "sync",',
    )
    swap(
        '      "browserLayout",\n'
        '      "tabs",',
        '      "tabs",',
    )
    swap(
        '    groupIds: ["defaultBrowserHome", "startupHome", "homepage", "home"],',
        '    groupIds: ["startupHome"], // marmara: ana sayfa ve Firefox Home yok; varsayılan tarayıcı Temel ayarlar\'da',
    )
    swap(
        '      "etpAdvanced",\n'
        '      "ipprotection",\n',
        '      "etpAdvanced",\n',
    )
    swap(
        '  const kDefaultCategoryInternalName = redesignEnabled\n'
        '    ? "paneSync"\n'
        '    : "paneGeneral";\n'
        '  const kDefaultCategory = redesignEnabled ? "sync" : "general";',
        '  const kDefaultCategoryInternalName = "paneGeneral"; // marmara: Temel ayarlar\n'
        '  const kDefaultCategory = "general";',
    )
    pjs.write_text(text, encoding="utf-8")

    replace_once(need(prefs_dir / "config/LegacyPaneMappings.mjs"),
                 '  ["general", { category: "sync" }],\n', '')

    xhtml = prefs_dir / "preferences.xhtml"
    replace_once(
        xhtml,
        '        view="paneGeneral"\n'
        '        iconsrc="chrome://browser/skin/preferences/category-general.svg"\n'
        '        data-l10n-id="pane-general-title">',
        '        view="paneGeneral"\n'
        '        iconsrc="chrome://browser/skin/preferences/category-general.svg"\n'
        '        data-l10n-id="marmara-pane-basics">',
    )
    control_script = ('  <script type="module" src="chrome://browser/content/preferences/'
                      'widgets/setting-control.mjs"></script>\n')
    replace_once(
        xhtml,
        control_script,
        control_script
        + '  <script type="module" src="chrome://browser/content/preferences/'
          'widgets/marmara-engine-picker.mjs"></script>\n',
    )

    # Arama motoru seçicisinin seçenekleri, moz-select'teki gibi alt öğe olarak çizilsin
    replace_once(
        need(prefs_dir / "widgets/setting-control.mjs"),
        '  ["moz-visual-picker", literal`moz-visual-picker-item`],\n]);',
        '  ["moz-visual-picker", literal`moz-visual-picker-item`],\n'
        '  ["marmara-engine-picker", literal`marmara-engine-option`],\n]);',
    )

    search = need(prefs_dir / "config/search.mjs")
    stext = search.read_text(encoding="utf-8")
    if "Marmara: arama motoru seçici" not in stext:
        for needed in ("SettingGroupManager.registerGroups({\n  defaultEngine: {",
                       'id: "defaultEngineNormal"'):
            if needed not in stext:
                raise PatchError(f"search.mjs: '{needed.splitlines()[0]}' bulunamadı")
        block = (ROOT / "settings" / "search-marmara.mjs").read_text(encoding="utf-8")
        search.write_text(stext + block, encoding="utf-8")

    # Tarayıcı dili grubunun simgesi Firefox logosuydu: Marmara'nın kendi simgesi
    replace_once(
        need(prefs_dir / "config/languages.mjs"),
        'iconSrc: "chrome://browser/skin/sidebar/firefox.svg"',
        'iconSrc: "chrome://branding/content/icon32.png"',
    )
    shutil.copyfile(ROOT / "settings" / "basics-marmara.mjs", prefs_dir / "config/marmara-basics.mjs")
    for name in ("marmara-engine-picker.mjs", "marmara-engine-picker.css"):
        shutil.copyfile(ROOT / "settings" / "widgets" / name, prefs_dir / "widgets" / name)
    log("ayarlar: Temel ayarlar sayfası, logolu motor seçici, dikey sekmeler kaldırıldı")


def patch_default_toolbar(gre: pathlib.Path) -> None:
    """Yeni profillerin varsayılan araç çubuğu düzeni: yeni sekme düğmesi
    başlık çubuğunda, sekme çubuğunda yalnızca sekmeler (boş alan yok)."""
    f = gre / "moz-src/browser/components/customizableui/CustomizableUI.sys.mjs"
    text = need(f).read_text(encoding="utf-8")
    if "// marmara" in text:
        return
    replace_once(f,
                 '      "downloads-button",\n      AppConstants.MOZ_DEV_EDITION',
                 '      "new-tab-button", // marmara\n      "downloads-button",\n      AppConstants.MOZ_DEV_EDITION')
    replace_once(f,
                 '          "tabbrowser-tabs",\n          "new-tab-button",\n          "spring",\n          "alltabs-button",\n',
                 '          "tabbrowser-tabs", // marmara: yalnızca sekmeler\n')
    log("varsayılan düzen: yeni sekme düğmesi başlık çubuğunda")


# ---------------------------------------------------------------------------
# Tema seçimi: Ayarlar > Görünüm ve about:addons > Temalar
# ---------------------------------------------------------------------------

def add_head_line(path: pathlib.Path, anchor: str, line: str, marker: str) -> None:
    """<head> içine, anchor satırının hemen önüne bir satır ekler (bir kez)."""
    text = need(path).read_text(encoding="utf-8")
    if marker in text:
        return
    if text.count(anchor) != 1:
        raise PatchError(f"{path.name}: '{anchor.strip()}' satırı bulunamadı")
    indent = anchor[: len(anchor) - len(anchor.lstrip())]
    path.write_text(text.replace(anchor, f"{indent}{line}\n{anchor}"), encoding="utf-8")


def install_l10n(browser: pathlib.Path) -> None:
    n = 0
    for src in sorted((ROOT / "l10n").glob("*/marmara.ftl")):
        loc_dir = browser / "localization" / src.parent.name / "browser"
        if loc_dir.is_dir():
            shutil.copyfile(src, loc_dir / "marmara.ftl")
            n += 1
    if n == 0:
        raise PatchError("l10n/*/marmara.ftl dosyaları kopyalanamadı")
    log(f"çeviriler: {n} dil (diğer diller İngilizceye düşer)")


def patch_theme_choice(browser: pathlib.Path, gre: pathlib.Path) -> None:
    # Ayarlar > Görünüm: Firefox'un appearance.mjs dosyasının sonuna Marmara bloğu
    appearance = need(browser / "chrome/browser/content/browser/preferences/config/appearance.mjs")
    text = appearance.read_text(encoding="utf-8")
    if "Marmara: Görünüm" not in text:
        for needed in ('SettingGroupManager.registerGroups({\n  appearance: {',
                       'id: "web-appearance-chooser"'):
            if needed not in text:
                raise PatchError(f"appearance.mjs: '{needed.splitlines()[0]}' bulunamadı")
        block = (ROOT / "settings" / "appearance-marmara.mjs").read_text(encoding="utf-8")
        appearance.write_text(text + block, encoding="utf-8")

    prefs = browser / "chrome/browser/content/browser/preferences/preferences.xhtml"
    add_head_line(prefs, '  <link rel="localization" href="branding/brand.ftl"/>',
                  '<link rel="localization" href="browser/marmara.ftl"/>', "browser/marmara.ftl")
    log("Ayarlar > Görünüm: yalnızca Sistem / Aydınlık / Karanlık")

    # about:addons > Temalar
    ext = need(gre / "chrome/toolkit/content/mozapps/extensions")
    for name in ("marmara-themes.mjs", "marmara-themes.css"):
        shutil.copyfile(ROOT / "addons" / name, ext / name)
    html = ext / "aboutaddons.html"
    anchor = '    <link rel="localization" href="branding/brand.ftl" />'
    add_head_line(html, anchor, '<link rel="localization" href="browser/marmara.ftl" />', "browser/marmara.ftl")
    add_head_line(html, anchor,
                  '<link rel="stylesheet" href="chrome://mozapps/content/extensions/marmara-themes.css" />',
                  "marmara-themes.css")
    add_head_line(html, anchor,
                  '<script type="module" src="chrome://mozapps/content/extensions/marmara-themes.mjs"></script>',
                  "marmara-themes.mjs")
    log("about:addons > Temalar: aynı seçim ve uyarı")


# ---------------------------------------------------------------------------
# Gömülü eklentiler (builtin/)
# ---------------------------------------------------------------------------

def install_builtins(browser: pathlib.Path) -> None:
    """builtin/<ad>/ klasörlerindeki eklentileri omni.ja'ya koyar ve her
    açılışta kurulmalarını sağlar (bkz. builtin/MarmaraBuiltins.sys.mjs)."""
    import json

    addons_root = need(browser / "chrome/browser/builtin-addons")
    entries = []
    for manifest in sorted((ROOT / "builtin").glob("*/manifest.json")):
        src = manifest.parent
        data = json.loads(manifest.read_text(encoding="utf-8"))
        addon_id = data["browser_specific_settings"]["gecko"]["id"]
        dst = addons_root / src.name
        shutil.rmtree(dst, ignore_errors=True)
        shutil.copytree(src, dst)
        entries.append({
            "id": addon_id,
            "version": data["version"],
            "path": f"resource://builtin-addons/{src.name}/",
        })
        log(f"gömülü eklenti: {addon_id} {data['version']}")

    module = (ROOT / "builtin" / "MarmaraBuiltins.sys.mjs").read_text(encoding="utf-8")
    marker = "/* @BUILTINS@ */ []"
    if marker not in module:
        raise PatchError("MarmaraBuiltins.sys.mjs: @BUILTINS@ yer tutucusu yok")
    module = module.replace(marker, json.dumps(entries, indent=2))
    (need(browser / "modules") / "MarmaraBuiltins.sys.mjs").write_text(module, encoding="utf-8")

    add_category(browser, "category browser-before-ui-startup "
                          "resource:///modules/MarmaraBuiltins.sys.mjs MarmaraBuiltins.init")
    log(f"gömülü eklentiler: {len(entries)} kurulacak, eskiler temizlenecek")


def add_category(browser: pathlib.Path, line: str) -> None:
    manifest = need(browser / "components/components.manifest")
    text = manifest.read_text(encoding="utf-8")
    category = line.split()[1]
    if f"category {category} " not in text:
        raise PatchError(f"components.manifest: '{category}' kategorisi bulunamadı")
    if line not in text:
        manifest.write_text(text.rstrip("\n") + "\n" + line + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Yan paneller (Geçmiş, Yer imleri, Parolalar)
# ---------------------------------------------------------------------------

PANELS_URL = "chrome://browser/content/marmara-panels/"


def install_panels(browser: pathlib.Path, gre: pathlib.Path) -> None:
    """Geçmiş, Yer imleri ve Parolalar yan panellerini Marmara'nın kendi
    panelleriyle (panels/) değiştirir; üçü de aynı Adwaita tasarımını kullanır.
    Parolalar about:logins sekmesi yerine yan panelde açılır."""
    dst = need(browser / "chrome/browser/content/browser") / "marmara-panels"
    shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(ROOT / "panels", dst)

    sidebar = need(browser / "chrome/browser/content/browser/sidebar/browser-sidebar.js")
    replace_once(sidebar, '''          url: this.sidebarRevampEnabled
            ? "chrome://browser/content/sidebar/sidebar-history.html"
            : "chrome://browser/content/places/historySidebar.xhtml",''',
                 f'          url: "{PANELS_URL}history.html",')
    replace_once(sidebar, '''          url:
            this.sidebarRevampEnabled && this.updatedBookmarksPanelEnabled
              ? "chrome://browser/content/sidebar/sidebar-bookmarks.html"
              : "chrome://browser/content/places/bookmarksSidebar.xhtml",''',
                 f'          url: "{PANELS_URL}bookmarks.html",')
    replace_once(sidebar, 'url: "chrome://global/content/megalist/megalist.html",',
                 f'url: "{PANELS_URL}passwords.html",')

    replace_once(
        need(gre / "modules/LoginHelper.sys.mjs"),
        '''  openPasswordManager(
    window,
    { filterString = "", entryPoint = "", loginGuid = null } = {}
  ) {
''',
        '''  openPasswordManager(
    window,
    { filterString = "", entryPoint = "", loginGuid = null } = {}
  ) {
    // Marmara: parolalar about:logins sekmesi yerine yan panelde açılır
    try {
      const topWin = lazy.BrowserWindowTracker.getTopWindow({
        allowFromInactiveWorkspace: true,
      });
      topWin.SidebarController.show("viewCPMSidebar");
      return;
    } catch (e) {
      console.error("Marmara parolalar:", e);
    }
''',
    )
    # Kapanışta küçük bir kayma animasyonu: kutu hemen gizlenmesin diye hide()
    # sarmalanır; animasyon bitince özgün hide çalışır.
    replace_once(sidebar,
        "  hide({ triggerNode, dismissPanel = this.sidebarRevampEnabled } = {}) {\n",
        """  hide(opts = {}) {
    const box = this._box;
    if (
      !this.isOpen ||
      !box ||
      box.hidden ||
      this._marmaraCloseTimer ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return this._marmaraHideNow(opts);
    }
    box.setAttribute("marmara-closing", "");
    this._marmaraCloseTimer = setTimeout(() => {
      this._marmaraCloseTimer = null;
      box.removeAttribute("marmara-closing");
      this._marmaraHideNow(opts);
    }, 170);
  },

  _marmaraCloseCancel() {
    if (this._marmaraCloseTimer) {
      clearTimeout(this._marmaraCloseTimer);
      this._marmaraCloseTimer = null;
      this._box?.removeAttribute("marmara-closing");
    }
  },

  _marmaraHideNow({ triggerNode, dismissPanel = this.sidebarRevampEnabled } = {}) {
""")
    replace_once(sidebar,
        "  async show(commandID, triggerNode) {\n",
        "  async show(commandID, triggerNode) {\n    this._marmaraCloseCancel();\n")
    # İndirilenler: Kitaplık penceresi yerine tarayıcı içinde kendi kutumuz
    replace_once(
        need(browser / "chrome/browser/content/browser/browser-commands.js"),
        '''    } else {
      PlacesCommandHook.showPlacesOrganizer("Downloads");
    }''',
        '''    } else {
      try {
        ChromeUtils.importESModule(
          "resource:///modules/MarmaraSettings.sys.mjs"
        ).MarmaraSettings.showDownloads(window);
      } catch (e) {
        console.error("Marmara indirilenler:", e);
        PlacesCommandHook.showPlacesOrganizer("Downloads");
      }
    }''',
    )
    log("yan paneller: Geçmiş, Yer imleri, Parolalar (Adwaita), parolalar yan panelde")


# Kullanıcının tıkladığı "uzantıları yönet" girişleri about:addons yerine Ayarlar > Uzantılar'a
# gider. İzin istemleri gibi about:addons penceresine ihtiyaç duyan dahili akışlara dokunulmaz.
ADDON_ENTRY_POINTS = [
    ("chrome/browser/content/browser/browser-addons.js",
     '''        .addEventListener("command", () => {
          BrowserAddonUI.openAddonsMgr("addons://list/extension");''',
     '''        .addEventListener("command", () => {
          openPreferences("paneExtensions");'''),
    ("chrome/browser/content/browser/browser-addons.js",
     '          await BrowserAddonUI.openAddonsMgr("addons://list/extension");',
     '          await openPreferences("paneExtensions");'),
    ("chrome/browser/content/browser/browser-addons.js",
     '''      linkToAboutAddonsEl.addEventListener("click", () => {
        BrowserAddonUI.openAddonsMgr("addons://list/extension");''',
     '''      linkToAboutAddonsEl.addEventListener("click", () => {
        openPreferences("paneExtensions");'''),
    ("chrome/browser/content/browser/browser-addons.js",
     '      BrowserAddonUI.openAddonsMgr("addons://list/discover");',
     '      openPreferences("paneExtensions");'),
    ("chrome/browser/content/browser/browser-addons.js",
     '    this.openAddonsMgr("addons://detail/" + encodeURIComponent(addon.id));',
     '    openPreferences("paneExtensions");'),
    ("chrome/browser/content/browser/browser-sets.js",
     '''            BrowserAddonUI.openAddonsMgr();
            if (event.sourceEvent?.target.id == "key_openAddons") {''',
     '''            openPreferences("paneExtensions");
            if (event.sourceEvent?.target.id == "key_openAddons") {'''),
]


def patch_addon_entry_points(browser: pathlib.Path) -> None:
    for rel, old, new in ADDON_ENTRY_POINTS:
        replace_once(need(browser / rel), old, new)
    # "Eklenti eklendi" bildirimi uygulama menüsüne değil Ayarlar'a yönlendirsin
    texts = {
        "en-US": "Manage your add-ons and themes in Settings > Extensions.",
        "tr": "Eklentilerinizi ve temalarınızı Ayarlar > Uzantılar'dan yönetebilirsiniz.",
    }
    for ftl in browser.glob("localization/*/browser/appMenuNotifications.ftl"):
        text = texts.get(ftl.parent.parent.name)
        if text is None:
            continue
        body = ftl.read_text(encoding="utf-8")
        body = re.sub(r"(?m)^appmenu-addon-post-install-message3 = .*$",
                      f"appmenu-addon-post-install-message3 = {text}", body)
        ftl.write_text(body, encoding="utf-8")
    log(f"uzantı girişleri: {len(ADDON_ENTRY_POINTS)} yer Ayarlar > Uzantılar'a yönlendirildi")


def patch_migration_style(browser: pathlib.Path) -> None:
    """İçe aktarma sihirbazını (kendi penceresinde açılır) Adwaita görünümüne getirir."""
    skin = need(browser / "chrome/browser/skin/classic/browser/migration")
    extra = (ROOT / "theme/browser/migration.css").read_text(encoding="utf-8")
    wizard = need(skin / "migration-wizard.css")
    wizard.write_text(wizard.read_text(encoding="utf-8") + extra, encoding="utf-8")
    window = need(skin / "migration-dialog-window.css")
    window.write_text(
        window.read_text(encoding="utf-8")
        + "\nhtml, body { margin: 0; overflow: hidden; }\nbody { padding: 28px 28px 24px; }\n"
        + "html.marmara-embedded, html.marmara-embedded body { background: transparent; }\n"
        + "html.marmara-embedded body { padding: 4px 24px 24px; }\n",
        encoding="utf-8",
    )
    # Sihirbaz sayfası ayrı pencere yerine tarayıcı içindeki bir iframe'de de çalışsın
    js = need(browser / "chrome/browser/content/browser/migration/migration-dialog-window.js")
    replace_once(js, "    let args = window.arguments[0];\n",
                 """    let args = window.arguments?.[0];
    if (!args && window.frameElement) {
      // Marmara: tarayıcı içindeki kutuda (iframe) açıldı
      args = { options: window.frameElement.marmaraMigrationOptions ?? {} };
      document.documentElement.classList.add("marmara-embedded");
    }
""")
    replace_once(js, "window.close();", "MigrationDialog.closeWindow();", count_expected=3)
    replace_once(js, "      window.sizeToContent();\n",
                 """      if (window.top === window) {
        window.sizeToContent();
      } else {
        const rect = document.body.getBoundingClientRect();
        window.frameElement.style.height = Math.ceil(rect.height) + "px";
      }
""")
    replace_once(js, "  _wiz: null,\n",
                 """  _wiz: null,

  closeWindow() {
    if (window.top === window) {
      window.close();
    } else {
      window.frameElement?.dispatchEvent(new CustomEvent("MarmaraMigrationClose"));
    }
  },
""")
    # Tüm giriş noktaları (Dosya menüsü, yer imleri, yeni sekme) kutuyu kullansın
    replace_once(need(browser / "modules/MigrationUtils.sys.mjs"),
                 "  showMigrationWizard(aOpener, aOptions) {\n",
                 """  showMigrationWizard(aOpener, aOptions) {
    // Marmara: tarayıcı penceresinde kendi kutusunda aç
    if (
      !aOptions?.isStartupMigration &&
      aOpener?.document?.documentElement?.getAttribute("windowtype") ==
        "navigator:browser"
    ) {
      try {
        ChromeUtils.importESModule(
          "resource:///modules/MarmaraSettings.sys.mjs"
        ).MarmaraSettings.showMigration(aOpener, aOptions);
        return Promise.resolve();
      } catch (e) {
        console.error("Marmara içe aktarma:", e);
      }
    }
""")
    log("içe aktarma sihirbazı: Adwaita görünümü")


# Gizlilik ve güvenlik sayfasındaki metinler: (tr, en-US). None = o satır kaldırılır.
PRIVACY_TEXTS = {
    "librewolf-etp": {
        "description": ("Varsayılan olarak katı modda açık. Değiştirmenizi önermeyiz.",
                        "On in Strict mode by default. We don't recommend changing it.")},
    "preferences-etp-level-strict": {
        "description": ("Daha fazla takip kodunu engeller; bazı siteler bozulabilir.",
                        "Blocks more trackers; some sites may break.")},
    "content-blocking-baseline-exceptions-3": {
        "description": ("Sitelerin yüklenmesine yardımcı olur.", "Helps sites load.")},
    "content-blocking-convenience-exceptions-3": {
        "description": ("Daha az koruma sağlar.", "Offers less protection.")},
    "preferences-etp-manage-exceptions-button": {"description": None},
    "sitedata-heading": {"description": None},
    "sitedata-cookies-exceptions3": {"description": None},
    "history-section-header": {"description": None},
    "dns-over-https-group2": {
        "description": ("Site sorgularını şifreler.", "Encrypts site lookups.")},
    "preferences-connection-link-section": {"description": None},
    "librewolf-extension-update-checkbox2": {
        "label": ("Eklentileri otomatik güncelle", "Update add-ons automatically"),
        "description": None},
    "librewolf-ipv6-checkbox2": {
        "label": ("IPv6'yı etkinleştir", "Enable IPv6"), "description": None},
    "librewolf-xorigin-ref-checkbox2": {
        "label": ("Siteler arası yönlendiren bilgisini sınırla", "Limit cross-origin referrers"),
        "description": None},
    "librewolf-jit-checkbox2": {
        "label": ("JavaScript JIT'i varsayılan olarak kapat", "Disable JavaScript JIT by default"),
        "description": None},
    "librewolf-rfp-checkbox2": {
        "label": ("Parmak izi korumasını etkinleştir", "Enable fingerprint protection"),
        "description": ("Bazı siteler bozulabilir.", "Some sites may break.")},
    "librewolf-letterboxing-checkbox2": {
        "label": ("Letterboxing'i etkinleştir", "Enable letterboxing"), "description": None},
    "librewolf-webgl-checkbox2": {
        "label": ("WebGL'e her zaman izin ver", "Always allow WebGL"), "description": None},
    "librewolf-webgl-prompt-checkbox2": {
        "label": ("WebGL izin kutusunu gizle", "Hide the WebGL permission popup"),
        "description": None},
}


def edit_ftl_message(text: str, msg_id: str, attrs: dict, index: int) -> str:
    """Bir Fluent iletisinin özniteliklerini değiştirir ya da siler (.accesskey
    gibi diğer öznitelikler olduğu gibi kalır). İleti yoksa eklenir."""
    pattern = re.compile(rf"^{re.escape(msg_id)} =\n((?:[ \t]+.*\n?|\n(?=[ \t]))*)", re.M)
    m = pattern.search(text)
    if not m and re.search(rf"^{re.escape(msg_id)} =", text, re.M):
        raise PatchError(f"preferences.ftl: {msg_id} beklenen biçimde değil")
    lines: list[tuple[str, str]] = []  # (öznitelik, değer)
    if m:
        current = None
        for raw in m.group(1).splitlines():
            head = re.match(r"\s+\.([\w-]+) = ?(.*)", raw)
            if head:
                current = [head.group(1), head.group(2)]
                lines.append(current)
            elif current is not None and raw.strip():
                current[1] += " " + raw.strip()
        lines = [tuple(x) for x in lines]
    values = dict(lines)
    order = [k for k, _ in lines]
    for name, pair in attrs.items():
        value = None if pair is None else pair[index]
        if value is None:
            values.pop(name, None)
            order = [k for k in order if k != name]
        else:
            if name not in values:
                order.append(name)
            values[name] = value
    body = "".join(f"    .{k} = {values[k]}\n" for k in order if k in values)
    block = f"{msg_id} =\n{body}"
    if m:
        return text[:m.start()] + block + text[m.end():]
    return text.rstrip("\n") + "\n\n" + block


def patch_privacy_page(browser: pathlib.Path) -> None:
    """Gizlilik ve güvenlik sayfasını sadeleştirir: uzun açıklamalar kısalır ya da
    kalkar; VPN, Relay ve "Do Not Track" bilgi kutuları ile "dikkat" panosu çıkar."""
    for index, loc in enumerate(("tr", "en-US")):
        path = need(browser / "localization" / loc / "browser/preferences/preferences.ftl")
        text = path.read_text(encoding="utf-8")
        for msg_id, attrs in PRIVACY_TEXTS.items():
            text = edit_ftl_message(text, msg_id, attrs, index)
        path.write_text(text, encoding="utf-8")

    mjs = need(browser / "chrome/browser/content/browser/preferences/config/privacy.mjs")
    replace_once(mjs, '''      {
        id: "relayIntegration",
        l10nId: "preferences-privacy-relay-available",
        supportPage: "firefox-relay-integration",
      },
      {
        id: "dntRemoval",
        l10nId: "do-not-track-removal3",
        control: "moz-message-bar",
        supportPage: "how-do-i-turn-do-not-track-feature",
        controlAttrs: {
          dismissable: true,
          role: "status",
        },
      },
''', "")
    replace_once(mjs, '''      {
        id: "etpLevelWarning",
        control: "moz-promo",
        l10nId: "preferences-etp-level-warning-message",
        controlAttrs: {
          ".imageAlignment": "end",
          ".imageSrc":
            "chrome://browser/content/preferences/etp-toggle-promo.svg",
          imagewidth: "large",
          imagedisplay: "cover",
        },
      },
''', "")
    log("gizlilik sayfası: metinler kısaltıldı; VPN, Relay, DNT ve uyarı panosu kaldırıldı")


# Marmara'nın tarayıcı modülleri (modules/) ve her pencere için çağrıldıkları kategori
MODULES = [
    ("MarmaraTosdr.sys.mjs", "browser-window-delayed-startup", "MarmaraTosdr.initWindow"),
    ("MarmaraWebGL.sys.mjs", "browser-window-delayed-startup", "MarmaraWebGL.initWindow"),
    ("MarmaraAppMenu.sys.mjs", "browser-window-delayed-startup", "MarmaraAppMenu.initWindow"),
    ("MarmaraWelcome.sys.mjs", "browser-window-delayed-startup", "MarmaraWelcome.initWindow"),
    ("MarmaraExtensions.sys.mjs", "browser-window-delayed-startup", "MarmaraExtensions.initWindow"),
    ("MarmaraStartpage.sys.mjs", "browser-before-ui-startup", "MarmaraStartpage.init"),
]
# Kategoriye bağlanmayan, kullanılırken içe aktarılan modüller
ON_DEMAND_MODULES = ["MarmaraAbout.sys.mjs", "MarmaraSettings.sys.mjs"]


def install_modules(browser: pathlib.Path) -> None:
    """Adres çubuğundaki Hizmet Koşulları Notu ve site panelindeki WebGL izni."""
    checks = {
        "chrome/browser/content/browser/browser-trustPanel.js": "showPopup(",
        "chrome/browser/content/browser/urlbar/UrlbarInputBase.mjs": 'name="site-info"',
        "chrome/browser/content/browser/browser.xhtml": 'id="trustpanel-toggle-section"',
        "chrome/browser/content/browser/customizableui/panelUI.js": "appMenu-mainView",
    }
    for rel, needle in checks.items():
        path = browser / rel
        if not path.exists():
            raise PatchError(f"beklenen dosya yok: {rel}")
        if needle not in path.read_text(encoding="utf-8"):
            raise PatchError(f"{rel}: '{needle}' bulunamadı (Firefox yapısı değişmiş)")
    for name, category, entry in MODULES:
        shutil.copyfile(ROOT / "modules" / name, need(browser / "modules") / name)
        add_category(browser, f"category {category} resource:///modules/{name} {entry}")
        log(f"modül: {name}")
    # Kategoriye bağlı olmayan, istenince yüklenen modüller
    for name in ON_DEMAND_MODULES:
        shutil.copyfile(ROOT / "modules" / name, need(browser / "modules") / name)
        log(f"modül: {name}")
    # "Hakkında" ayrı pencere yerine pencere içi iletişim kutusu olarak açılır
    replace_once(
        browser / "chrome/browser/content/browser/utilityOverlay.js",
        "function openAboutDialog() {\n",
        "function openAboutDialog() {\n"
        "  // Marmara: pencere içi hakkında kutusu; olmazsa Firefox'un penceresi açılır\n"
        "  try {\n"
        "    ChromeUtils.importESModule(\"resource:///modules/MarmaraAbout.sys.mjs\").MarmaraAbout.show(\n"
        "      BrowserWindowTracker.getTopWindow() || window\n"
        "    );\n"
        "    return;\n"
        "  } catch (e) {\n"
        "    console.error(\"Marmara hakkında:\", e);\n"
        "  }\n",
    )
    # Ayarlar sekme yerine pencere içi iletişim kutusu olarak açılır (menü, kısayol,
    # eklentiler ve openPreferences() çağıran her yer buraya düşer)
    replace_once(
        browser / "chrome/browser/content/browser/utilityOverlay.js",
        "async function openPreferences(paneID, extraArgs) {\n",
        "async function openPreferences(paneID, extraArgs) {\n"
        "  // Marmara: pencere içi ayarlar kutusu; olmazsa Firefox'un ayarlar sekmesi açılır\n"
        "  try {\n"
        "    const topWin = BrowserWindowTracker.getTopWindow();\n"
        "    if (topWin) {\n"
        "      ChromeUtils.importESModule(\"resource:///modules/MarmaraSettings.sys.mjs\").MarmaraSettings.show(\n"
        "        topWin,\n"
        "        paneID\n"
        "      );\n"
        "      return;\n"
        "    }\n"
        "  } catch (e) {\n"
        "    console.error(\"Marmara ayarlar:\", e);\n"
        "  }\n",
    )
    # Başlangıç sayfası (about:marmara): chrome://browser/content/marmara/
    page_dst = need(browser / "chrome/browser/content/browser") / "marmara"
    shutil.rmtree(page_dst, ignore_errors=True)
    shutil.copytree(ROOT / "startpage", page_dst)
    log("başlangıç sayfası: about:marmara")


# ---------------------------------------------------------------------------
# Boyut: kullanılmayan diller
# ---------------------------------------------------------------------------

def prune_locales(browser: pathlib.Path, gre: pathlib.Path) -> None:
    """config/locales.txt dışındaki arayüz dillerini iki omni.ja'dan da çıkarır."""
    keep = {"en-US"}
    for line in (CONFIG / "locales.txt").read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0]
        keep.update(line.split())

    multilocale = need(gre / "res/multilocale.txt")
    available = [l.strip() for l in multilocale.read_text(encoding="utf-8").replace("\n", ",").split(",") if l.strip()]
    if "en-US" not in available:
        available.append("en-US")
    drop = [l for l in available if l not in keep]
    missing = keep - set(available)
    if missing:
        raise PatchError(f"config/locales.txt: bu sürümde olmayan dil(ler): {', '.join(sorted(missing))}")

    removed_dirs = 0
    for omni in (browser, gre):
        manifest = omni / "chrome/chrome.manifest"
        lines = need(manifest).read_text(encoding="utf-8").splitlines()
        kept_lines = []
        for line in lines:
            parts = line.split()
            if len(parts) >= 4 and parts[0] == "locale" and parts[2] in drop:
                target = (omni / "chrome" / parts[3]).resolve()
                if target.is_dir() and parts[2] in target.parts:
                    shutil.rmtree(target, ignore_errors=True)
                    removed_dirs += 1
                continue
            kept_lines.append(line)
        manifest.write_text("\n".join(kept_lines) + "\n", encoding="utf-8")

        for loc in drop:
            for d in (omni / "localization" / loc, omni / "chrome" / loc,
                      omni / "chrome/browser/locale" / loc):
                if d.is_dir():
                    shutil.rmtree(d, ignore_errors=True)
                    removed_dirs += 1

    multilocale.write_text(",".join(l for l in available if l in keep) + "\n", encoding="utf-8")
    log(f"diller: {', '.join(sorted(keep))} kaldı, {len(drop)} dil çıkarıldı ({removed_dirs} klasör)")


# ---------------------------------------------------------------------------
# Ayarlar
# ---------------------------------------------------------------------------

def install_prefs(gre: pathlib.Path) -> None:
    dst = need(gre / "defaults/pref/local-settings.js")
    shutil.copyfile(CONFIG / "local-settings.js", dst)
    log("ayar dosyası adı: marmara.cfg")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--browser", required=True, type=pathlib.Path, help="açılmış browser/omni.ja")
    ap.add_argument("--gre", required=True, type=pathlib.Path, help="açılmış omni.ja (kök)")
    args = ap.parse_args()

    steps = [
        ("marka dosyaları", lambda: patch_brand_files(args.browser)),
        ("marka metinleri", lambda: patch_brand_strings(args.browser, args.gre)),
        ("marka görselleri", lambda: patch_brand_images(args.browser)),
        ("hakkında penceresi", lambda: patch_about_dialog(args.browser)),
        ("tema", lambda: install_theme(args.browser, args.gre)),
        ("sekme çubuğu", lambda: patch_tab_bar_autohide(args.browser)),
        ("kısayollar", lambda: patch_tab_shortcuts(args.browser)),
        ("çeviriler", lambda: install_l10n(args.browser)),
        ("tema seçimi", lambda: patch_theme_choice(args.browser, args.gre)),
        ("gömülü eklentiler", lambda: install_builtins(args.browser)),
        ("modüller", lambda: install_modules(args.browser)),
        ("yan paneller", lambda: install_panels(args.browser, args.gre)),
        ("uzantı girişleri", lambda: patch_addon_entry_points(args.browser)),
        ("içe aktarma", lambda: patch_migration_style(args.browser)),
        ("diller", lambda: prune_locales(args.browser, args.gre)),
        ("araç çubuğu", lambda: patch_default_toolbar(args.gre)),
        ("arama", lambda: patch_default_search(args.browser)),
        ("ayar sayfaları", lambda: patch_settings_pages(args.browser)),
        ("gizlilik sayfası", lambda: patch_privacy_page(args.browser)),
        ("ayarlar", lambda: install_prefs(args.gre)),
    ]
    for name, fn in steps:
        print(f"[{name}]")
        try:
            fn()
        except PatchError as e:
            print(f"HATA ({name}): {e}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
