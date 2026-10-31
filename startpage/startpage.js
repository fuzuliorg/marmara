/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* about:marmara: Marmara'nın başlangıç ve yeni sekme sayfası.
 * Tarayıcının kendi sayfası olduğundan arama motorunu doğrudan tarayıcının
 * varsayılanıyla paylaşır; hiçbir dış kaynağa bağlanmaz. */

const { SearchService } = ChromeUtils.importESModule(
  "moz-src:///toolkit/components/search/SearchService.sys.mjs"
);

const $ = id => document.getElementById(id);

// Vurgu rengi (Ayarlar > Genel > Görünüm): bu sayfa ayrı bir belge olduğu için kendisi uygular
try {
  const Accent = ChromeUtils.importESModule("resource:///modules/MarmaraAccent.sys.mjs");
  Accent.apply(window);
  Accent.watch(window);
} catch (e) {
  console.error("Marmara başlangıç sayfası (vurgu rengi):", e);
}

/* Dil: tarayıcının arayüz dili Türkçeyse Türkçe, değilse İngilizce */
const LOCALE = Services.locale.appLocaleAsBCP47;
const TR = LOCALE.startsWith("tr");
const STRINGS = TR
  ? {
      title: "Yeni Sekme",
      search: "Ara",
      searchWith: name => `${name} ile arama yap...`,
      shortcuts: "Sık Kullanılanlar",
      add: "Ekle",
      newShortcut: "Yeni Kısayol",
      titleLabel: "Başlık",
      titlePlaceholder: "Örn: GitHub, Vikipedi",
      urlLabel: "Web adresi",
      urlPlaceholder: "Örn: github.com",
      urlError: "Lütfen geçerli bir adres girin.",
      cancel: "İptal",
      save: "Kaydet",
      empty: "Henüz kısayol eklemediniz.",
      remove: "Sil",
      edit: "Düzenle",
      addShortcut: "Kısayol ekle",
      editShortcut: "Kısayolu Düzenle",
      more: "Diğer işlemler",
      night: "İyi Geceler!",
      morning: "Günaydın!",
      afternoon: "İyi Günler!",
      evening: "İyi Akşamlar!",
    }
  : {
      title: "New Tab",
      search: "Search",
      searchWith: name => `Search with ${name}...`,
      shortcuts: "Shortcuts",
      add: "Add",
      newShortcut: "New Shortcut",
      titleLabel: "Title",
      titlePlaceholder: "e.g. GitHub, Wikipedia",
      urlLabel: "Web address",
      urlPlaceholder: "e.g. github.com",
      urlError: "Please enter a valid address.",
      cancel: "Cancel",
      save: "Save",
      empty: "No shortcuts yet.",
      remove: "Remove",
      edit: "Edit",
      addShortcut: "Add shortcut",
      editShortcut: "Edit Shortcut",
      more: "More actions",
      night: "Good night!",
      morning: "Good morning!",
      afternoon: "Good afternoon!",
      evening: "Good evening!",
    };

function translatePage() {
  document.documentElement.lang = TR ? "tr" : "en";
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = STRINGS[el.dataset.i18n];
  }
  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) {
    el.placeholder = STRINGS[el.dataset.i18nPlaceholder];
  }
  for (const el of document.querySelectorAll("[data-i18n-aria]")) {
    el.setAttribute("aria-label", STRINGS[el.dataset.i18nAria]);
  }
}

/* 1. Saat ve karşılama */
function updateClock() {
  const now = new Date();
  $("clock").textContent =
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const hr = now.getHours();
  let greeting = STRINGS.night;
  if (hr >= 5 && hr < 12) greeting = STRINGS.morning;
  else if (hr >= 12 && hr < 18) greeting = STRINGS.afternoon;
  else if (hr >= 18 && hr < 22) greeting = STRINGS.evening;
  $("greeting").textContent = greeting;
}

/* 2. Arama: motor listesi ve varsayılan tarayıcıyla ortak */
const FALLBACK_ICON = "chrome://browser/skin/search-engine-placeholder.png";

async function engineIcon(engine) {
  try {
    return (await engine.getIconURL(32)) || FALLBACK_ICON;
  } catch (e) {
    return FALLBACK_ICON;
  }
}

async function refreshEngine() {
  const engine = await SearchService.getDefault();
  $("engine-name").textContent = engine.name;
  $("engine-icon").src = await engineIcon(engine);
  $("search-input").placeholder = STRINGS.searchWith(engine.name);
  return engine;
}

