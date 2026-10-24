/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Marmara: Ayarlar penceresi
 *
 * libadwaita'nın AdwPreferencesDialog'una göre: tarayıcı penceresinin içinde,
 * yuvarlak köşeli bir iletişim kutusu. Solda sayfalar, üstte arama, sağda
 * gruplanmış satırlar (kart içinde başlık + açıklama + denetim).
 *
 * Her ayar doğrudan Firefox'un kendi ayarına (pref) bağlanır; böylece about:
 * preferences sayfasıyla aynı değerleri okur ve yazar. Metinler
 * l10n/*\/marmara.ftl dosyasında ("marmara-settings-<anahtar>" ve açıklamalar
 * için "-sub" ekiyle). Görünüm theme/browser/settings.css'te.
 *
 * utilityOverlay.js'teki openPreferences() buraya yönlendirilir
 * (scripts/patch_omni.py).
 */

const { AppConstants } = ChromeUtils.importESModule("resource://gre/modules/AppConstants.sys.mjs");

const HTML_NS = "http://www.w3.org/1999/xhtml";
const ICON = name =>
  ({
    general: "chrome://browser/skin/preferences/category-general.svg",
    startup: "chrome://browser/skin/home.svg",
    privacy: "chrome://browser/skin/preferences/category-privacy-security.svg",
    passwords: "chrome://browser/skin/login.svg",
    downloads: "chrome://browser/skin/downloads/downloads.svg",
    data: "chrome://browser/skin/save.svg",
    extensions: "chrome://mozapps/skin/extensions/extension.svg",
  })[name] ?? `chrome://global/skin/icons/${name}.svg`;

const PREF_DARK = "ui.systemUsesDarkTheme";
const PREF_CONTENT_SCHEME = "layout.css.prefers-color-scheme.content-override";
const PREF_LOCALE = "intl.locale.requested";

// Güncelleme denetimi: yalnızca kullanıcı düğmeye basınca GitHub'a tek bir istek gider.
// Marmara'nın GitHub proje yolu ("kullanıcı/proje"). Boşsa güncelleme grubu gizlenir.
// En son sürüm, projenin en son release'inin etiketidir ("v1.1" ya da "1.1").
const GITHUB_PROJECT = "fuzuliinitiative/marmara";
const UPDATE_TIMEOUT_MS = 10000;
const FLATPAK_ID = "io.github.fuzuliinitiative.Marmara";
const ADDON_FALLBACK_ICON = "chrome://mozapps/skin/extensions/extensionGeneric.svg";
const ADDON_SEARCH_URL = "https://addons.mozilla.org/";
const DEFAULT_THEME_ID = "default-theme@mozilla.org";

// Arayüz dilleri (Marmara yalnızca bunları taşır). Değer: intl.locale.requested.
const LANGUAGES = [
  ["tr", "Türkçe"],
  ["en-US", "English"],
];

// ---------------------------------------------------------------------------
// Ayar bağlayıcıları: her biri { get(), set(değer) } döndürür
// ---------------------------------------------------------------------------

const prefs = Services.prefs;

/** Mantıksal ayar; invert ile tersi gösterilir. Birden fazla ayar yazılabilir. */
function boolPref(name, { invert = false, also = [] } = {}) {
  return {
    get: () => prefs.getBoolPref(name, false) !== invert,
    set: value => {
      for (const pref of [name, ...also]) {
        prefs.setBoolPref(pref, value !== invert);
      }
    },
  };
}

function valuePref(name, onValue, offValue) {
  return {
    get: () => prefs.getIntPref(name, offValue) == onValue,
    set: value => prefs.setIntPref(name, value ? onValue : offValue),
  };
}

const themeBinding = {
  get() {
    if (!prefs.prefHasUserValue(PREF_DARK)) {
      return "auto";
    }
    return prefs.getIntPref(PREF_DARK) == 1 ? "dark" : "light";
  },
  set(value) {
    if (value == "auto") {
      prefs.clearUserPref(PREF_DARK);
    } else {
      prefs.setIntPref(PREF_DARK, value == "dark" ? 1 : 0);
    }
    // Web siteleri her zaman tarayıcının temasını izlesin.
    prefs.clearUserPref(PREF_CONTENT_SCHEME);
  },
};

const { normalizeUrl } = ChromeUtils.importESModule("resource:///modules/MarmaraStartpage.sys.mjs");

// Açılış sayfası: "start" (Marmara başlangıç sayfası), "blank" ya da "custom" (kendi adresi)
const PREF_START_MODE = "marmara.startpage.page";
const PREF_START_URL = "marmara.startpage.url";

function applyStartPage() {
  const mode = prefs.getStringPref(PREF_START_MODE, "start");
  const url = normalizeUrl(prefs.getStringPref(PREF_START_URL, ""));
  const home = mode == "blank" ? "about:blank" : mode == "custom" && url ? url : "about:marmara";
  prefs.setStringPref("browser.startup.homepage", home);
  if (prefs.getIntPref("browser.startup.page", 1) != 3) {
    prefs.setIntPref("browser.startup.page", 1);
  }
}

const startPageBinding = {
  get: () => prefs.getStringPref(PREF_START_MODE, "start"),
  set: value => {
    prefs.setStringPref(PREF_START_MODE, value);
    applyStartPage();
  },
};

const startUrlBinding = {
  get: () => prefs.getStringPref(PREF_START_URL, ""),
  set: value => {
    prefs.setStringPref(PREF_START_URL, value);
    applyStartPage();
  },
};

// Yeni sekme sayfası (uygulama: modules/MarmaraStartpage.sys.mjs)
const newTabPageBinding = {
  get: () => prefs.getStringPref("marmara.newtab.page", "start"),
  set: value => prefs.setStringPref("marmara.newtab.page", value),
};

const newTabUrlBinding = {
  get: () => prefs.getStringPref("marmara.newtab.url", ""),
  set: value => prefs.setStringPref("marmara.newtab.url", value),
};

const PAGE_CHOICES = [
  ["start", "marmara-settings-page-choice-start"],
  ["blank", "marmara-settings-page-choice-blank"],
  ["custom", "marmara-settings-page-choice-custom"],
];

const sessionBinding = {
  get: () => prefs.getIntPref("browser.startup.page", 1) == 3,
  set: value => prefs.setIntPref("browser.startup.page", value ? 3 : 1),
};

const dohBinding = {
  // 0/1 varsayılan, 2 öncelikli, 3 yalnızca, 5 kapalı
  get: () => [2, 3].includes(prefs.getIntPref("network.trr.mode", 0)),
  set: value => prefs.setIntPref("network.trr.mode", value ? 2 : 5),
};

const extensionUpdateBinding = {
  get: () =>
    prefs.getBoolPref("extensions.update.enabled", true) &&
    prefs.getBoolPref("extensions.update.autoUpdateDefault", true),
  set: value => {
    prefs.setBoolPref("extensions.update.enabled", value);
    prefs.setBoolPref("extensions.update.autoUpdateDefault", value);
  },
};

