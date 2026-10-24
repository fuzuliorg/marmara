/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * İndirilenler: tarayıcı içinde açılan kutuda, güne göre gruplanmış liste;
 * ilerleme çubuğu, yeniden dene, klasörde göster, listeden kaldır ve dosyayı
 * silme (geri alınamaz uyarısıyla).
 */

import {
  appLocale,
  buildShell,
  chunkedRender,
  closePanel,
  confirmDialog,
  emptyState,
  enableArrowNavigation,
  h,
  iconButton,
  menuButton,
  translate,
} from "./panel-common.mjs";

const HOUR = 60 * 60 * 1000;

/** İndirme listesine erişim. Sınama ortamı globalThis.marmaraPanelBackend ile değiştirebilir. */
function realBackend() {
  const { Downloads } = ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs");
  const { FileUtils } = ChromeUtils.importESModule("resource://gre/modules/FileUtils.sys.mjs");
  let list = null;
  return {
    async init(view) {
      list = await Downloads.getList(Downloads.PUBLIC);
      await list.addView(view);
      window.addEventListener("unload", () => list.removeView(view), { once: true });
    },
    async all() {
      const downloads = await list.getAll();
      // Biten indirmelerde dosyanın hâlâ var olup olmadığını öğren
      await Promise.all(downloads.filter(d => d.succeeded).map(d => d.refresh().catch(() => {})));
      return downloads;
    },
    open: d => d.launch(),
    reveal(d) {
      const file = new FileUtils.File(d.target.path);
      try {
        file.reveal();
      } catch {
        file.parent.launch();
      }
    },
    retry: d => d.start().catch(() => {}),
    async cancel(d) {
      await d.cancel();
      await d.removePartialData();
    },
    async remove(d) {
      await list.remove(d);
      await d.finalize(true);
    },
    async deleteFile(d) {
      await IOUtils.remove(d.target.path, { ignoreAbsent: true });
      await list.remove(d);
      await d.finalize(true);
    },
    removeFinished: () => list.removeFinished(),
    async openFolder() {
      const dir = new FileUtils.File(await Downloads.getPreferredDownloadsDirectory());
      dir.launch();
    },
    sizeText(bytes) {
      const { DownloadUtils } = ChromeUtils.importESModule("resource://gre/modules/DownloadUtils.sys.mjs");
      const [value, unit] = DownloadUtils.convertByteUnits(bytes);
      return `${value} ${unit}`;
    },
  };
}

const backend = globalThis.marmaraPanelBackend ?? realBackend();

const locale = appLocale();
const dayFormat = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

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

function fileName(d) {
  const path = d.target?.path ?? "";
  return path.split(/[\\/]/).pop() || hostOf(d.source?.url ?? "");
}

function fileIcon(d) {
  const ext = /\.[A-Za-z0-9]{1,8}$/.exec(fileName(d))?.[0] ?? ".bin";
  return h("img", { class: "mm-fileicon", src: `moz-icon://${ext}?size=32`, alt: "", loading: "lazy" });
}

/** Satırın durumu: etkin (iniyor), bitti, eksik (dosya yok), hata, duraklatıldı/iptal */
function stateOf(d) {
  if (!d.stopped) {
    return "active";
  }
  if (d.succeeded) {
    return d.target?.exists === false ? "missing" : "done";
  }
  if (d.error) {
    return "failed";
  }
  return d.hasPartialData ? "paused" : "canceled";
}

let search = "";
let shell;
let list = null;
const rows = new Map(); // indirme -> satır

function statusLine(d, state) {
  const host = hostOf(d.source?.url ?? "");
  switch (state) {
    case "active": {
      const done = backend.sizeText(d.currentBytes);
      if (d.hasProgress && d.totalBytes > 0) {
        return h("span", { class: "mm-sub", l10n: "marmara-panel-downloads-progress",
          l10nArgs: { percent: Math.max(0, Math.min(100, Math.floor(d.progress))), done, total: backend.sizeText(d.totalBytes) } });
      }
      return h("span", { class: "mm-sub", l10n: "marmara-panel-downloads-progress-unknown", l10nArgs: { done } });
    }
    case "done":
      return h("span", { class: "mm-sub", text: `${backend.sizeText(d.totalBytes || d.currentBytes)} · ${host}` });
    case "missing":
      return h("span", { class: "mm-sub warn", l10n: "marmara-panel-downloads-missing" });
    case "failed":
      return h("span", { class: "mm-sub warn", l10n: "marmara-panel-downloads-failed" });
    case "paused":
      return h("span", { class: "mm-sub", l10n: "marmara-panel-downloads-paused" });
    default:
      return h("span", { class: "mm-sub", l10n: "marmara-panel-downloads-canceled" });
  }
}