async function buildMenu() {
  const menu = $("engine-menu");
  const current = await SearchService.getDefault();
  const engines = await SearchService.getVisibleEngines();
  const items = await Promise.all(
    engines.map(async engine => {
      const item = document.createElement("button");
      item.type = "button";
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", String(engine.id == current.id));
      const img = document.createElement("img");
      img.alt = "";
      img.width = img.height = 16;
      img.src = await engineIcon(engine);
      const name = document.createElement("span");
      name.textContent = engine.name;
      item.append(img, name);
      if (engine.id == current.id) {
        const check = document.createElement("i");
        check.className = "ic ic-object-select";
        item.append(check);
      }
      item.addEventListener("click", async () => {
        // Burada seçilen motor tarayıcının varsayılanı olur (Ayarlar'dakiyle aynı)
        const reason = SearchService.CHANGE_REASON.USER;
        await SearchService.setDefault(engine, reason);
        await SearchService.setDefaultPrivate(engine, reason);
        menu.hidden = true;
        $("search-input").focus();
      });
      return item;
    })
  );
  menu.replaceChildren(...items);
}

async function initSearch() {
  await SearchService.init();
  await refreshEngine();
  // Ayarlar'dan ya da başka yerden değişirse sayfa da güncellensin
  const observer = {
    observe() {
      refreshEngine();
      if (!$("engine-menu").hidden) buildMenu();
    },
  };
  Services.obs.addObserver(observer, "browser-search-engine-modified");
  window.addEventListener("unload", () =>
    Services.obs.removeObserver(observer, "browser-search-engine-modified")
  );

  $("engine-btn").addEventListener("click", async () => {
    const menu = $("engine-menu");
    if (menu.hidden) {
      await buildMenu();
      menu.hidden = false;
    } else {
      menu.hidden = true;
    }
  });
  document.addEventListener("click", e => {
    if (!e.target.closest(".engine")) $("engine-menu").hidden = true;
  });
  $("search-form").addEventListener("submit", async e => {
    e.preventDefault();
    const query = $("search-input").value.trim();
    if (!query) return;
    const engine = await SearchService.getDefault();
    window.location.href = engine.getSubmission(query).uri.spec;
  });
}

/* 3. Kısayollar: marmara.startpage.shortcuts tercihinde [{ title, url }] olarak saklanır */
const { normalizeUrl } = ChromeUtils.importESModule("resource:///modules/MarmaraStartpage.sys.mjs");
const PREF_SHORTCUTS = "marmara.startpage.shortcuts";
const MAX_SHORTCUTS = 9; // ekle düğmesiyle birlikte iki sıra (5 + 5)

function loadShortcuts() {
  try {
    const list = JSON.parse(Services.prefs.getStringPref(PREF_SHORTCUTS, "[]"));
    return Array.isArray(list)
      ? list.filter(item => item && typeof item.url == "string" && normalizeUrl(item.url)).slice(0, MAX_SHORTCUTS)
      : [];
  } catch (e) {
    return [];
  }
}

function saveShortcuts(list) {
  Services.prefs.setStringPref(PREF_SHORTCUTS, JSON.stringify(list.map(({ title, url }) => ({ title, url }))));
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return url;
  }
}

/** Sitenin simgesi geçmişte kayıtlıysa onu, yoksa renkli bir harf simgesi gösterir */
async function fillIcon(ico, shortcut) {
  const label = (shortcut.title || hostOf(shortcut.url)).trim();
  let hash = 0;
  for (const ch of hostOf(shortcut.url)) hash = (hash * 31 + ch.codePointAt(0)) % 360;
  ico.style.setProperty("--bg", `hsl(${hash} 42% 42%)`);
  ico.classList.add("letter");
  ico.textContent = (label[0] ?? "?").toLocaleUpperCase();
  try {
    const { PlacesUtils } = ChromeUtils.importESModule("resource://gre/modules/PlacesUtils.sys.mjs");
    const favicon = await PlacesUtils.favicons.getFaviconForPage(Services.io.newURI(shortcut.url));
    const src = favicon?.dataURI?.spec;
    if (src) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = src;
      ico.classList.remove("letter");
      ico.replaceChildren(img);
    }
  } catch (e) {
    // Simge yoksa harf kalır
  }
}

