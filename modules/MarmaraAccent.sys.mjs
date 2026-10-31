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
  "#2b6cb0", // deniz
  "#0e9aa7", // turkuaz
  "#2f9e6e", // yosun
  "#8aa62b", // fıstık
  "#d9a521", // safran
  "#ee7d2a", // mercan
  "#c4472f", // kiremit
  "#d6336c", // gül
  "#a24bb5", // erguvan
  "#5b57d1", // mor-mavi
  "#7a5c47", // kahve
  "#52667a", // taş
];

/** h: 0-359, s ve l: 0-100 → "#rrggbb" */
export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

/** "#rrggbb" → [h, s, l] */
export function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max == r) {
      h = ((g - b) / d) % 6;
    } else if (max == g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) {
      h += 360;
    }
  }
  return [h % 360, Math.round(s * 100), Math.round(l * 100)];
}

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