function buildRow(d) {
  const state = stateOf(d);
  const openable = state == "done";
  const text = h("span", { class: "mm-text" },
    h("span", { class: "mm-title", text: fileName(d) }),
    statusLine(d, state));
  if (state == "active") {
    const bar = h("span", { class: "mm-progress", role: "progressbar" },
      h("span", { class: "mm-progress-fill" }));
    const fill = bar.firstChild;
    if (d.hasProgress && d.totalBytes > 0) {
      fill.style.width = `${Math.max(0, Math.min(100, d.progress))}%`;
    } else {
      bar.classList.add("indeterminate");
    }
    text.append(bar);
  }
  const main = h("button", { class: "mm-main", type: "button", title: d.source?.url ?? "", disabled: !openable },
    fileIcon(d), text);
  if (openable) {
    main.addEventListener("click", () => backend.open(d));
  }

  const actions = h("span", { class: "mm-actions" });
  const act = (icon, l10n, onClick, className = "") =>
    actions.append(iconButton({ icon, l10n, onClick, className }));
  switch (state) {
    case "active":
      act("close", "marmara-panel-downloads-cancel", () => backend.cancel(d));
      break;
    case "failed":
    case "paused":
    case "canceled":
      act("reload", "marmara-panel-downloads-retry", () => backend.retry(d));
      act("close", "marmara-panel-downloads-remove", () => backend.remove(d));
      break;
    case "missing":
      act("close", "marmara-panel-downloads-remove", () => backend.remove(d));
      break;
    default:
      act("folder", "marmara-panel-downloads-reveal", () => backend.reveal(d));
      act("close", "marmara-panel-downloads-remove", () => backend.remove(d));
      act("delete", "marmara-panel-downloads-delete", () => deleteFile(d), "destructive");
  }
  const row = h("div", { class: `mm-row${state == "active" ? " active" : ""}` }, main, actions);
  translate(row);
  return row;
}

async function deleteFile(d) {
  const sure = await confirmDialog({
    heading: "marmara-panel-downloads-delete-heading",
    body: "marmara-panel-downloads-delete-body",
    warning: "marmara-panel-irreversible",
    confirm: "marmara-panel-downloads-delete-confirm",
    args: { name: fileName(d) },
  });
  if (sure) {
    await backend.deleteFile(d);
  }
}

async function clearFinished() {
  const sure = await confirmDialog({
    heading: "marmara-panel-downloads-clear-heading",
    body: "marmara-panel-downloads-clear-body",
    confirm: "marmara-panel-downloads-clear-confirm",
  });
  if (sure) {
    await backend.removeFinished();
  }
}

async function render() {
  const scrollTop = shell.scroll.scrollTop;
  const keep = list?.shown ?? 0;
  list?.stop();
  rows.clear();
  let downloads;
  try {
    downloads = await backend.all();
  } catch (e) {
    console.error("Marmara indirilenler:", e);
    shell.scroll.replaceChildren(h("p", { class: "mm-error", text: String(e?.message ?? e) }));
    return;
  }
  const needle = search.toLocaleLowerCase();
  downloads = downloads
    .filter(d => !needle || fileName(d).toLocaleLowerCase().includes(needle) || (d.source?.url ?? "").toLocaleLowerCase().includes(needle))
    .sort((a, b) => (b.startTime ?? 0) - (a.startTime ?? 0));
  shell.scroll.replaceChildren();
  if (!downloads.length) {
    list = null;
    shell.scroll.append(emptyState({
      iconName: "download",
      title: search ? "marmara-panel-no-results" : "marmara-panel-downloads-empty",
      sub: search ? null : "marmara-panel-downloads-empty-sub",
    }));
    return;
  }
  let lastDay = null;
  list = chunkedRender(shell.scroll, {
    items: downloads,
    batch: 100,
    initial: keep,
    renderItem: d => {
      const day = startOfDay(d.startTime ?? Date.now());
      const nodes = [];
      if (day != lastDay) {
        nodes.push(dayHeading(d.startTime ?? Date.now()));
        lastDay = day;
      }
      const row = buildRow(d);
      rows.set(d, row);
      nodes.push(row);
      return nodes;
    },
  });
  shell.scroll.scrollTop = scrollTop;
}

/** Tek bir indirme değişince yalnızca o satırı yeniler (ilerleme sık değişir) */
const pending = new Map();
function refreshRow(d) {
  if (pending.has(d)) {
    return;
  }
  pending.set(d, setTimeout(() => {
    pending.delete(d);
    const old = rows.get(d);
    if (old?.isConnected) {
      const fresh = buildRow(d);
      old.replaceWith(fresh);
      rows.set(d, fresh);
    }
  }, 250));
}

let renderTimer = 0;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 150);
}

async function init() {
  if (window.frameElement) {
    document.documentElement.classList.add("mm-embedded");
  }
  const menu = menuButton({
    l10n: "marmara-panel-downloads-menu",
    items: [
      { l10n: "marmara-panel-downloads-open-folder", onClick: () => backend.openFolder() },
      "-",
      { l10n: "marmara-panel-downloads-clear", onClick: clearFinished },
    ],
  });
  shell = buildShell({
    title: "marmara-panel-downloads-title",
    searchPlaceholder: "marmara-panel-downloads-search",
    menu,
    onSearch: value => {
      search = value;
      list = null;
      render();
    },
  });
  enableArrowNavigation(shell.scroll);
  document.addEventListener("keydown", event => {
    // Açık bir iç iletişim kutusu varsa Esc önce onu kapatır
    if (event.key == "Escape" && !document.querySelector("dialog[open], .mm-menu:popover-open")) {
      closePanel();
    }
  });
  translate(document.body);
  await backend.init({
    onDownloadAdded: scheduleRender,
    onDownloadRemoved: scheduleRender,
    onDownloadChanged: d => {
      // Durum değişince (bitti, hata…) satırın türü de değişir
      refreshRow(d);
    },
  });
  render();
}

init().catch(e => {
  console.error("Marmara indirilenler:", e);
  document.body.append(h("p", { class: "mm-error", text: String(e?.message ?? e) }));
});