let openMenu = null;
function closeMenu() {
  openMenu?.menu.remove();
  openMenu?.button.setAttribute("aria-expanded", "false");
  openMenu = null;
}

function renderShortcuts() {
  const grid = $("shortcut-grid");
  const list = loadShortcuts();
  closeMenu();
  const tiles = list.map((shortcut, index) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    const link = document.createElement("a");
    link.href = normalizeUrl(shortcut.url);
    const ico = document.createElement("span");
    ico.className = "ico";
    ico.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = shortcut.title || hostOf(shortcut.url);
    link.append(ico, label);
    const more = document.createElement("button");
    more.type = "button";
    more.className = "more";
    more.setAttribute("aria-haspopup", "menu");
    more.setAttribute("aria-expanded", "false");
    more.setAttribute("aria-label", `${STRINGS.more}: ${label.textContent}`);
    more.innerHTML = '<i class="ic ic-more"></i>';
    more.addEventListener("click", event => {
      event.stopPropagation();
      if (openMenu?.button == more) {
        closeMenu();
        return;
      }
      closeMenu();
      const menu = document.createElement("div");
      menu.className = "tile-menu";
      menu.setAttribute("role", "menu");
      for (const [key, action] of [["edit", () => openDialog(index)], ["remove", () => removeShortcut(index)]]) {
        const item = document.createElement("button");
        item.type = "button";
        item.setAttribute("role", "menuitem");
        item.textContent = STRINGS[key];
        item.addEventListener("click", () => {
          closeMenu();
          action();
        });
        menu.append(item);
      }
      tile.append(menu);
      more.setAttribute("aria-expanded", "true");
      openMenu = { menu, button: more };
      menu.querySelector("button").focus();
    });
    tile.append(link, more);
    fillIcon(ico, shortcut);
    return tile;
  });
  if (list.length < MAX_SHORTCUTS) {
    const add = document.createElement("div");
    add.className = "tile add";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "open";
    button.innerHTML = '<span class="ico" aria-hidden="true">+</span>';
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = STRINGS.addShortcut;
    button.append(label);
    button.addEventListener("click", () => openDialog(-1));
    add.append(button);
    tiles.push(add);
  }
  grid.replaceChildren(...tiles);
}

function removeShortcut(index) {
  const list = loadShortcuts();
  list.splice(index, 1);
  saveShortcuts(list);
  renderShortcuts();
}

let editing = -1;
function openDialog(index) {
  editing = index;
  const current = index >= 0 ? loadShortcuts()[index] : null;
  $("sc-heading").textContent = index >= 0 ? STRINGS.editShortcut : STRINGS.newShortcut;
  $("sc-title").value = current?.title ?? "";
  $("sc-url").value = current?.url ?? "";
  $("sc-url").removeAttribute("aria-invalid");
  $("sc-error").hidden = true;
  $("shortcut-dialog").showModal();
  $("sc-title").focus();
}

function initShortcuts() {
  const dialog = $("shortcut-dialog");
  $("sc-cancel").addEventListener("click", () => dialog.close());
  $("shortcut-form").addEventListener("submit", event => {
    event.preventDefault();
    const url = normalizeUrl($("sc-url").value);
    if (!url) {
      $("sc-url").setAttribute("aria-invalid", "true");
      $("sc-error").hidden = false;
      $("sc-url").focus();
      return;
    }
    const list = loadShortcuts();
    const entry = { title: $("sc-title").value.trim(), url };
    if (editing >= 0 && list[editing]) {
      list[editing] = entry;
    } else if (list.length < MAX_SHORTCUTS) {
      list.push(entry);
    }
    saveShortcuts(list);
    dialog.close();
    renderShortcuts();
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".tile-menu")) closeMenu();
  });
  document.addEventListener("keydown", event => {
    if (event.key == "Escape") closeMenu();
  });
  // Başka bir sekmede değişirse burada da güncellensin
  const observer = { observe: () => renderShortcuts() };
  Services.prefs.addObserver(PREF_SHORTCUTS, observer);
  window.addEventListener("unload", () => Services.prefs.removeObserver(PREF_SHORTCUTS, observer));
  renderShortcuts();
}

translatePage();
initShortcuts();
setInterval(updateClock, 1000);
updateClock();
initSearch().catch(e => console.error("Marmara başlangıç sayfası:", e));
document.body.style.opacity = "1";
