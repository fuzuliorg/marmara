/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Marmara: yan panel, panelin dışına tıklanınca kapanır.
 *
 * Geçmiş, Yer imleri, İndirilenler ve Parolalar panelleri açıkken sayfaya
 * (içeriğe), araç çubuğuna ya da sekmelere tıklamak paneli kapatır. Panelin
 * kendisi, menüler/açılır paneller ve iletişim kutuları (Ayarlar gibi)
 * sayılmaz. Sekme değişince ya da panel yeni açılınca kısa süre görmezden
 * gelinir; böylece kendiliğinden gelen odak değişimi paneli kapatmaz.
 *
 * components.manifest'teki "browser-window-delayed-startup" kaydıyla her
 * pencere için initWindow çağrılır.
 */

const IGNORE_MS = 400;
// Tıklanınca panel kapanmaması gereken yerler
const KEEP = "#sidebar-box, #sidebar-splitter, panel, menupopup, dialog, .marmara-panel-frame";

function isOpen(win) {
  const controller = win.SidebarController;
  return !!controller?.isOpen && !win.document.getElementById("sidebar-box")?.hidden;
}

export const MarmaraSidebar = {
  initWindow(win) {
    try {
      const doc = win.document;
      let ignoreUntil = 0;
      const hold = () => {
        ignoreUntil = Date.now() + IGNORE_MS;
      };
      const close = () => {
        if (Date.now() >= ignoreUntil && isOpen(win)) {
          win.SidebarController.hide();
        }
      };

      // Tarayıcı arayüzüne (araç çubuğu, sekmeler) tıklama
      doc.addEventListener(
        "mousedown",
        event => {
          if (event.button == 0 && !event.target.closest?.(KEEP)) {
            close();
          }
        },
        true
      );
      // Web içeriğine tıklama: içerik odak alınca (uzak süreçteki tıklama burada DOM olayı üretmez)
      doc.addEventListener(
        "focusin",
        event => {
          if (event.target?.localName == "browser" && event.target.closest?.("#tabbrowser-tabpanels")) {
            close();
          }
        },
        true
      );
      win.addEventListener("TabSelect", hold);
      // Panel açılırken (odak değişimleri olabilir) kısa süre görmezden gel
      const controller = win.SidebarController;
      const show = controller?.show;
      if (show) {
        controller.show = function (...args) {
          hold();
          return show.apply(this, args);
        };
      }
      win.gBrowser?.tabContainer?.addEventListener("TabOpen", hold);
    } catch (e) {
      console.error("Marmara yan panel:", e);
    }
  },
};
