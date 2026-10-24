/* Bu Kaynak Kodu Formunun şartları, Mozilla Public License, v. 2.0 */

/**
 * Hazır eklentilerin (uBlock Origin, Privacy Badger, ClearURLs) ilk kurulumu.
 *
 * Politika ile "normal_installed" kurulan eklentiler kaldırılamaz. Bunun yerine
 * her biri ilk açılışta bir kez kurulur; sonrasında kullanıcı diledikçe
 * kapatabilir ya da kaldırabilir ve kaldırılan eklenti geri gelmez.
 * Kurulacaklar distribution/policies.json içindeki ExtensionSettings'ten okunur.
 */

const PREF_SEEDED = "marmara.extensions.seeded";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  AddonManager: "resource://gre/modules/AddonManager.sys.mjs",
});

function seededIds() {
  try {
    return new Set(JSON.parse(Services.prefs.getStringPref(PREF_SEEDED, "[]")));
  } catch {
    return new Set();
  }
}

function markSeeded(extId) {
  const ids = seededIds();
  ids.add(extId);
  Services.prefs.setStringPref(PREF_SEEDED, JSON.stringify([...ids]));
}

let started = false;

async function seed() {
  const settings = Services.policies?.getActivePolicies()?.ExtensionSettings ?? {};
  const done = seededIds();
  for (const [extId, conf] of Object.entries(settings)) {
    // install_url düz metin ya da URL nesnesi olarak gelebilir
    const url = conf?.install_url?.href ?? conf?.install_url;
    if (extId === "*" || !url || done.has(extId)) {
      continue;
    }
    try {
      if (await lazy.AddonManager.getAddonByID(extId)) {
        markSeeded(extId); // zaten kurulu
        continue;
      }
      const install = await lazy.AddonManager.getInstallForURL(String(url), {
        telemetryInfo: { source: "ExtensionSettings" },
      });
      if (!install) {
        console.error("Marmara eklenti kurulumu: kurulum oluşturulamadı:", extId, url);
        continue;
      }
      install.addListener({
        onInstallEnded() {
          markSeeded(extId);
        },
        onDownloadFailed() {
          console.error("Marmara eklenti kurulumu: indirilemedi:", extId, install.error);
        },
        onInstallFailed() {
          console.error("Marmara eklenti kurulumu: kurulamadı:", extId, install.error);
        },
      });
      await install.install();
    } catch (e) {
      // Çevrimdışıysa bir sonraki açılışta yeniden denenir
      console.error("Marmara eklenti kurulumu:", extId, e);
    }
  }
}

export const MarmaraExtensions = {
  /** browser-window-delayed-startup */
  initWindow(win) {
    if (started || Services.appinfo.inSafeMode || !win?.toolbar?.visible) {
      return;
    }
    started = true;
    win.setTimeout(() => seed().catch(console.error), 3000);
  },
};
