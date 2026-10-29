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

translatePage();
setInterval(updateClock, 1000);
updateClock();
initSearch().catch(e => console.error("Marmara başlangıç sayfası:", e));
document.body.style.opacity = "1";
