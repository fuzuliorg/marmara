/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Marmara: sade uygulama menüsü (☰)
 *
 * Firefox'un menüsü bir şablondan ilk açılışta oluşturuluyor. Menü her
 * gösterildiğinde (ViewShowing) şu düzene getiriyoruz:
 *
 *   [simgeler, iki satır: geçmiş, yer imleri, parolalar, gizli pencere,
 *    yazdır, kaydet, sayfada bul, çevir, damlalık, web konsolu]
 *   ─────
 *   [yakınlaştırma: kaydırıcı, %100, tam ekran]
 *   ─────
 *   [Hakkında | Ayarlar]
 *
 * Mevcut Firefox düğmeleri taşınıyor, yeniden yazılmıyor; böylece davranışları
 * (alt menüler, kısayollar) aynen çalışıyor. Kaldırılan öğeler
 * (yeni sekme/pencere, profiller, indirilenler, uzantılar, daha fazla araç,
 * yardım, çık)
 * theme/browser/appmenu.css ile gizleniyor.
 *
 * components.manifest'teki "browser-window-delayed-startup" kaydıyla her
 * tarayıcı penceresi için initWindow çağrılır.
 */

const HTML_NS = "http://www.w3.org/1999/xhtml";

// Simge ızgarasına taşınan Firefox düğmeleri ve simgeleri (sırasıyla)
const GRID_BUTTONS = [
  ["appMenu-history-button", "chrome://browser/skin/history.svg"],
  ["appMenu-bookmarks-button", "chrome://browser/skin/bookmark-hollow.svg"],
  ["appMenu-passwords-button", "chrome://browser/skin/login.svg"],
  ["appMenu-new-private-window-button2", "chrome://browser/skin/privateBrowsing.svg"],
  ["appMenu-print-button2", "chrome://global/skin/icons/print.svg"],
  ["appMenu-save-file-button2", "chrome://browser/skin/save.svg"],
  ["appMenu-find-button2", "chrome://global/skin/icons/search-glass.svg"],
  ["appMenu-translate-button", "chrome://browser/skin/translations.svg"],
];

// Geçmiş, Yer imleri ve Parolalar menüde alt sayfa ya da ayrı sekme yerine yan
// panelde (kenar çubuğu) açılır. Panellerin kendisi panels/ klasöründe.
const SIDEBAR_BUTTONS = {
  "appMenu-history-button": "viewHistorySidebar",
  "appMenu-bookmarks-button": "viewBookmarksSidebar",
  "appMenu-passwords-button": "viewCPMSidebar",
};

const ZOOM_MIN = 30;
const ZOOM_MAX = 300;
const ZOOM_STEP = 10;

// ---------------------------------------------------------------------------
// Geliştirici araçları
// ---------------------------------------------------------------------------

function devtoolsRequire(id) {
  let { require } = ChromeUtils.importESModule(
    "resource://devtools/shared/loader/Loader.sys.mjs"
  );
  return require(id);
}

function openEyedropper(win) {
  // Firefox'un "Araçlar > Tarayıcı araçları > Damlalık" komutunun aynısı
  let { menuitems } = devtoolsRequire("resource://devtools/client/menus.js");
  let item = menuitems.find(i => i.id == "menu_eyedropper");
  item?.oncommand({ target: win.document.documentElement });
}

function openWebConsole(win) {
  let { gDevTools } = devtoolsRequire("devtools/client/framework/devtools");
  gDevTools.showToolboxForTab(win.gBrowser.selectedTab, { toolId: "webconsole" });
}

// ---------------------------------------------------------------------------
// Menü
// ---------------------------------------------------------------------------

class AppMenu {
  constructor(win) {
    this.win = win;
    this.doc = win.document;
    this.view = null;
  }

  #html(tag, attrs = {}, ...children) {
    let el = this.doc.createElementNS(HTML_NS, tag);
    for (let [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    el.append(...children);
    return el;
  }

  #separator() {
    let sep = this.doc.createXULElement("toolbarseparator");
    sep.className = "marmara-appmenu-separator";
    return sep;
  }

