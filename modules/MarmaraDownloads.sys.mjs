/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Marmara: İndirilenler yan panelini otomatik açar.
 *
 * Bir indirme başlayınca ve bitince en öndeki tarayıcı penceresinde
 * İndirilenler yan paneli açılır. Firefox yalnızca başlangıçta (ve yalnızca
 * araç çubuğu düğmesi varsa) panel açıyordu; bitişte hiç açmıyordu.
 * Açılışta zaten var olan indirmeler sayılmaz.
 *
 * components.manifest'teki "browser-window-delayed-startup" kaydıyla
 * initWindow çağrılır; izleme yalnızca bir kez kurulur.
 */

const SIDEBAR = "viewDownloadsSidebar";

let started = false;

function showSidebar() {
  try {
    const win = Services.wm.getMostRecentWindow("navigator:browser");
    if (win?.SidebarController && !win.closed) {
      win.SidebarController.show(SIDEBAR);
    }
  } catch (e) {
    console.error("Marmara indirilenler paneli:", e);
  }
}

async function watch() {
  const { Downloads } = ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs");
  const list = await Downloads.getList(Downloads.ALL);
  const existing = new WeakSet(); // açılışta var olanlar
  const finished = new WeakSet(); // bitişi bildirilenler
  let ready = false;

  await list.addView({
    onDownloadAdded(download) {
      if (!ready) {
        existing.add(download);
      } else if (!download.succeeded && !download.error && !download.canceled) {
        showSidebar();
      }
    },
    onDownloadChanged(download) {
      if (ready && download.succeeded && !existing.has(download) && !finished.has(download)) {
        finished.add(download);
        showSidebar();
      }
    },
  });
  ready = true;
}

export const MarmaraDownloads = {
  initWindow() {
    if (started) {
      return;
    }
    started = true;
    watch().catch(e => console.error("Marmara indirilenler paneli:", e));
  },
};
