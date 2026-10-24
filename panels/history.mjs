/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Geçmiş paneli: güne göre gruplanmış liste, arama, tek tek silme ve
 * zaman aralığına göre / tümünü silme (geri alınamaz uyarısıyla).
 */

import {
  appLocale,
  buildShell,
  chunkedRender,
  confirmDialog,
  debounce,
  emptyState,
  enableArrowNavigation,
  favicon,
  h,
  iconButton,
  menuButton,
  openLink,
  translate,
} from "./panel-common.mjs";

const PAGE_SIZE = 100;
const HOUR = 60 * 60 * 1000;

/** Places'e erişim. Sınama ortamı globalThis.marmaraPanelBackend ile değiştirebilir. */
function realBackend() {
  const { PlacesUtils } = ChromeUtils.importESModule("resource://gre/modules/PlacesUtils.sys.mjs");
  const events = ["page-visited", "page-removed", "history-cleared", "page-title-changed"];
  return {
    async query(search, limit) {
      const history = PlacesUtils.history;
      const query = history.getNewQuery();
      const options = history.getNewQueryOptions();
      options.sortingMode = options.SORT_BY_DATE_DESCENDING;
      options.resultType = options.RESULTS_AS_URI;
      options.maxResults = limit;
      if (search) {
        query.searchTerms = search;
      }
      const root = history.executeQuery(query, options).root;
      root.containerOpen = true;
      try {
        const entries = [];
        for (let i = 0; i < root.childCount; i++) {
          const node = root.getChild(i);
          entries.push({ url: node.uri, title: node.title || "", date: node.time / 1000 });
        }
        return entries;
      } finally {
        root.containerOpen = false;
      }
    },
    remove: url => PlacesUtils.history.remove(url),
    removeSince: from => PlacesUtils.history.removeByFilter({ beginDate: new Date(from), endDate: new Date() }),
    clear: () => PlacesUtils.history.clear(),
    observe(callback) {
      const listener = () => callback();
      PlacesUtils.observers.addListener(events, listener);
      window.addEventListener("unload", () => PlacesUtils.observers.removeListener(events, listener), { once: true });
    },
  };
}

const backend = globalThis.marmaraPanelBackend ?? realBackend();

const locale = appLocale();
const timeFormat = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Gün başlığı: Bugün / Dün / tam tarih */
function dayHeading(ms) {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(ms)) / (24 * HOUR));
  if (diff == 0) {
    return h("h2", { class: "mm-group", l10n: "marmara-panel-today" });
  }
  if (diff == 1) {
    return h("h2", { class: "mm-group", l10n: "marmara-panel-yesterday" });
  }
  return h("h2", { class: "mm-group", text: dayFormat.format(ms) });
}

function hostOf(url) {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

let search = "";
let list = null; // son çizim (yenilenirken kaldığı yerden sürsün)
let shell;

function entryRow(entry) {
  const title = entry.title || entry.url;
  const main = h("button", { class: "mm-main", type: "button", title: entry.url },
    favicon(entry.url),
    h("span", { class: "mm-text" },
      h("span", { class: "mm-title", text: title }),
      h("span", { class: "mm-sub", text: hostOf(entry.url) })),
    h("span", { class: "mm-time", text: timeFormat.format(entry.date) }));
  main.addEventListener("click", event => openLink(entry.url, event));
  main.addEventListener("auxclick", event => {
    if (event.button == 1) {
      openLink(entry.url, event);
    }
  });
  const remove = iconButton({
    icon: "delete",
    l10n: "marmara-panel-history-remove",
    className: "destructive",
    onClick: async () => {
      row.remove();
      await backend.remove(entry.url);
    },
  });
  const row = h("div", { class: "mm-row" }, main, h("span", { class: "mm-actions" }, remove));
  return row;
}

async function render() {
  const scrollTop = shell.scroll.scrollTop;
  const keep = list?.shown ?? 0;
  list?.stop();
  let entries;
  try {
    entries = await backend.query(search, 5000);
  } catch (e) {
    console.error("Marmara geçmiş:", e);
    shell.scroll.replaceChildren(h("p", { class: "mm-error", text: String(e?.message ?? e) }));
    return;
  }
  shell.scroll.replaceChildren();
  if (!entries.length) {
    list = null;
    shell.scroll.append(emptyState({
      iconName: "history",
      title: search ? "marmara-panel-no-results" : "marmara-panel-history-empty",
      sub: search ? null : "marmara-panel-history-empty-sub",
    }));
    return;
  }
  let lastDay = null;
  list = chunkedRender(shell.scroll, {
    items: entries,
    batch: PAGE_SIZE,
    initial: keep,
    renderItem: entry => {
      const day = startOfDay(entry.date);
      const nodes = [];
      if (day != lastDay) {
        nodes.push(dayHeading(entry.date));
        lastDay = day;
      }
      nodes.push(entryRow(entry));
      return nodes;
    },
  });
  shell.scroll.scrollTop = scrollTop;
}

async function clearRange(since, bodyId) {
  const sure = await confirmDialog({
    heading: "marmara-panel-history-clear-heading",
    body: bodyId,
    warning: "marmara-panel-irreversible",
    confirm: "marmara-panel-history-clear-confirm",
  });
  if (!sure) {
    return;
  }
  if (since == null) {
    await backend.clear();
  } else {
    await backend.removeSince(since);
  }
}

function init() {
  const menu = menuButton({
    l10n: "marmara-panel-history-menu",
    items: [
      {
        l10n: "marmara-panel-history-clear-hour",
        onClick: () => clearRange(Date.now() - HOUR, "marmara-panel-history-clear-hour-body"),
      },
      {
        l10n: "marmara-panel-history-clear-today",
        onClick: () => clearRange(startOfDay(Date.now()), "marmara-panel-history-clear-today-body"),
      },
      "-",
      {
        l10n: "marmara-panel-history-clear-all",
        destructive: true,
        onClick: () => clearRange(null, "marmara-panel-history-clear-all-body"),
      },
    ],
  });
  shell = buildShell({
    title: "marmara-panel-history-title",
    searchPlaceholder: "marmara-panel-history-search",
    menu,
    onSearch: value => {
      search = value;
      list = null; // yeni arama baştan başlar
      render();
    },
  });
  enableArrowNavigation(shell.scroll);
  backend.observe(debounce(render));
  translate(document.body);
  render();
}

init();