  #toolButton(id, icon, l10nId, onCommand) {
    let button = this.doc.createXULElement("toolbarbutton");
    button.id = id;
    button.className = "subviewbutton subviewbutton-iconic";
    button.setAttribute("data-l10n-id", l10nId);
    button.style.listStyleImage = `url("${icon}")`;
    button.addEventListener("command", () => {
      this.win.PanelUI.hide();
      try {
        onCommand(this.win);
      } catch (e) {
        console.error("Marmara menü:", e);
      }
    });
    return button;
  }

  /** Görünüm düğümü bir kez yeniden düzenlenir. */
  #restructure(view) {
    let body = view.querySelector(".panel-subview-body");
    let anchor = view.querySelector("#appMenu-fxa-separator");
    let zoom = view.querySelector("#appMenu-zoom-controls");
    let settings = view.querySelector("#appMenu-settings-button");
    if (!body || !anchor || !zoom || !settings) {
      console.warn("Marmara menü: menü yapısı değişmiş, düzenleme atlandı");
      return false;
    }

    // Simge ızgarası
    let grid = this.doc.createXULElement("hbox");
    grid.id = "marmara-appmenu-grid";
    for (let [id, icon] of GRID_BUTTONS) {
      let button = view.querySelector(`#${id}`);
      if (!button) {
        continue;
      }
      button.classList.add("subviewbutton-iconic", "marmara-appmenu-icon");
      let sidebarId = SIDEBAR_BUTTONS[id];
      if (sidebarId) {
        // Alt sayfayı açan Firefox davranışını yakalayıp kenar çubuğunu aç
        let open = event => {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.win.PanelUI.hide();
          try {
            this.win.SidebarController.toggle(sidebarId);
          } catch (e) {
            console.error("Marmara menü:", e);
          }
        };
        button.addEventListener("command", open, true);
        button.addEventListener("click", ev => {
          if (ev.button == 0) {
            open(ev);
          }
        }, true);
        button.classList.remove("subviewbutton-nav");
        button.removeAttribute("closemenu");
      }
      button.style.listStyleImage = `url("${icon}")`;
      grid.append(button);
    }
    for (let [id, icon, l10n, fn] of [
      ["marmara-appmenu-eyedropper", "chrome://devtools/skin/images/command-eyedropper.svg",
        "marmara-appmenu-eyedropper", openEyedropper],
      ["marmara-appmenu-console", "chrome://devtools/skin/images/tool-webconsole.svg",
        "marmara-appmenu-console", openWebConsole],
    ]) {
      let button = this.#toolButton(id, icon, l10n, fn);
      button.classList.add("marmara-appmenu-icon");
      grid.append(button);
    }
    anchor.before(grid);

    // Yakınlaştırma kaydırıcısı
    this.slider = this.#html("input", {
      type: "range",
      id: "marmara-zoom-slider",
      min: String(ZOOM_MIN),
      max: String(ZOOM_MAX),
      step: String(ZOOM_STEP),
    });
    this.slider.addEventListener("input", () => {
      this.win.FullZoom.setZoom(Number(this.slider.value) / 100);
    });
    let reset = zoom.querySelector("#appMenu-zoomReset-button2");
    if (reset) {
      reset.before(this.slider);
    } else {
      zoom.append(this.slider);
    }
    zoom.before(this.#separator());
    // Alt satır: solda Hakkında, sağda Ayarlar; ikisi de yarım genişlikte
    let about = this.#toolButton(
      "marmara-appmenu-about",
      "",
      "marmara-appmenu-about",
      win => win.openAboutDialog()
    );
    about.style.listStyleImage = "none";
    let footer = this.doc.createXULElement("hbox");
    footer.id = "marmara-appmenu-footer";
    settings.before(footer);
    footer.before(this.#separator());
    footer.append(about, settings);
    // Firefox alt sayfaları (geçmiş, yer imleri...) ana menünün yüksekliğine
    // kilitler. Ana menümüz kısa olduğundan listeler sıkışıyordu; kilidi
    // kaldırıyoruz, alt sayfalar kendi yüksekliğini alır (appmenu.css'te
    // alt sınırı var). Ana menü kendi boyutunu korur.
    view.removeAttribute("lockpanelvertical");
    view.toggleAttribute("marmara-appmenu", true);
    return true;
  }

  /** Simgeleri iki dengeli satıra yay. Panel henüz ekranda değilken
   * checkVisibility() her öğe için false döndüğünden (ör. tam ekrandan
   * çıktıktan sonra) sayım hesaplanmış stile göre yapılır. */
  #layoutGrid() {
    let grid = this.view?.querySelector("#marmara-appmenu-grid");
    if (!grid) {
      return;
    }
    let visible = [...grid.children].filter(
      b => !b.hidden && this.win.getComputedStyle(b).display != "none"
    ).length;
    grid.style.setProperty("--marmara-grid-columns", String(Math.max(4, Math.ceil(visible / 2))));
  }

  #refresh() {
    // Etiketi gizlenen simgeler için ipucu: Firefox'un çevirdiği etiket
    for (let button of this.view.querySelectorAll(".marmara-appmenu-icon")) {
      let label = button.getAttribute("label");
      if (label) {
        button.setAttribute("tooltiptext", label);
      }
    }
    // Simgeleri iki dengeli satıra yay
    this.#layoutGrid();
    if (this.slider) {
      let zoom = this.win.ZoomManager.getZoomForBrowser(this.win.gBrowser.selectedBrowser);
      this.slider.value = String(Math.round(zoom * 100));
    }
  }

  relayout() {
    this.#layoutGrid();
  }

  onViewShowing(view) {
    if (this.view != view) {
      this.view = view;
      if (!this.#restructure(view)) {
        return;
      }
      // Dinamik öğelerin metinleri (Fluent) çevrildikten sonra ipuçlarını kopyala
      this.doc.l10n.translateFragment(view).then(() => this.#refresh());
    }
    this.#refresh();
  }
}

export const MarmaraAppMenu = {
  /** browser-window-delayed-startup: ilk bağımsız değişken pencerenin kendisi */
  initWindow(win) {
    if (!win?.toolbar?.visible) {
      return;
    }
    win.MozXULElement.insertFTLIfNeeded("browser/marmara.ftl");
    // Yan panel (geçmiş, yer imleri) önceki oturumdan açık gelmesin; yalnızca
    // menüden tıklanınca açılsın.
    win.requestIdleCallback(() => {
      try {
        if (win.SidebarController?.isOpen) {
          win.SidebarController.hide();
        }
      } catch (e) {
        console.error("Marmara menü:", e);
      }
    });
    let menu = new AppMenu(win);
    win.document.addEventListener(
      "ViewShowing",
      event => {
        if (event.target.id == "appMenu-mainView") {
          try {
            menu.onViewShowing(event.target);
          } catch (e) {
            console.error("Marmara menü:", e);
          }
        }
      },
      true
    );
    // Menü ekrana geldikten sonra ızgarayı bir kez daha düzenle
    win.document.addEventListener(
      "ViewShown",
      event => {
        if (event.target.id == "appMenu-mainView") {
          try {
            menu.relayout();
          } catch (e) {
            console.error("Marmara menü:", e);
          }
        }
      },
      true
    );
  },
};