const referrerBinding = {
  get: () => prefs.getIntPref("network.http.referer.XOriginPolicy", 0) == 2,
  set: value => prefs.setIntPref("network.http.referer.XOriginPolicy", value ? 2 : 0),
};

const localeBinding = {
  get() {
    const requested = prefs.getStringPref(PREF_LOCALE, "");
    const first = requested.split(",")[0].trim();
    return LANGUAGES.some(([code]) => code == first) ? first : LANGUAGES[0][0];
  },
  set: value => prefs.setStringPref(PREF_LOCALE, value),
};

// ---------------------------------------------------------------------------
// Eylemler
// ---------------------------------------------------------------------------

function shellService(win) {
  try {
    return win.getShellService?.();
  } catch (e) {
    return null;
  }
}

function isFlatpak() {
  try {
    return Cc["@mozilla.org/gio-service;1"].getService(Ci.nsIGIOService).isRunningUnderFlatpak;
  } catch (e) {
    return false;
  }
}

/** Flatpak'ta kullanıcının yazacağı güncelleme komutu */
const FLATPAK_UPDATE_COMMAND = `flatpak update ${FLATPAK_ID}`;

function copyToClipboard(text) {
  try {
    Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(text);
    return true;
  } catch (e) {
    console.error("Marmara pano:", e);
    return false;
  }
}

const DESKTOP_ID = "marmara.desktop";
const FLATPAK_DEFAULT_COMMAND = `xdg-settings set default-web-browser ${FLATPAK_ID}.desktop`;

/** xdg-settings'i çalıştırır; başarılıysa true */
function runXdgSettings(args) {
  for (const path of ["/usr/bin/xdg-settings", "/bin/xdg-settings"]) {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(path);
    if (!file.exists()) {
      continue;
    }
    const process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    process.init(file);
    process.run(true, args, args.length);
    return process.exitValue == 0;
  }
  return false;
}

/**
 * Marmara'yı varsayılan tarayıcı yapar; sonucu bildiren ileti anahtarını döndürür.
 * Firefox'un kendi yöntemi Linux'ta marmara-bin'e doğrudan işaret eden, simgesiz
 * ve sarmalayıcıyı atlayan geçici bir kayıt (userapp-*.desktop) oluşturduğu için
 * kullanılmaz; gerçek masaüstü kaydı (marmara.desktop) xdg-settings ile seçilir.
 */
function makeDefaultBrowser(win) {
  if (isFlatpak()) {
    // Sandbox'ın dışına çıkmıyoruz: komutu kopyalar, kullanıcı terminalde çalıştırır
    copyToClipboard(FLATPAK_DEFAULT_COMMAND);
    return "make-default-flatpak";
  }
  switch (AppConstants.platform) {
    case "linux":
      return runXdgSettings(["set", "default-web-browser", DESKTOP_ID]) ? "make-default-done" : "make-default-failed";
    case "win": {
      const uri = Services.io.newURI("ms-settings:defaultapps");
      Cc["@mozilla.org/uriloader/external-protocol-service;1"]
        .getService(Ci.nsIExternalProtocolService)
        .loadURI(uri, Services.scriptSecurityManager.getSystemPrincipal());
      return "make-default-windows";
    }
    default:
      shellService(win)?.setDefaultBrowser(false);
      return "make-default-done";
  }
}

