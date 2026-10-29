#!/usr/bin/env python3
"""Firefox simgelerini GNOME'un Adwaita sembolik simgeleriyle değiştirir.

Simge dosyaları branding/adwaita-icons/ içinde durur (adwaita-icon-theme,
LGPL-3.0 veya CC-BY-SA-3.0; bkz. branding/adwaita-icons/NOTICE.md). Derleme
sırasında ağ gerekmez. Her Firefox simgesi aynı dosya adıyla yeniden yazılır:
boyutu eski dosyadan alınır, renk Firefox'un bağlam rengine (context-fill)
bağlanır, böylece temaya ve duruma göre boyanmaya devam eder.

Eşleme: aşağıdaki BROWSER ve GLOBAL sözlükleri. Anahtar, Firefox'taki simgenin
(browser: chrome/browser/skin/classic/browser/, global:
chrome/toolkit/skin/classic/global/icons/) yoludur; değer, Adwaita simge adıdır.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "branding" / "adwaita-icons"

BROWSER_BASE = "chrome/browser/skin/classic/browser/"
GLOBAL_BASE = "chrome/toolkit/skin/classic/global/icons/"

BROWSER = {
    # Araç çubuğu
    "back.svg": "go-previous",
    "forward.svg": "go-next",
    "home.svg": "go-home",
    "menu.svg": "open-menu",
    "new-tab.svg": "tab-new",
    "bookmark.svg": "starred",
    "bookmark-12.svg": "starred",
    "bookmark-hollow.svg": "non-starred",
    "downloads/downloads.svg": "folder-download",
    "history.svg": "document-open-recent",
    "history-20.svg": "document-open-recent",
    "save.svg": "media-floppy",
    "open.svg": "document-open",
    "fullscreen.svg": "zoom-fit-best",
    "privateBrowsing.svg": "private",
    "fullscreen-exit.svg": "view-restore",
    "sidebar-expanded.svg": "sidebar-show",
    "sidebar-collapsed.svg": "sidebar-show",
    "sidebar-expanded-right.svg": "sidebar-show-right",
    "sidebar-collapsed-right.svg": "sidebar-show-right",
    "edit-cut.svg": "edit-cut",
    "edit-paste.svg": "edit-paste",
    "login.svg": "dialog-password",
    "pin.svg": "view-pin",
    "pin-12.svg": "view-pin",
    # --- Adres çubuğu, güvenlik, izinler ---
    "trust-icon-active.svg": "security-high",
    "trust-icon-disabled.svg": "security-low",
    "trust-icon-insecure.svg": "channel-insecure",
    "trust-icon-warning.svg": "dialog-warning",
    "tracking-protection.svg": "security-high",
    "tracking-protection-active.svg": "security-high",
    "tracking-protection-disabled.svg": "security-low",
    "permissions.svg": "changes-allow",
    "fingerprint.svg": "auth-fingerprint",
    "drm-icon.svg": "channel-secure",
    "translations.svg": "translate",
    "translations-companion.svg": "translate",
    "reader-mode.svg": "note",
    "share.svg": "send-to",
    "send-tab.svg": "send-to",
    "screenshot.svg": "applets-screenshooter",
    "qrcode.svg": "view-grid",
    "bookmark-star-on-tray.svg": "starred",
    "bookmarks-toolbar.svg": "user-bookmarks",
    "privateBrowsing.svg": "private",
    # --- Menüler ve paneller ---
    "add-circle-fill.svg": "list-add",
    "subtract-circle-fill.svg": "list-remove",
    "calendar-24.svg": "x-office-calendar",
    "characterEncoding.svg": "preferences-desktop-locale",
    "circle-check-dotted.svg": "object-select",
    "closed-tabs.svg": "edit-undo",
    "contrast.svg": "preferences-desktop-appearance",
    "customize.svg": "preferences-other",
    "device-desktop.svg": "computer",
    "device-phone.svg": "phone",
    "device-tablet.svg": "tablet",
    "device-tv.svg": "tv",
    "device-vr.svg": "video-display",
    "firefox-view.svg": "view-grid",
    "forget.svg": "edit-clear-all",
    "flame.svg": "edit-clear-all",
    "import.svg": "document-open",
    "labs-16.svg": "applications-science",
    "library.svg": "folder-documents",
    "lightning-bolt.svg": "power-profile-performance",
    "mail.svg": "mail-send",
    "open-tabs.svg": "view-list",
    "payment-methods-16.svg": "dialog-password",
    "personal-info-16.svg": "user-info",
    "remote-control.svg": "preferences-desktop-remote-desktop",
    "search-tabs.svg": "system-search",
    "sort.svg": "view-sort-ascending",
    "split-view-left-16.svg": "view-dual",
    "split-view-right-16.svg": "view-dual",
    "sync.svg": "network-transmit-receive",
    "synced-tabs.svg": "computer",
    "tab.svg": "web-browser",
    "tabs.svg": "view-list",
    "taskbar-tabs-add-tab.svg": "tab-new",
    "taskbar-tabs-move-tab.svg": "go-jump",
    "thumb-down.svg": "face-sad",
    "topsites.svg": "view-grid",
    "window.svg": "window-new",
    "webgl.svg": "image-x-generic",
    "webgl-blocked.svg": "image-missing",
    "canvas-blocked.svg": "image-missing",
    # --- Yer imleri (places) ---
    "places/bookmarksMenu.svg": "view-list",
    "places/bookmarksToolbar.svg": "user-bookmarks",
    "places/folder-smart.svg": "folder-saved-search",
    "places/tag.svg": "bookmark-new",
    # --- Ayarlar kategorileri ---
    "preferences/category-general.svg": "preferences-system",
    "preferences/category-privacy-security.svg": "preferences-system-privacy",
    "preferences/category-accessibility.svg": "preferences-desktop-accessibility",
    "preferences/category-search.svg": "system-search",
    "preferences/category-sync.svg": "network-transmit-receive",
    # --- Site izinleri ---
    "notification-icons/camera.svg": "camera-web",
    "notification-icons/camera-blocked.svg": "camera-disabled",
    "notification-icons/microphone.svg": "audio-input-microphone",
    "notification-icons/microphone-blocked.svg": "microphone-disabled",
    "notification-icons/speaker.svg": "audio-speakers",
    "notification-icons/geo.svg": "location-services-active",
    "notification-icons/geo-blocked.svg": "location-services-disabled",
    "notification-icons/desktop-notification.svg": "preferences-system-notifications",
    "notification-icons/desktop-notification-blocked.svg": "notifications-disabled",
    "notification-icons/popup.svg": "window-new",
    "notification-icons/screen.svg": "video-display",
    "notification-icons/screen-blocked.svg": "action-unavailable",
    "notification-icons/persistent-storage.svg": "drive-harddisk",
    "notification-icons/persistent-storage-blocked.svg": "action-unavailable",
    "notification-icons/autoplay-media.svg": "media-playback-start",
    "notification-icons/autoplay-media-blocked.svg": "action-unavailable",
    "notification-icons/midi.svg": "audio-x-generic",
    "notification-icons/serial.svg": "modem",
    "notification-icons/xr.svg": "video-display",
    "notification-icons/xr-blocked.svg": "action-unavailable",
    "notification-icons/local-network.svg": "network-wired",
    "notification-icons/local-network-blocked.svg": "network-wired-disconnected",
    "notification-icons/local-host-blocked.svg": "network-offline",
    "notification-icons/minimize.svg": "window-minimize",
    "notification-icons/drag-indicator.svg": "list-drag-handle",
    # --- Sekmeler ve indirmeler ---
    "tabbrowser/tab-audio-playing-small.svg": "audio-volume-high",
    "tabbrowser/tab-audio-muted-small.svg": "audio-volume-muted",
    "tabbrowser/tab-audio-blocked-small.svg": "audio-volume-muted",
    "tabbrowser/tab-groups.svg": "folder",
    "formautofill/icon-doorhanger-menu.svg": "view-more",
}

GLOBAL = {
    "arrow-down.svg": "pan-down",
    "arrow-down-12.svg": "pan-down",
    "arrow-up.svg": "pan-up",
    "arrow-up-12.svg": "pan-up",
    "arrow-left.svg": "pan-start",
    "arrow-left-12.svg": "pan-start",
    "arrow-right.svg": "pan-end",
    "arrow-right-12.svg": "pan-end",
    "check.svg": "object-select",
    "close.svg": "window-close",
    "delete.svg": "user-trash",
    "edit.svg": "document-edit",
    "edit-copy.svg": "edit-copy",
    "eye.svg": "view-reveal",
    "eye-slash.svg": "view-conceal",
    "folder.svg": "folder",
    "minus.svg": "list-remove",
    "plus.svg": "list-add",
    "more.svg": "view-more-horizontal",
    "print.svg": "document-print",
    "reload.svg": "view-refresh",
    "search-glass.svg": "system-search",
    "settings.svg": "emblem-system",
    "security.svg": "system-lock-screen",
    "undo.svg": "edit-undo",
    "users.svg": "system-users",
    "warning.svg": "dialog-warning",
    "arrow-counterclockwise-16.svg": "edit-undo",
    "block.svg": "action-unavailable",
    "blocked.svg": "action-unavailable",
    "canvas.svg": "image-x-generic",
    "check-filled.svg": "object-select",
    "check-partial.svg": "list-remove",
    "chevron.svg": "pan-down",
    "clipboard.svg": "edit-paste",
    "close-fill.svg": "window-close",
    "color-picker-20.svg": "color-select",
    "columnpicker.svg": "view-list",
    "comment-24.svg": "chat-message-new",
    "content-analysis.svg": "preferences-system-privacy",
    "defaultFavicon.svg": "text-x-generic",
    "developer.svg": "applications-engineering",
    "double-checkmark.svg": "object-select",
    "edit-outline.svg": "document-edit",
    "error.svg": "dialog-error",
    "experiments.svg": "applications-science",
    "find-in-page-24.svg": "edit-find",
    "heart.svg": "emote-love",
    "help.svg": "dialog-question",
    "highlighter-24.svg": "color-select",
    "info.svg": "dialog-information",
    "info-filled.svg": "dialog-information",
    "lightbulb.svg": "dialog-information",
    "link.svg": "insert-link",
    "local-host.svg": "network-server",
    "moon.svg": "weather-clear-night",
    "sun.svg": "weather-clear",
    "move-16.svg": "go-jump",
    "newsfeed.svg": "application-rss+xml",
    "odd-spreads-24.svg": "view-dual",
    "open-in-new.svg": "send-to",
    "organizational-unit.svg": "network-workgroup",
    "page-landscape.svg": "orientation-landscape",
    "page-portrait.svg": "text-x-generic",
    "pdf.svg": "x-office-document",
    "performance.svg": "power-profile-performance",
    "plugin.svg": "application-x-addon",
    "plus-20.svg": "list-add",
    "presentation-mode-24.svg": "x-office-presentation",
    "rating-star.svg": "starred",
    "search-textbox.svg": "system-search",
    "security-broken.svg": "channel-insecure",
    "security-custom-root.svg": "application-certificate",
    "security-warning.svg": "dialog-warning",
    "shaft-arrow-down.svg": "go-down",
    "shaft-arrow-left.svg": "go-previous",
    "shaft-arrow-right.svg": "go-next",
    "shaft-arrow-up.svg": "go-up",
    "signature-24.svg": "document-edit",
    "swap-horizontal-20.svg": "object-flip-horizontal",
    "tab-notes.svg": "text-editor",
    "tab-notes-12.svg": "text-editor",
    "thumbs-down-20.svg": "face-sad",
    "thumbs-up-20.svg": "face-smile",
    "trending.svg": "value-increase",
    "update-icon.svg": "software-update-available",
    "warning-fill-12.svg": "dialog-warning",
}

MOZAPPS_BASE = "chrome/toolkit/skin/classic/mozapps/extensions/"

MOZAPPS = {
    "category-available.svg": "system-software-install",
    "category-extensions.svg": "application-x-addon",
    "category-plugins.svg": "application-x-addon",
    "category-recent.svg": "document-open-recent",
    "category-sitepermission.svg": "changes-allow",
    "dictionaryGeneric.svg": "accessories-dictionary",
    "extension.svg": "application-x-addon",
    "extensionGeneric.svg": "application-x-addon",
    "themeGeneric.svg": "preferences-desktop-appearance",
}

_SIZE = re.compile(r'\b(width|height)="([0-9.]+)(?:px)?"')


def _size_of(old_svg: str) -> tuple[str, str]:
    """Eski dosyanın kök etiketindeki boyut (yoksa 16)."""
    root = re.search(r"<svg\b[^>]*>", old_svg).group(0)
    found = {k: v for k, v in _SIZE.findall(root)}
    return found.get("width", "16"), found.get("height", "16")


# Ok simgelerinin çizimi 16x16 kutusunun tam ortasında değil (örn. pan-down 1px
# aşağıda). Döndürülünce (açılır menü okları) sallanmasın diye görünür alan kaydırılır.
VIEWBOX = {
    "pan-down": "0 1 16 16",
    "pan-up": "0 0 16 16",
    "pan-start": "-0.96 0 16 16",
    "pan-end": "1 0 16 16",
}


def convert(adwaita_svg: str, width: str, height: str, name: str = "") -> str:
    """Adwaita SVG'sini Firefox'un bağlam rengiyle boyanan biçime çevirir."""
    inner = re.search(r"<svg\b[^>]*>(.*)</svg>", adwaita_svg, re.S).group(1)
    # Başka araçların eklediği <metadata> bloklarını at (tanımsız ad alanı SVG'yi bozar).
    inner = re.sub(r"<metadata\b.*?</metadata>", "", inner, flags=re.S)
    # Sabit renkleri kaldır; kök öğenin context-fill'i devralınır.
    inner = re.sub(r'\sfill="#[0-9a-fA-F]{3,8}"', "", inner)
    inner = re.sub(r'\sstyle="[^"]*"', "", inner)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEWBOX.get(name, "0 0 16 16")}" '
        f'width="{width}" height="{height}" fill="context-fill" '
        f'fill-opacity="context-fill-opacity">{inner.strip()}</svg>\n'
    )


def apply(browser: pathlib.Path, gre: pathlib.Path):
    """Eşlemedeki simgeleri iki omni.ja klasöründe yeniden yazar; (sayı, eksikler)."""
    done, missing = 0, []
    for omni, base, table in ((browser, BROWSER_BASE, BROWSER), (gre, GLOBAL_BASE, GLOBAL), (gre, MOZAPPS_BASE, MOZAPPS)):
        for rel, name in table.items():
            target = omni / base / rel
            source = ICON_DIR / f"{name}-symbolic.svg"
            if not target.is_file() or not source.is_file():
                missing.append(f"{base}{rel} <- {name}")
                continue
            width, height = _size_of(target.read_text(encoding="utf-8"))
            original = target.read_text(encoding="utf-8")
            new = convert(source.read_text(encoding="utf-8"), width, height, name)
            if 'class="proton"' in original or 'class="nova"' in original:
                # Özgün iskeleti koru (stil + proton/nova grupları); yalnızca şekilleri değiştir.
                inner = re.search(r"<svg\b[^>]*>(.*)</svg>", new, re.S).group(1)
                new = re.sub(
                    r'(<g class="(?:proton|nova)"[^>]*>).*?(</g>)',
                    lambda m: m.group(1) + inner + m.group(2),
                    original, flags=re.S)
                new = re.sub(r'viewBox="[^"]*"', f'viewBox="{VIEWBOX.get(name, "0 0 16 16")}"', new, count=1)
            target.write_text(new, encoding="utf-8")
            done += 1
    return done, missing
