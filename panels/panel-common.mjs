/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Marmara yan panelleri için ortak parçalar: başlık + arama kutusu, liste
 * satırları, açılır menü, onay/form iletişim kutuları ve geri alma bildirimi.
 * Görünüm panels/panel.css'te. Metinler l10n/*\/marmara.ftl'de
 * ("marmara-panel-*").
 */

const HTML_NS = "http://www.w3.org/1999/xhtml";

const ICONS = {
  close: "chrome://global/skin/icons/close.svg",
  search: "chrome://global/skin/icons/search-glass.svg",
  more: "chrome://global/skin/icons/more.svg",
  delete: "chrome://global/skin/icons/delete.svg",
  edit: "chrome://global/skin/icons/edit.svg",
  copy: "chrome://global/skin/icons/edit-copy.svg",
  eye: "chrome://global/skin/icons/eye.svg",
  "eye-slash": "chrome://global/skin/icons/eye-slash.svg",
  chevron: "chrome://global/skin/icons/arrow-down.svg",
  folder: "chrome://global/skin/icons/folder.svg",
  warning: "chrome://global/skin/icons/warning.svg",
  history: "chrome://browser/skin/history.svg",
  bookmark: "chrome://browser/skin/bookmark-hollow.svg",
  login: "chrome://browser/skin/login.svg",
  download: "chrome://browser/skin/downloads/downloads.svg",
  reload: "chrome://global/skin/icons/reload.svg",
};

/** Küçük DOM kurucusu: h("div", { class, l10n, l10nArgs, on: { click } }, ...çocuklar) */
export function h(tag, props = {}, ...children) {
  const el = document.createElementNS(HTML_NS, tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) {
      continue;
    }
    if (key == "class") {
      el.className = value;
    } else if (key == "l10n") {
      el.setAttribute("data-l10n-id", value);
    } else if (key == "l10nArgs") {
      el.setAttribute("data-l10n-args", JSON.stringify(value));
    } else if (key == "on") {
      for (const [type, fn] of Object.entries(value)) {
        el.addEventListener(type, fn);
      }
    } else if (key == "text") {
      el.textContent = value;
    } else {
      el.setAttribute(key, value === true ? "" : value);
    }
  }
  el.append(...children.flat().filter(c => c != null && c !== false));
  return el;
}

export function icon(name) {
  return h("img", { class: "mm-icon", src: ICONS[name], alt: "" });
}

export function favicon(url) {
  return h("img", { class: "mm-favicon", src: `page-icon:${url}`, alt: "", loading: "lazy" });
}

/** Çalışan ayarlı dil (Intl için); sınama ortamında tarayıcı dili */
export function appLocale() {
  return typeof Services != "undefined" ? Services.locale.appLocaleAsBCP47 : undefined;
}

/** Sonradan eklenen öğelerin Fluent metinlerini hemen çevirir. */
export function translate(root) {
  document.l10n?.translateFragment(root);
}

export function format(id, args) {
  return document.l10n.formatValue(id, args);
}

export function topWindow() {
  return window.browsingContext.topChromeWindow;
}

export function closePanel() {
  // İndirilenler gibi tarayıcı içindeki kutuda (iframe) açılan sayfalar kutuyu kapatır
  const frame = window.frameElement;
  if (frame?.classList.contains("marmara-panel-frame")) {
    frame.dispatchEvent(new CustomEvent("MarmaraPanelClose"));
    return;
  }
  topWindow().SidebarController.hide();
}

/** Bağlantıyı açar: orta tık / Ctrl = yeni sekme, Shift = yeni pencere */
export function openLink(url, event) {
  const win = topWindow();
  let where = "current";
  if (event?.button == 1 || event?.ctrlKey || event?.metaKey) {
    where = "tab";
  } else if (event?.shiftKey) {
    where = "window";
  }
  if (/^javascript:/i.test(url)) {
    // Yer imi betikleri sayfanın kendi yetkisiyle çalışır, tarayıcı yetkisiyle değil
    win.openWebLinkIn(url, where);
  } else {
    win.openTrustedLinkIn(url, where);
  }
}

export function iconButton({ icon: iconName, l10n, onClick, className = "" }) {
  const button = h("button", {
    class: `mm-round ${className}`.trim(),
    type: "button",
    l10n,
    "data-l10n-attrs": "title, aria-label",
  }, icon(iconName));
  button.addEventListener("click", event => {
    event.stopPropagation();
    onClick(event);
  });
  return button;
}