async function pickSavePath(win, title, defaultName, filter) {
  const picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  picker.init(win.browsingContext, title, Ci.nsIFilePicker.modeSave);
  picker.appendFilters(filter);
  picker.defaultString = defaultName;
  const result = await new Promise(resolve => picker.open(resolve));
  return result == Ci.nsIFilePicker.returnCancel ? null : picker.file.path;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function exportBookmarks(win) {
  const path = await pickSavePath(win, "", "yer-imleri.html", Ci.nsIFilePicker.filterHTML);
  if (path) {
    const { BookmarkHTMLUtils } = ChromeUtils.importESModule(
      "resource://gre/modules/BookmarkHTMLUtils.sys.mjs"
    );
    await BookmarkHTMLUtils.exportToFile(path);
  }
}

async function exportHistory(win) {
  const path = await pickSavePath(win, "", "gecmis.csv", Ci.nsIFilePicker.filterAll);
  if (!path) {
    return;
  }
  const { PlacesUtils } = ChromeUtils.importESModule("resource://gre/modules/PlacesUtils.sys.mjs");
  const db = await PlacesUtils.promiseDBConnection();
  const rows = await db.execute(
    `SELECT url, title, visit_count, last_visit_date
       FROM moz_places
      WHERE visit_count > 0 AND last_visit_date NOT NULL
      ORDER BY last_visit_date DESC`
  );
  const lines = ["url,title,visit_count,last_visit"];
  for (const row of rows) {
    const when = new Date(row.getResultByName("last_visit_date") / 1000).toISOString();
    lines.push(
      [
        row.getResultByName("url"),
        row.getResultByName("title"),
        row.getResultByName("visit_count"),
        when,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  await IOUtils.writeUTF8(path, "﻿" + lines.join("\r\n") + "\r\n");
}

async function chooseDownloadFolder(win) {
  const picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  picker.init(win.browsingContext, "", Ci.nsIFilePicker.modeGetFolder);
  const result = await new Promise(resolve => picker.open(resolve));
  if (result == Ci.nsIFilePicker.returnOK) {
    prefs.setIntPref("browser.download.folderList", 2);
    prefs.setComplexValue("browser.download.dir", Ci.nsIFile, picker.file);
  }
}

function addSearchEngine(win) {
  win.openDialog(
    "chrome://browser/content/search/addEngine.xhtml",
    "",
    "chrome,modal,centerscreen,resizable=no",
    { mode: "NEW" }
  );
}

/** "1.10" > "1.9": sürüm numaralarını sayı sayı karşılaştırır */
function isNewer(candidate, current) {
  const a = String(candidate).split(".").map(Number);
  const b = String(current).split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff) {
      return diff > 0;
    }
  }
  return false;
}

function currentVersion() {
  const { MARMARA_VERSION } = ChromeUtils.importESModule("resource:///modules/MarmaraAbout.sys.mjs");
  return MARMARA_VERSION;
}

/** { version, url } ya da hata fırlatır */
async function fetchLatest(win) {
  // Yanıt gelmezse (adres yok, ağ kapalı) sonsuza kadar beklemesin
  const controller = new win.AbortController();
  const timer = win.setTimeout(() => controller.abort(), UPDATE_TIMEOUT_MS);
  let info;
  try {
    const response = await win.fetch(`https://api.github.com/repos/${GITHUB_PROJECT}/releases/latest`, {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    info = await response.json();
  } finally {
    win.clearTimeout(timer);
  }
  const version = String(info?.tag_name ?? "").replace(/^v/i, "");
  if (!/^\d+(\.\d+)*$/.test(version)) {
    throw new Error("geçersiz sürüm etiketi");
  }
  // Windows'ta kurulum sihirbazı sürüme eklenmişse doğrudan indirilip kurulabilir
  const asset = (info.assets ?? []).find(a => /-windows-x86_64-setup\.exe$/.test(a?.name ?? ""));
  // Sağlama toplamı (digest) yoksa doğrulanamayacağı için tek tıkla kurulum sunulmaz
  const sha256 = /^sha256:([0-9a-f]{64})$/.exec(asset?.digest ?? "")?.[1];
  const installer =
    sha256 && String(asset.browser_download_url).startsWith(`https://github.com/${GITHUB_PROJECT}/releases/download/`)
      ? { url: asset.browser_download_url, sha256 }
      : null;
  return { version, url: `https://github.com/${GITHUB_PROJECT}/releases/latest`, installer };
}

/**
 * Tek tıkla güncelleme yalnızca Windows'ta, Marmara kurulum sihirbazıyla
 * kurulmuşsa (uninstall.exe yanında) yapılır; zip'ten açılmış kopyada yalnızca
 * sürüm sayfası açılır.
 */
function canSelfUpdate() {
  if (AppConstants.platform != "win") {
    return false;
  }
  try {
    const exe = Services.dirsvc.get("XREExeF", Ci.nsIFile);
    const uninstaller = exe.parent.clone();
    uninstaller.append("uninstall.exe");
    return uninstaller.exists();
  } catch (e) {
    return false;
  }
}

/** Kurulum sihirbazını indirir (onProgress(0..1)), sağlama toplamını doğrular, dosya yolunu döndürür */
async function downloadInstaller(installer, onProgress) {
  const { Downloads } = ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs");
  // Tahmin edilemeyen klasör: başka bir işlem dosyayı doğrulamadan sonra değiştiremesin
  const dir = PathUtils.join(PathUtils.tempDir, `marmara-update-${Services.uuid.generateUUID().toString().slice(1, -1)}`);
  await IOUtils.makeDirectory(dir, { permissions: 0o700 });
  const target = PathUtils.join(dir, "Marmara-Setup.exe");
  const download = await Downloads.createDownload({
    source: { url: installer.url, isPrivate: true },
    target,
  });
  download.onchange = () => onProgress(download.progress / 100);
  await download.start();

  {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(target);
    const stream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
    stream.init(file, -1, 0, 0);
    const hash = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
    hash.init(hash.SHA256);
    hash.updateFromStream(stream, 0xffffffff);
    const raw = hash.finish(false);
    stream.close();
    const hex = Array.from(raw, c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    if (hex != installer.sha256) {
      await IOUtils.remove(target, { ignoreAbsent: true });
      throw new Error("sağlama toplamı uyuşmuyor");
    }
  }
  return target;
}

/** Sihirbazı sessizce başlatır; Marmara kapanınca kurar ve yeniden açar */
function runInstallerAndQuit(path) {
  const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  file.initWithPath(path);
  const process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
  process.init(file);
  process.runw(false, ["/S", "/RELAUNCH"], 2);
  Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);
}

function restartBrowser() {
  Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
}

// ---------------------------------------------------------------------------
// Sayfa tanımları
//
// Satır türleri:
//   switch   { k, bind, sub? }                 aç/kapa
//   choice   { k, bind, options: [[değer, iletiAnahtarı|metin]], sub? }
//   segments { k, bind, options }              yan yana seçenek düğmeleri
//   engine   { k }                             arama motoru seçicisi (özel)
//   button   { k, run(win), icon, sub?, show?(win) }
//   addons   { kind: "extension" | "plugin", emptyKey? }   kurulu uzantı / yan uygulama listesi
//   addon-search { k }                         addons.mozilla.org'da arama (kullanıcı başlatınca)
// Metinler: marmara-settings-<k>, açıklama için marmara-settings-<k>-sub
// ---------------------------------------------------------------------------

const PAGES = [
  {
    id: "general",
    icon: "general",
    groups: [
      {
        k: "default-browser",
        rows: [
          {
            type: "button",
            k: "make-default",
            sub: true,
            icon: "arrow-right",
            run: async (win, row) => {
              const message = makeDefaultBrowser(win);
              const sub = row.querySelector(".marmara-settings-sub");
              sub.setAttribute("data-l10n-id", id(message));
              sub.setAttribute("data-l10n-args", JSON.stringify({ command: FLATPAK_DEFAULT_COMMAND }));
              win.document.l10n.translateFragment(row);
            },
          },
        ],
      },
      {
        k: "appearance",
        rows: [
          {
            type: "segments",
            k: "theme",
            bind: themeBinding,
            options: [
              ["auto", "marmara-settings-theme-auto"],
              ["light", "marmara-settings-theme-light"],
              ["dark", "marmara-settings-theme-dark"],
            ],
          },
        ],
      },
      {
        k: "search",
        rows: [
          { type: "engine", k: "engine", sub: true },
          {
            type: "switch",
            k: "suggestions",
            bind: boolPref("browser.search.suggest.enabled"),
          },
          { type: "button", k: "add-engine", icon: "arrow-right", run: addSearchEngine },
        ],
      },
      {
        k: "updates",
        show: () => !!GITHUB_PROJECT,
        rows: [{ type: "update", k: "update" }],
      },
      {
        k: "language",
        rows: [
          {
            type: "choice",
            k: "ui-language",
            bind: localeBinding,
            options: LANGUAGES,
            restart: true,
          },
        ],
      },
    ],
  },
  {
    id: "startup",
    icon: "startup",
    groups: [
      {
        k: "startup",
        rows: [
          { type: "choice", k: "start-page", sub: true, bind: startPageBinding, options: PAGE_CHOICES },
          { type: "text", k: "start-page-url", bind: startUrlBinding, show: () => startPageBinding.get() == "custom" },
          { type: "choice", k: "new-tab-page", sub: true, bind: newTabPageBinding, options: PAGE_CHOICES },
          { type: "text", k: "new-tab-page-url", bind: newTabUrlBinding, show: () => newTabPageBinding.get() == "custom" },
          { type: "switch", k: "restore-session", bind: sessionBinding },
          { type: "switch", k: "warn-close", bind: boolPref("browser.tabs.warnOnClose") },
          {
            type: "switch",
            k: "recent-tabs",
            sub: true,
            bind: boolPref("browser.ctrlTab.sortByRecentlyUsed"),
          },
        ],
      },
    ],
  },
  {
    id: "privacy",
    icon: "privacy",
    groups: [
      {
        k: "tosdr",
        rows: [{ type: "switch", k: "tosdr", sub: true, bind: boolPref("marmara.tosdr.enabled") }],
      },
      {
        k: "tracking",
        rows: [
          {
            type: "switch",
            k: "gpc",
            sub: true,
            bind: boolPref("privacy.globalprivacycontrol.enabled", {
              also: ["privacy.globalprivacycontrol.functionality.enabled"],
            }),
          },
          {
            type: "switch",
            k: "fingerprint",
            sub: true,
            bind: boolPref("privacy.resistFingerprinting"),
          },
          {
            type: "switch",
            k: "letterboxing",
            sub: true,
            bind: boolPref("privacy.resistFingerprinting.letterboxing"),
          },
          { type: "switch", k: "referrer", sub: true, bind: referrerBinding },
        ],
      },
      {
        k: "connection",
        rows: [
          { type: "switch", k: "https-only", sub: true, bind: boolPref("dom.security.https_only_mode") },
          { type: "switch", k: "doh", sub: true, bind: dohBinding },
          { type: "switch", k: "ipv6", bind: boolPref("network.dns.disableIPv6", { invert: true }) },
        ],
      },
      {
        k: "data",
        rows: [
          { type: "switch", k: "remember-history", bind: boolPref("places.history.enabled") },
          { type: "switch", k: "update-addons", sub: true, bind: extensionUpdateBinding },
          {
            type: "button",
            k: "clear-data",
            icon: "arrow-right",
            run: win => win.Sanitizer.showUI(win),
          },
        ],
      },
    ],
  },
  {
    id: "passwords",
    icon: "passwords",
    groups: [
      {
        k: "passwords",
        rows: [
          { type: "switch", k: "save-logins", bind: boolPref("signon.rememberSignons") },
          {
            type: "switch",
            k: "autofill-addresses",
            bind: boolPref("extensions.formautofill.addresses.enabled"),
          },
          {
            type: "switch",
            k: "autofill-cards",
            bind: boolPref("extensions.formautofill.creditCards.enabled"),
          },
          {
            type: "button",
            k: "saved-logins",
            icon: "arrow-right",
            run: (win, row) => {
              // Parolalar yan panelde açılır; arkada kalmasın diye ayarlar kapanır
              row.closest("dialog")?.close();
              win.SidebarController.show("viewCPMSidebar");
            },
          },
        ],
      },
    ],
  },
  {
    id: "downloads",
    icon: "downloads",
    groups: [
      {
        k: "downloads",
        rows: [
          {
            type: "switch",
            k: "ask-download",
            bind: boolPref("browser.download.useDownloadDir", { invert: true }),
          },
          {
            type: "button",
            k: "download-folder",
            icon: "arrow-right",
            run: chooseDownloadFolder,
          },
        ],
      },
    ],
  },
  {
    id: "extensions",
    icon: "extensions",
    groups: [
      { k: "extensions", rows: [{ type: "addons", kind: "extension", emptyKey: "addons-empty" }] },
      // Yan uygulamalar (Firefox'un "eklentiler"i: OpenH264, Widevine gibi); yoksa grup gizlenir
      {
        k: "plugins",
        show: (_win, dialog) => dialog.addonCounts.plugin > 0,
        rows: [{ type: "addons", kind: "plugin" }],
      },
      // Temalar: en üstte varsayılan tema, ardından kullanıcının kurduklarıyla
      { k: "themes", rows: [{ type: "addons", kind: "theme" }] },
      { k: "find-extensions", rows: [{ type: "addon-search", k: "addon-search", sub: true }] },
    ],
  },
  {
    id: "data",
    icon: "data",
    groups: [
      {
        k: "import-export",
        rows: [
          {
            type: "button",
            k: "import",
            icon: "arrow-right",
            run: (win, row) => {
              const { MigrationUtils } = ChromeUtils.importESModule(
                "resource:///modules/MigrationUtils.sys.mjs"
              );
              // Ayarlar kapanır; sihirbaz about:preferences yerine kendi
              // penceresinde açılır (opener verilmezse bağımsız pencere kullanılır)
              row.closest("dialog")?.close();
              MigrationUtils.showMigrationWizard(win, {
                entrypoint: MigrationUtils.MIGRATION_ENTRYPOINTS.FILE_MENU,
              });
            },
          },
          { type: "button", k: "export-bookmarks", icon: "arrow-right", run: exportBookmarks },
          { type: "button", k: "export-history", icon: "arrow-right", run: exportHistory },
        ],
      },
    ],
  },
];

// Firefox'un eski bölüm adlarını yeni sayfalara eşler (openPreferences("paneX"))
const PANE_ALIASES = [
  [/privacy|security|etp|doh/i, "privacy"],
  [/home|startup|tabs/i, "startup"],
  [/passwords|autofill|logins/i, "passwords"],
  [/download|applications/i, "downloads"],
  [/sync|import|backup/i, "data"],
  [/extensions|addons|plugins/i, "extensions"],
];

// ---------------------------------------------------------------------------
// Arayüz
// ---------------------------------------------------------------------------

function create(doc, tag, { className, l10n, text, attrs } = {}, ...children) {
  const node = doc.createElementNS(HTML_NS, tag);
  if (className) {
    node.className = className;
  }
  if (l10n) {
    node.setAttribute("data-l10n-id", l10n);
  }
  if (text) {
    node.textContent = text;
  }
  for (const [name, value] of Object.entries(attrs ?? {})) {
    node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

// Aramada süzülen satırlar (yeniden başlatma uyarısı hariç)
const ROWS = ".marmara-settings-card > :not(.marmara-settings-notice)";

const id = key => `marmara-settings-${key}`;

class SettingsDialog {
  constructor(win) {
    this.win = win;
    this.doc = win.document;
    this.pages = new Map(); // sayfa kimliği -> { button, section }
    this.rules = [];
    this.addonCounts = {}; // tür -> kurulu sayısı (grup görünürlüğü için)
    this.cleanups = []; // pencere kapanınca çalışır
  }

  icon(name, className = "marmara-settings-icon") {
    return create(this.doc, "img", { className, attrs: { src: ICON(name), alt: "" } });
  }

  /** Satırın başlığı ve (varsa) açıklaması */
  #labels(spec) {
    const labels = create(
      this.doc,
      "div",
      { className: "marmara-settings-labels" },
      create(this.doc, "span", { className: "marmara-settings-title", l10n: id(spec.k) })
    );
    if (spec.sub) {
      labels.append(create(this.doc, "span", { className: "marmara-settings-sub", l10n: id(`${spec.k}-sub`) }));
    }
    return labels;
  }

  #row(spec, ...children) {
    return create(this.doc, "div", { className: "marmara-settings-row" }, this.#labels(spec), ...children);
  }

  #switchRow(spec) {
    const toggle = create(this.doc, "button", {
      className: "marmara-switch",
      attrs: { type: "button", role: "switch", "aria-checked": String(spec.bind.get()) },
    }, create(this.doc, "span", { className: "marmara-switch-knob" }));
    const row = this.#row(spec, toggle);
    row.classList.add("clickable");
    const flip = () => {
      const next = toggle.getAttribute("aria-checked") != "true";
      try {
        spec.bind.set(next);
      } catch (e) {
        console.error("Marmara ayarlar:", e);
      }
      toggle.setAttribute("aria-checked", String(spec.bind.get()));
    };
    row.addEventListener("click", event => {
      if (event.target != toggle && !toggle.contains(event.target)) {
        flip();
      }
    });
    toggle.addEventListener("click", flip);
    return row;
  }

  #restartNotice() {
    const notice = create(
      this.doc,
      "div",
      { className: "marmara-settings-row marmara-settings-notice", attrs: { hidden: "" } },
      create(this.doc, "span", { l10n: id("restart-needed") })
    );
    const button = create(this.doc, "button", {
      className: "marmara-settings-pill suggested",
      l10n: id("restart"),
      attrs: { type: "button" },
    });
    button.addEventListener("click", restartBrowser);
    notice.append(button);
    return notice;
  }

  #selectControl(options, current, onChange) {
    const select = create(this.doc, "select", { className: "marmara-settings-select" });
    for (const [value, label] of options) {
      const option = create(this.doc, "option", { attrs: { value } });
      if (label.startsWith("marmara-")) {
        option.setAttribute("data-l10n-id", label);
      } else {
        option.textContent = label;
      }
      select.append(option);
    }
    select.value = current;
    select.addEventListener("change", () => onChange(select.value));
    return select;
  }

  #choiceRows(spec) {
    const select = this.#selectControl(spec.options, spec.bind.get(), value => {
      spec.bind.set(value);
      if (notice) {
        notice.hidden = false;
      }
      this.#applyRules(); // bağlı satırlar (örn. özel adres kutusu) güncellensin
    });
    const notice = spec.restart ? this.#restartNotice() : null;
    return [this.#row(spec, select), ...(notice ? [notice] : [])];
  }

  /** Adres kutusu: yalnızca geçerli http(s) adresi kaydedilir; geçersizse kırmızı çerçeve */
  #textRow(spec) {
    const input = create(this.doc, "input", {
      className: "marmara-settings-input",
      attrs: { type: "text", spellcheck: "false", autocomplete: "off", placeholder: "https://example.com" },
    });
    input.value = spec.bind.get();
    const commit = () => {
      const raw = input.value.trim();
      const url = raw ? normalizeUrl(raw) : "";
      if (url === null) {
        input.setAttribute("aria-invalid", "true");
        return;
      }
      input.removeAttribute("aria-invalid");
      input.value = url;
      spec.bind.set(url);
    };
    input.addEventListener("change", commit);
    input.addEventListener("keydown", event => {
      if (event.key == "Enter") {
        commit();
        input.blur();
      }
    });
    const row = this.#row(spec, input);
    if (spec.show) {
      this.rules.push(() => {
        row.dataset.hiddenByRule = spec.show() ? "0" : "1";
        row.hidden = row.dataset.hiddenByRule == "1";
      });
    }
    return row;
  }

  #segmentsRow(spec) {
    const strip = create(this.doc, "div", { className: "marmara-settings-segments", attrs: { role: "radiogroup" } });
    const sync = () => {
      for (const button of strip.children) {
        button.setAttribute("aria-checked", String(button.dataset.value == spec.bind.get()));
      }
    };
    for (const [value, label] of spec.options) {
      const button = create(this.doc, "button", {
        className: "marmara-settings-segment",
        l10n: label,
        attrs: { type: "button", role: "radio", "data-value": value },
      });
      button.addEventListener("click", () => {
        spec.bind.set(value);
        sync();
      });
      strip.append(button);
    }
    sync();
    return this.#row(spec, strip);
  }

  #engineRow(spec) {
    const select = this.#selectControl([], "", () => {});
    const row = this.#row(spec, select);
    (async () => {
      try {
        const { SearchService } = ChromeUtils.importESModule(
          "moz-src:///toolkit/components/search/SearchService.sys.mjs"
        );
        await SearchService.init();
        const engines = await SearchService.getVisibleEngines();
        const current = await SearchService.getDefault();
        for (const engine of engines) {
          const option = create(this.doc, "option", { text: engine.name, attrs: { value: engine.id } });
          select.append(option);
        }
        select.value = current.id;
        select.addEventListener("change", async () => {
          const engine = engines.find(e => e.id == select.value);
          if (engine) {
            const reason = SearchService.CHANGE_REASON.USER;
            await SearchService.setDefault(engine, reason);
            await SearchService.setDefaultPrivate(engine, reason);
          }
        });
      } catch (e) {
        console.error("Marmara ayarlar (arama motorları):", e);
      }
    })();
    return row;
  }

  #buttonRow(spec) {
    const row = create(
      this.doc,
      "button",
      { className: "marmara-settings-row clickable action", attrs: { type: "button" } },
      this.#labels(spec),
      this.icon(spec.icon ?? "arrow-right")
    );
    row.addEventListener("click", async () => {
      try {
        await spec.run(this.win, row);
      } catch (e) {
        console.error("Marmara ayarlar:", e);
      }
      this.#applyRules();
    });
    return row;
  }

  /** Sürüm durumu + "Denetle" / "İndir" düğmesi */
  #updateRow(spec) {
    const version = currentVersion();
    const title = create(this.doc, "span", { className: "marmara-settings-title", l10n: id("update"), attrs: { "data-l10n-args": JSON.stringify({ version }) } });
    const status = create(this.doc, "span", { className: "marmara-settings-sub", l10n: id("update-idle") });
    const labels = create(this.doc, "div", { className: "marmara-settings-labels" }, title, status);
    const button = create(this.doc, "button", { className: "marmara-settings-pill", l10n: id("update-check"), attrs: { type: "button" } });
    const row = create(this.doc, "div", { className: "marmara-settings-row" }, labels, button);

    let downloadUrl = null;
    let installer = null;
    let availableVersion = null;
    const setState = (state, args = {}) => {
      status.setAttribute("data-l10n-id", id(`update-${state}`));
      status.setAttribute("data-l10n-args", JSON.stringify(args));
      const flatpak = isFlatpak();
      if (state == "available" && flatpak) {
        status.setAttribute("data-l10n-id", id("update-available-flatpak"));
        status.setAttribute("data-l10n-args", JSON.stringify({ ...args, command: FLATPAK_UPDATE_COMMAND }));
      }
      const download = flatpak ? "update-copy-command" : installer && canSelfUpdate() ? "update-install" : "update-download";
      button.setAttribute("data-l10n-id", id(state == "available" ? download : "update-check"));
      button.classList.toggle("suggested", state == "available");
      button.disabled = state == "checking";
      this.doc.l10n.translateFragment(row);
    };

    button.addEventListener("click", async () => {
      if (downloadUrl) {
        if (isFlatpak()) {
          // Flatpak'ta güncelleme Flatpak'ın kendi komutuyla yapılır (sandbox'ı delmiyoruz)
          if (copyToClipboard(FLATPAK_UPDATE_COMMAND)) {
            button.setAttribute("data-l10n-id", id("update-copied"));
            this.doc.l10n.translateFragment(row);
          } else {
            this.win.openTrustedLinkIn(downloadUrl, "tab");
            this.close();
          }
          return;
        }
        if (installer && canSelfUpdate()) {
          button.disabled = true;
          status.setAttribute("data-l10n-id", id("update-downloading"));
          status.setAttribute("data-l10n-args", JSON.stringify({ percent: 0 }));
          this.doc.l10n.translateFragment(row);
          try {
            const path = await downloadInstaller(installer, fraction => {
              status.setAttribute("data-l10n-args", JSON.stringify({ percent: Math.round(fraction * 100) }));
              this.doc.l10n.translateFragment(status);
            });
            status.setAttribute("data-l10n-id", id("update-installing"));
            this.doc.l10n.translateFragment(status);
            runInstallerAndQuit(path);
          } catch (e) {
            console.error("Marmara güncelleme indirme:", e);
            // Olmazsa elle indirme sayfasına düşer
            installer = null;
            button.disabled = false;
            setState("available", { version: availableVersion });
            this.win.openTrustedLinkIn(downloadUrl, "tab");
          }
          return;
        }
        this.win.openTrustedLinkIn(downloadUrl, "tab");
        this.close();
        return;
      }
      setState("checking");
      try {
        const info = await fetchLatest(this.win);
        if (isNewer(info.version, version)) {
          downloadUrl = info.url;
          installer = info.installer;
          availableVersion = info.version;
          setState("available", { version: info.version });
        } else {
          setState("current");
        }
      } catch (e) {
        console.error("Marmara güncelleme denetimi:", e);
        setState("error");
      }
    });
    return row;
  }

  /** addons.mozilla.org'da arama: yalnızca kullanıcı aramayı başlatınca bir sekme açar */
  #addonSearchRow(spec) {
    const input = create(this.doc, "input", {
      className: "marmara-settings-input",
      attrs: {
        type: "search",
        autocomplete: "off",
        spellcheck: "false",
        "data-l10n-id": id("addon-search-placeholder"),
        "data-l10n-attrs": "placeholder, aria-label",
      },
    });
    const button = create(this.doc, "button", {
      className: "marmara-settings-pill suggested",
      l10n: id("addon-search-button"),
      attrs: { type: "button" },
    });
    const go = () => {
      const query = input.value.trim();
      const base = `${ADDON_SEARCH_URL}${Services.locale.appLocaleAsBCP47}/firefox/`;
      this.win.openTrustedLinkIn(query ? `${base}search/?q=${encodeURIComponent(query)}` : base, "tab");
      this.close();
    };
    button.addEventListener("click", go);
    input.addEventListener("keydown", event => {
      if (event.key == "Enter") {
        go();
      }
    });
    const row = this.#row(spec, input, button);
    row.classList.add("marmara-settings-addon-search");
    return row;
  }

  /** Sistem iletişim kutusu yerine ayarların kendi temasında onay kutusu */
  #confirm(message) {
    return new Promise(resolve => {
      const text = create(this.doc, "p", { className: "marmara-settings-confirm-text", text: message });
      const cancel = create(this.doc, "button", {
        className: "marmara-settings-pill", l10n: id("confirm-cancel"), attrs: { type: "button" } });
      const ok = create(this.doc, "button", {
        className: "marmara-settings-pill suggested destructive", l10n: id("confirm-remove"), attrs: { type: "button" } });
      const box = create(this.doc, "dialog", { className: "marmara-settings-confirm" },
        text, create(this.doc, "div", { className: "marmara-settings-confirm-buttons" }, cancel, ok));
      let result = false;
      cancel.addEventListener("click", () => box.close());
      ok.addEventListener("click", () => {
        result = true;
        box.close();
      });
      box.addEventListener("close", () => {
        box.remove();
        resolve(result);
      });
      // Esc yalnızca bu kutuyu kapatsın, ayarları değil
      box.addEventListener("keydown", event => event.stopPropagation());
      this.dialog.append(box);
      this.doc.l10n.translateFragment(box);
      box.showModal();
      cancel.focus();
    });
  }

  /** Kurulu uzantılar / yan uygulamalar; AddonManager değişince kendini yeniler */
  #addonList(card, spec) {
    const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
    let latest = 0;
    const render = async () => {
      const mine = ++latest;
      const addons = (await AddonManager.getAddonsByTypes([spec.kind]))
        // Temalarda yalnızca varsayılan tema ve kullanıcının kurdukları listelenir
        .filter(addon => !addon.hidden && (spec.kind != "theme" || addon.id == DEFAULT_THEME_ID || !addon.isBuiltin))
        .sort((a, b) =>
          (b.id == DEFAULT_THEME_ID) - (a.id == DEFAULT_THEME_ID) || a.name.localeCompare(b.name));
      if (mine != latest || !this.dialog?.isConnected) {
        return;
      }
      const rows = addons.map(addon => this.#addonRow(addon, AddonManager));
      if (!rows.length && spec.emptyKey) {
        rows.push(
          create(this.doc, "div", { className: "marmara-settings-row" },
            create(this.doc, "span", { className: "marmara-settings-sub", l10n: id(spec.emptyKey) }))
        );
      }
      card.replaceChildren(...rows);
      this.addonCounts[spec.kind] = addons.length;
      this.doc.l10n.translateFragment(card);
      this.#applyRules();
      if (this.search.value) {
        this.#filter(this.search.value);
      }
    };
    let timer = 0;
    const schedule = () => {
      this.win.clearTimeout(timer);
      timer = this.win.setTimeout(render, 150);
    };
    const listener = {
      onEnabled: schedule,
      onDisabled: schedule,
      onInstalled: schedule,
      onUninstalled: schedule,
    };
    AddonManager.addAddonListener(listener);
    this.cleanups.push(() => {
      this.win.clearTimeout(timer);
      AddonManager.removeAddonListener(listener);
    });
    // Sayfa kurulurken henüz pencerede değiliz; açılınca ilk çizim
    this.win.setTimeout(render, 0);
  }

  #addonRow(addon, AddonManager) {
    const canDisable = !!(addon.permissions & AddonManager.PERM_CAN_DISABLE);
    const canRemove = !!(addon.permissions & AddonManager.PERM_CAN_UNINSTALL);

    const labels = create(this.doc, "div", { className: "marmara-settings-labels" },
      create(this.doc, "span", { className: "marmara-settings-title", text: addon.name }),
      create(this.doc, "span", {
        className: "marmara-settings-sub",
        l10n: id("addon-version"),
        attrs: { "data-l10n-args": JSON.stringify({ version: addon.version }) },
      }));
    if (addon.description) {
      labels.title = addon.description;
    }
    const iconUrl = addon.iconURL || addon.icons?.[32] || ADDON_FALLBACK_ICON;
    const head = create(this.doc, "div", { className: "marmara-settings-addon-head" },
      create(this.doc, "img", { className: "marmara-settings-addon-icon", attrs: { src: iconUrl, alt: "" } }),
      labels);

    const actions = create(this.doc, "div", { className: "marmara-settings-addon-actions" });
    const iconButton = (name, l10n, onClick) => {
      const button = create(this.doc, "button", {
        className: "marmara-settings-round flat",
        l10n,
        attrs: { type: "button", "data-l10n-attrs": "title, aria-label" },
      }, this.icon(name));
      button.addEventListener("click", onClick);
      return button;
    };
    if (addon.optionsURL && addon.isActive) {
      actions.append(
        iconButton("settings", id("addon-options"), () => {
          this.win.openTrustedLinkIn(addon.optionsURL, "tab");
          this.close();
        })
      );
    }
    if (canRemove) {
      actions.append(
        iconButton("delete", id("addon-remove"), async () => {
          const message = await this.doc.l10n.formatValue(
            id(addon.type == "theme" ? "addon-remove-theme-confirm" : "addon-remove-confirm"),
            { name: addon.name }
          );
          if (await this.#confirm(message)) {
            await addon.uninstall();
          }
        })
      );
    }
    if (addon.type == "theme") {
      // Tema: anahtar yerine "Kullan" düğmesi; etkin olan işaretlenir
      const use = create(this.doc, "button", {
        className: "marmara-settings-pill" + (addon.isActive ? "" : " suggested"),
        l10n: id(addon.isActive ? "addon-theme-active" : "addon-theme-use"),
        attrs: { type: "button" },
      });
      use.disabled = addon.isActive;
      use.addEventListener("click", async () => {
        use.disabled = true;
        try {
          await addon.enable();
        } catch (e) {
          console.error("Marmara ayarlar (tema):", e);
        }
      });
      actions.append(use);
      return create(this.doc, "div", { className: "marmara-settings-row" }, head, actions);
    }
    const toggle = create(this.doc, "button", {
      className: "marmara-switch",
      attrs: { type: "button", role: "switch", "aria-checked": String(addon.isActive), "aria-label": addon.name },
    }, create(this.doc, "span", { className: "marmara-switch-knob" }));
    toggle.disabled = !canDisable;
    toggle.addEventListener("click", async () => {
      toggle.disabled = true;
      try {
        await (addon.isActive ? addon.disable() : addon.enable());
      } catch (e) {
        console.error("Marmara ayarlar (eklenti):", e);
      }
      toggle.setAttribute("aria-checked", String(addon.isActive));
      toggle.disabled = !canDisable;
    });
    actions.append(toggle);

    return create(this.doc, "div", { className: "marmara-settings-row" }, head, actions);
  }

  #rows(spec) {
    switch (spec.type) {
      case "switch":
        return [this.#switchRow(spec)];
      case "choice":
        return this.#choiceRows(spec);
      case "segments":
        return [this.#segmentsRow(spec)];
      case "text":
        return [this.#textRow(spec)];
      case "engine":
        return [this.#engineRow(spec)];
      case "button":
        return [this.#buttonRow(spec)];
      case "update":
        return [this.#updateRow(spec)];
      case "addon-search":
        return [this.#addonSearchRow(spec)];
      default:
        return [];
    }
  }

  #group(spec) {
    const card = create(this.doc, "div", { className: "marmara-settings-card" });
    for (const row of spec.rows) {
      if (row.type == "addons") {
        this.#addonList(card, row);
      } else {
        card.append(...this.#rows(row));
      }
    }
    const group = create(
      this.doc,
      "section",
      { className: "marmara-settings-group" },
      create(this.doc, "h2", { l10n: id(`group-${spec.k}`) }),
      card
    );
    if (spec.show) {
      // Koşullu grup: ayar değişince yeniden değerlendirilir (örn. varsayılan yapıldıktan sonra gizlenir)
      this.rules.push(() => {
        group.dataset.hiddenByRule = spec.show(this.win, this) ? "0" : "1";
        group.hidden = group.dataset.hiddenByRule == "1" || this.dialog.classList.contains("searching");
      });
    }
    group.dataset.hiddenByRule = "0";
    return group;
  }

  #page(spec) {
    const button = create(
      this.doc,
      "button",
      { className: "marmara-settings-nav", attrs: { type: "button", role: "tab" } },
      this.icon(spec.icon),
      create(this.doc, "span", { l10n: id(`page-${spec.id}`) })
    );
    button.addEventListener("click", () => this.showPage(spec.id));
    const section = create(
      this.doc,
      "div",
      { className: "marmara-settings-page", attrs: { role: "tabpanel", hidden: "" } },
      ...spec.groups.map(group => this.#group(group))
    );
    this.pages.set(spec.id, { button, section });
    return { button, section };
  }

  showPage(pageId) {
    this.search.value = "";
    this.#filter("");
    for (const [key, { button, section }] of this.pages) {
      const active = key == pageId;
      section.hidden = !active;
      button.setAttribute("aria-selected", String(active));
    }
    this.title.setAttribute("data-l10n-id", id(`page-${pageId}`));
    this.doc.l10n.translateFragment(this.title);
    this.content.scrollTop = 0;
  }

  /** Arama: tüm sayfalarda eşleşen satırları gösterir */
  #filter(query) {
    const needle = query.trim().toLocaleLowerCase();
    this.dialog.classList.toggle("searching", !!needle);
    this.empty.hidden = true;
    if (!needle) {
      for (const el of this.dialog.querySelectorAll(ROWS)) {
        el.hidden = el.dataset.hiddenByRule == "1";
      }
      for (const group of this.dialog.querySelectorAll(".marmara-settings-group")) {
        group.hidden = group.dataset.hiddenByRule == "1";
      }
      return;
    }
    let found = 0;
    for (const [, { section }] of this.pages) {
      section.hidden = false;
      for (const group of section.querySelectorAll(".marmara-settings-group")) {
        let visibleRows = 0;
        for (const row of group.querySelectorAll(ROWS)) {
          const match = row.dataset.hiddenByRule != "1" && row.textContent.toLocaleLowerCase().includes(needle);
          row.hidden = !match;
          visibleRows += match ? 1 : 0;
        }
        group.hidden = visibleRows == 0 || group.dataset.hiddenByRule == "1";
        found += group.hidden ? 0 : visibleRows;
      }
    }
    for (const { button } of this.pages.values()) {
      button.setAttribute("aria-selected", "false");
    }
    this.title.setAttribute("data-l10n-id", id("search-results"));
    this.doc.l10n.translateFragment(this.title);
    this.empty.hidden = found > 0;
  }

  #applyRules() {
    for (const rule of this.rules) {
      rule();
    }
  }

  close() {
    this.dialog?.close();
  }

  open(startPage) {
    const { doc } = this;

    const nav = create(doc, "nav", { className: "marmara-settings-sidebar", attrs: { role: "tablist" } });
    this.content = create(doc, "div", { className: "marmara-settings-content" });
    this.empty = create(doc, "p", {
      className: "marmara-settings-empty",
      l10n: id("no-results"),
      attrs: { hidden: "" },
    });
    this.content.append(this.empty);
    for (const spec of PAGES) {
      const { button, section } = this.#page(spec);
      nav.append(button);
      this.content.append(section);
    }
    this.search = create(doc, "input", {
      className: "marmara-settings-search",
      attrs: { type: "search", autocomplete: "off", "data-l10n-id": id("search"), "data-l10n-attrs": "placeholder, aria-label" },
    });
    this.search.addEventListener("input", () => this.#filter(this.search.value));

    const close = create(
      doc,
      "button",
      { className: "marmara-settings-round", l10n: id("close"), attrs: { type: "button" } },
      this.icon("close")
    );
    close.addEventListener("click", () => this.close());

    this.title = create(doc, "h1", { className: "marmara-settings-heading" });
    const header = create(doc, "header", { className: "marmara-settings-header" }, this.title, close);
    const side = create(doc, "div", { className: "marmara-settings-side" }, this.search, nav);
    const main = create(doc, "main", { className: "marmara-settings-main" }, header, this.content);

    this.dialog = create(
      doc,
      "dialog",
      { className: "marmara-settings-dialog", attrs: { "aria-labelledby": "marmara-settings-heading" } },
      side,
      main
    );
    this.title.id = "marmara-settings-heading";
    this.dialog.addEventListener("click", event => {
      if (event.target == this.dialog) {
        this.close();
      }
    });
    this.dialog.addEventListener("close", () => {
      for (const cleanup of this.cleanups) {
        cleanup();
      }
      this.dialog.remove();
    });

    this.#applyRules();
    doc.documentElement.append(this.dialog);
    doc.l10n.translateFragment(this.dialog);
    this.showPage(PAGES.some(p => p.id == startPage) ? startPage : PAGES[0].id);
    this.dialog.showModal();
  }
}

const MIGRATION_URL = "chrome://browser/content/migration/migration-dialog-window.html";

/**
 * İçe aktarma sihirbazı: ayrı bir sistem penceresi yerine tarayıcı penceresinin
 * içinde, Ayarlar gibi yuvarlak köşeli bir kutuda açılır. Sihirbazın kendi sayfası
 * (migration-dialog-window.html) bir iframe içinde yüklenir; sayfanın iframe'de
 * çalışması için omni.ja'da yamalanır (scripts/patch_omni.py).
 */
function showMigrationDialog(win, options = {}) {
  const doc = win.document;
  if (doc.querySelector("dialog.marmara-migration-dialog")) {
    return;
  }
  const frame = create(doc, "iframe", { className: "marmara-migration-frame", attrs: { title: "" } });
  frame.addEventListener("MarmaraMigrationClose", () => dialog.close());
  const close = create(doc, "button", {
    className: "marmara-settings-round",
    l10n: id("close"),
    attrs: { type: "button", "data-l10n-attrs": "title, aria-label" },
  }, create(doc, "img", { className: "marmara-settings-icon", attrs: { src: ICON("close"), alt: "" } }));
  close.addEventListener("click", () => dialog.close());
  const dialog = create(doc, "dialog", { className: "marmara-migration-dialog" },
    create(doc, "div", { className: "marmara-migration-head" }, close), frame);
  dialog.addEventListener("close", () => dialog.remove());
  win.MozXULElement.insertFTLIfNeeded("browser/marmara.ftl");
  // Sayfa alanının (araç çubuklarının altı) ortasına yerleş
  try {
    const rect = win.gBrowser.selectedBrowser.getBoundingClientRect();
    dialog.style.insetBlock = `${Math.round(rect.top)}px ${Math.max(0, Math.round(win.innerHeight - rect.bottom))}px`;
  } catch (e) {
    // ölçülemezse pencerenin ortası
  }
  doc.documentElement.append(dialog);
  doc.l10n.translateFragment(dialog);
  // Sayfa kendi seçeneklerini window.arguments'tan okur; iframe'de bu yok,
  // bu yüzden yamalı sayfa seçenekleri üst pencereden alır.
  frame.marmaraMigrationOptions = options;
  frame.src = MIGRATION_URL;
  dialog.showModal();
}

/** İndirilenler: tarayıcı içinde, Ayarlar gibi yuvarlak köşeli kutuda */
function showDownloadsDialog(win) {
  const doc = win.document;
  const existing = doc.querySelector("dialog.marmara-downloads-dialog");
  if (existing) {
    existing.querySelector("iframe")?.focus();
    return;
  }
  const frame = create(doc, "iframe", { className: "marmara-panel-frame marmara-downloads-frame" });
  const dialog = create(doc, "dialog", { className: "marmara-downloads-dialog" }, frame);
  frame.addEventListener("MarmaraPanelClose", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove());
  try {
    const rect = win.gBrowser.selectedBrowser.getBoundingClientRect();
    dialog.style.insetBlock = `${Math.round(rect.top)}px ${Math.max(0, Math.round(win.innerHeight - rect.bottom))}px`;
  } catch (e) {
    // ölçülemezse pencerenin ortası
  }
  win.MozXULElement.insertFTLIfNeeded("browser/marmara.ftl");
  doc.documentElement.append(dialog);
  dialog.showModal();
  frame.src = "chrome://browser/content/marmara-panels/downloads.html";
  frame.addEventListener("load", () => frame.contentWindow?.focus(), { once: true });
}

export const MarmaraSettings = {
  /** Ayarları verilen tarayıcı penceresinde açar. paneID eski Firefox bölüm adı olabilir. */
  show(win, paneID) {
    const existing = win.document.querySelector("dialog.marmara-settings-dialog");
    if (existing) {
      return;
    }
    const start = PANE_ALIASES.find(([pattern]) => pattern.test(paneID ?? ""))?.[1] ?? "general";
    new SettingsDialog(win).open(start);
  },

  /** İndirilenler kutusunu tarayıcı penceresinin içinde açar */
  showDownloads(win) {
    showDownloadsDialog(win);
  },

  /** İçe aktarma sihirbazını tarayıcı penceresinin içinde açar */
  showMigration(win, options) {
    showMigrationDialog(win, options);
  },
};

/** Karşılama ekranı (MarmaraWelcome) ile ortak kullanılan parçalar */
export const MarmaraSettingsShared = { themeBinding, localeBinding, LANGUAGES, restartBrowser };
