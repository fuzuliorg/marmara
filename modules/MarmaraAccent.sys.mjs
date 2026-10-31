/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Marmara: vurgu rengi (kişiselleştirme)
 *
 * Kullanıcı Ayarlar > Genel > Görünüm'den bir renk seçer (hazır renkler ya da
 * kendi rengi). Seçilen renk marmara.ui.accent tercihinde "#rrggbb" olarak
 * saklanır; boşsa sistemin vurgu rengi (AccentColor) kullanılır.
 *
 * Her tarayıcı penceresinin kök öğesine --mm-seed ve --mm-seed-fg yazılır,
 * marmara-accent özniteliği eklenir; renklerin geri kalanını
 * theme/browser/accent.css türetir (vurgu + hafif renk tonlu yüzeyler).
 * components.manifest'teki "browser-window-delayed-startup" kaydıyla her
 * pencere için initWindow çağrılır; Ayarlar değişince applyAll çağrılır.
 */

const PREF = "marmara.ui.accent";

// Hazır renkler (Ayarlar'daki palet sırasıyla)
export const PRESETS = [
  "#3584e4", // mavi
  "#2190a4", // gök mavisi
  "#26a269", // yeşil
  "#7c9a3a", // zeytin
  "#c9a227", // sarı
  "#e66100", // turuncu
  "#986a44", // kahve
  "#e01b24", // kırmızı
  "#d56199", // pembe
  "#9141ac", // mor
  "#6f5fc9", // mor-mavi
  "#5e7a91", // arduvaz
];

const HEX = /^#[0-9a-f]{6}$/i;

export function getAccent() {
  const value = Services.prefs.getStringPref(PREF, "").trim();
  return HEX.test(value) ? value.toLowerCase() : "";
}

export function setAccent(value) {
  if (value && HEX.test(value)) {
    Services.prefs.setStringPref(PREF, value.toLowerCase());
  } else {
    Services.prefs.clearUserPref(PREF);
  }
  applyAll();
}

/** Zemin renginin üstünde okunacak yazı rengi (WCAG göreli parlaklık) */
function textOn(hex) {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#000006" : "#ffffff";
}

export function apply(win) {
  const root = win?.document?.documentElement;
  if (!root) {
    return;
  }
  const accent = getAccent();
  if (accent) {
    root.style.setProperty("--mm-seed", accent);
    root.style.setProperty("--mm-seed-fg", textOn(accent));
    root.setAttribute("marmara-accent", "");
  } else {
    root.style.removeProperty("--mm-seed");
    root.style.removeProperty("--mm-seed-fg");
    root.removeAttribute("marmara-accent");
  }
}

export function applyAll() {
  for (const win of Services.wm.getEnumerator("navigator:browser")) {
    try {
      apply(win);
    } catch (e) {
      console.error("Marmara vurgu rengi:", e);
    }
  }
}

export const MarmaraAccent = {
  /** browser-window-delayed-startup */
  initWindow(win) {
    try {
      apply(win);
    } catch (e) {
      console.error("Marmara vurgu rengi:", e);
    }
  },
};