// ---------------------------------------------------------------------------
// Açılır menü
// ---------------------------------------------------------------------------

/** Düğmenin altında açılan menü. items: [{ l10n, onClick, destructive }] ya da "-" ayraç */
export function menuButton({ l10n, items }) {
  const button = iconButton({ icon: "more", l10n, onClick: () => toggle() });
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  const menu = h("div", { class: "mm-menu", popover: "auto", role: "menu" });
  for (const item of items) {
    if (item == "-") {
      menu.append(h("hr"));
      continue;
    }
    const entry = h("button", {
      type: "button",
      role: "menuitem",
      class: item.destructive ? "destructive" : "",
      l10n: item.l10n,
    });
    entry.addEventListener("click", () => {
      menu.hidePopover();
      item.onClick();
    });
    menu.append(entry);
  }
  menu.addEventListener("toggle", event => {
    button.setAttribute("aria-expanded", String(event.newState == "open"));
  });
  const toggle = () => {
    if (menu.matches(":popover-open")) {
      menu.hidePopover();
      return;
    }
    menu.showPopover();
    const rect = button.getBoundingClientRect();
    const width = menu.offsetWidth;
    const rtl = document.dir == "rtl";
    const left = rtl ? rect.left : rect.right - width;
    menu.style.insetBlockStart = `${rect.bottom + 4}px`;
    menu.style.insetInlineStart = "auto";
    menu.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`;
    menu.querySelector("button")?.focus();
  };
  return { button, menu };
}

// ---------------------------------------------------------------------------
// Sayfa iskeleti
// ---------------------------------------------------------------------------

/**
 * Başlık (ortada başlık, sağda kapat), arama kutusu + menü ve kaydırılabilir
 * liste alanı. Döndürdüğü nesne: { scroll, search, setSearchHandler }.
 */
export function buildShell({ title, searchPlaceholder, menu, onSearch }) {
  const close = iconButton({ icon: "close", l10n: "marmara-panel-close", onClick: closePanel });
  const header = h("header", { class: "mm-header" }, h("span"), h("h1", { l10n: title }), close);

  const input = h("input", {
    type: "search",
    autocomplete: "off",
    spellcheck: "false",
    l10n: searchPlaceholder,
    "data-l10n-attrs": "placeholder, aria-label",
  });
  let timer = 0;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => onSearch(input.value.trim()), 180);
  });
  const tools = h("div", { class: "mm-tools" },
    h("div", { class: "mm-search" }, icon("search"), input));
  if (menu) {
    tools.append(menu.button, menu.menu);
  }

  const scroll = h("main", { class: "mm-scroll" });
  document.body.append(header, tools, scroll);
  translate(document.body);
  return { scroll, input };
}

export function emptyState({ iconName, title, sub }) {
  const el = h("div", { class: "mm-empty" },
    icon(iconName),
    h("span", { class: "mm-title", l10n: title }),
    sub ? h("span", { l10n: sub }) : null);
  translate(el);
  return el;
}

/**
 * Liste elemanlarını parça parça çizer (uzun geçmiş donmasın). initial: ilk
 * çizimde gösterilecek en az eleman sayısı; liste yenilenirken kullanıcının
 * kaydırdığı yerde kalması için. Döndürdüğü nesne: { stop(), shown }.
 */
export function chunkedRender(scroll, { items, renderItem, batch = 80, initial = 0 }) {
  let shown = 0;
  const more = h("button", { class: "mm-pill mm-more", type: "button", l10n: "marmara-panel-show-more" });
  const next = (count = batch) => {
    const end = Math.min(items.length, shown + count);
    const fragment = document.createDocumentFragment();
    for (; shown < end; shown++) {
      fragment.append(...[].concat(renderItem(items[shown], shown)));
    }
    more.before(fragment);
    more.hidden = shown >= items.length;
    translate(scroll);
  };
  more.addEventListener("click", () => next());
  scroll.append(more);
  next(Math.max(batch, initial));
  const observer = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting) && !more.hidden) {
      next();
    }
  }, { root: scroll });
  observer.observe(more);
  return {
    stop: () => observer.disconnect(),
    get shown() {
      return shown;
    },
  };
}

/** Yukarı/aşağı oklarıyla satırlar arasında gezinme */
export function enableArrowNavigation(scroll) {
  scroll.addEventListener("keydown", event => {
    if (event.key != "ArrowDown" && event.key != "ArrowUp") {
      return;
    }
    const mains = [...scroll.querySelectorAll(".mm-main")].filter(el => el.offsetParent);
    const index = mains.indexOf(document.activeElement);
    const target = mains[index + (event.key == "ArrowDown" ? 1 : -1)];
    if (target) {
      event.preventDefault();
      target.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// İletişim kutuları
// ---------------------------------------------------------------------------

export function showDialog(dialog) {
  document.body.append(dialog);
  translate(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
}

/**
 * Onay kutusu. destructive ise onay düğmesi kırmızı olur; warning ile geri
 * alınamaz uyarısı ayrıca vurgulanır. Onaylanırsa true döner.
 */
export function confirmDialog({ heading, body, warning, confirm, cancel = "marmara-panel-cancel", args }) {
  return new Promise(resolve => {
    const ok = h("button", { class: "mm-pill destructive", type: "button", l10n: confirm, l10nArgs: args });
    const no = h("button", { class: "mm-pill", type: "button", l10n: cancel });
    const dialog = h("dialog", { class: "mm-dialog", "aria-modal": "true" },
      h("h2", { l10n: heading, l10nArgs: args }),
      body ? h("p", { l10n: body, l10nArgs: args }) : null,
      warning ? h("div", { class: "mm-warning", role: "alert" }, icon("warning"), h("span", { l10n: warning })) : null,
      h("div", { class: "mm-buttons" }, no, ok));
    let result = false;
    ok.addEventListener("click", () => {
      result = true;
      dialog.close();
    });
    no.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => resolve(result));
    showDialog(dialog);
    no.focus();
  });
}

/** Alan satırı: etiket + giriş kutusu (+ ek düğmeler) */
export function field({ name, label, value = "", type = "text", readonly = false, buttons = [] }) {
  const id = `mm-field-${name}`;
  const input = h("input", { id, type, autocomplete: "off", spellcheck: "false", readonly });
  input.value = value;
  const entry = h("div", { class: "mm-entry" }, input, ...buttons);
  return { input, entry, root: h("div", { class: "mm-field" }, h("label", { for: id, l10n: label }), entry) };
}

/**
 * Düzenleme kutusu. content: alan öğeleri (field().root), onSubmit: true dönerse
 * kapanır; bir hata iletisi (Fluent kimliği) dönerse kutuda gösterilir.
 */
export function formDialog({ heading, args, fields, submit = "marmara-panel-save", onSubmit }) {
  return new Promise(resolve => {
    const error = h("p", { class: "mm-error", role: "alert", hidden: true });
    const save = h("button", { class: "mm-pill suggested", type: "submit", l10n: submit });
    const cancel = h("button", { class: "mm-pill", type: "button", l10n: "marmara-panel-cancel" });
    const form = h("form", { method: "dialog", novalidate: true },
      h("div", { class: "mm-fields" }, ...fields),
      error,
      h("div", { class: "mm-buttons" }, cancel, save));
    const dialog = h("dialog", { class: "mm-dialog" }, h("h2", { l10n: heading, l10nArgs: args }), form);
    let saved = false;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      save.disabled = true;
      try {
        const problem = await onSubmit();
        if (problem) {
          error.setAttribute("data-l10n-id", problem);
          error.hidden = false;
          translate(error);
          save.disabled = false;
          return;
        }
        saved = true;
        dialog.close();
      } catch (e) {
        console.error("Marmara panel:", e);
        save.disabled = false;
      }
    });
    cancel.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => resolve(saved));
    showDialog(dialog);
    dialog.querySelector("input:not([readonly])")?.focus();
  });
}

// ---------------------------------------------------------------------------
// Geri alma bildirimi
// ---------------------------------------------------------------------------

let toastTimer = 0;

/** Altta kısa bir bildirim; action verilirse "Geri al" gibi bir düğme taşır. */
export function toast({ l10n, action, onAction, timeout = 7000 }) {
  document.querySelector(".mm-toast")?.remove();
  clearTimeout(toastTimer);
  const el = h("div", { class: "mm-toast", role: "status" }, h("span", { l10n }));
  if (action) {
    const button = h("button", { type: "button", l10n: action });
    button.addEventListener("click", () => {
      el.remove();
      onAction?.();
    });
    el.append(button);
  }
  document.body.append(el);
  translate(el);
  toastTimer = setTimeout(() => el.remove(), timeout);
}

/** Gecikmeli çalıştırır; art arda gelen olayları (Places) tek yenilemeye indirir. */
export function debounce(fn, ms = 400) {
  let timer = 0;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}
