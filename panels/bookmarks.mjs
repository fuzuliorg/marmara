/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Yer imleri paneli: klasörlü ağaç, arama, düzenleme (ad, adres), silme.
 * Tek bir yer imi silinince "Geri al" bildirimi çıkar; içi dolu bir klasörün
 * silinmesi onay ister.
 */

import {
  buildShell,
  chunkedRender,
  confirmDialog,
  debounce,
  emptyState,
  enableArrowNavigation,
  favicon,
  field,
  formDialog,
  h,
  icon,
  iconButton,
  openLink,
  toast,
  translate,
} from "./panel-common.mjs";

const ROOTS = [
  ["menu________", "marmara-panel-bookmarks-menu"],
  ["toolbar_____", "marmara-panel-bookmarks-toolbar"],
  ["unfiled_____", "marmara-panel-bookmarks-other"],
  ["mobile______", "marmara-panel-bookmarks-mobile"],
];
const TYPE_BOOKMARK = 1;
const TYPE_FOLDER = 2;

function realBackend() {
  const { PlacesUtils } = ChromeUtils.importESModule("resource://gre/modules/PlacesUtils.sys.mjs");
  const events = [
    "bookmark-added",
    "bookmark-removed",
    "bookmark-moved",
    "bookmark-title-changed",
    "bookmark-url-changed",
  ];
  return {
    async tree() {
      const root = await PlacesUtils.promiseBookmarksTree(PlacesUtils.bookmarks.rootGuid);
      return root?.children ?? [];
    },
    update: info => PlacesUtils.bookmarks.update(info),
    remove: guid => PlacesUtils.bookmarks.remove(guid),
    insert: info => PlacesUtils.bookmarks.insert(info),
    observe(callback) {
      const listener = () => callback();
      PlacesUtils.observers.addListener(events, listener);
      window.addEventListener("unload", () => PlacesUtils.observers.removeListener(events, listener), { once: true });
    },
  };
}

const backend = globalThis.marmaraPanelBackend ?? realBackend();

let shell;
let search = "";
let list = null;
const expanded = new Set(ROOTS.map(([guid]) => guid)); // açık klasörler

const isFolder = node => node.typeCode == TYPE_FOLDER;
const isBookmark = node => node.typeCode == TYPE_BOOKMARK && node.uri && !node.uri.startsWith("place:");

function hostOf(url) {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function countBookmarks(node) {
  return (node.children ?? []).reduce(
    (sum, child) => sum + (isFolder(child) ? countBookmarks(child) : isBookmark(child) ? 1 : 0),
    0
  );
}

// ---------------------------------------------------------------------------
// İşlemler
// ---------------------------------------------------------------------------

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return !!url.protocol && url.protocol != "javascript:";
  } catch {
    return false;
  }
}

async function editBookmark(node) {
  const name = field({ name: "name", label: "marmara-panel-bookmarks-name", value: node.title ?? "" });
  const address = field({ name: "url", label: "marmara-panel-bookmarks-address", value: node.uri });
  await formDialog({
    heading: "marmara-panel-bookmarks-edit",
    fields: [name.root, address.root],
    onSubmit: async () => {
      const url = address.input.value.trim();
      if (!isValidUrl(url)) {
        address.entry.setAttribute("aria-invalid", "true");
        return "marmara-panel-bookmarks-bad-address";
      }
      await backend.update({ guid: node.guid, title: name.input.value.trim(), url });
      return null;
    },
  });
}

async function renameFolder(node) {
  const name = field({ name: "name", label: "marmara-panel-bookmarks-name", value: node.title ?? "" });
  await formDialog({
    heading: "marmara-panel-bookmarks-rename",
    fields: [name.root],
    onSubmit: async () => {
      await backend.update({ guid: node.guid, title: name.input.value.trim() });
      return null;
    },
  });
}

async function removeBookmark(node, parentGuid) {
  await backend.remove(node.guid);
  toast({
    l10n: "marmara-panel-bookmarks-removed",
    action: "marmara-panel-undo",
    onAction: () =>
      backend.insert({
        guid: node.guid,
        parentGuid,
        index: node.index,
        title: node.title,
        url: node.uri,
      }),
  });
}

async function removeFolder(node) {
  const count = countBookmarks(node);
  const sure = await confirmDialog({
    heading: "marmara-panel-bookmarks-folder-remove-heading",
    body: count ? "marmara-panel-bookmarks-folder-remove-body" : "marmara-panel-bookmarks-folder-remove-empty",
    args: { name: node.title ?? "", count },
    warning: count ? "marmara-panel-irreversible" : null,
    confirm: "marmara-panel-bookmarks-folder-remove-confirm",
  });
  if (sure) {
    await backend.remove(node.guid);
  }
}

// ---------------------------------------------------------------------------
// Çizim
// ---------------------------------------------------------------------------

function bookmarkRow(node, parentGuid, subtitle) {
  const main = h("button", { class: "mm-main", type: "button", title: node.uri },
    favicon(node.uri),
    h("span", { class: "mm-text" },
      h("span", { class: "mm-title", text: node.title || node.uri }),
      h("span", { class: "mm-sub", text: subtitle ?? hostOf(node.uri) })));
  main.addEventListener("click", event => openLink(node.uri, event));
  main.addEventListener("auxclick", event => {
    if (event.button == 1) {
      openLink(node.uri, event);
    }
  });
  return h("div", { class: "mm-row" }, main, h("span", { class: "mm-actions" },
    iconButton({ icon: "edit", l10n: "marmara-panel-bookmarks-edit-button", onClick: () => editBookmark(node) }),
    iconButton({
      icon: "delete",
      l10n: "marmara-panel-bookmarks-remove",
      className: "destructive",
      onClick: () => removeBookmark(node, parentGuid),
    })));
}

function folderNode(node, { root = false, titleId } = {}) {
  const open = expanded.has(node.guid);
  const head = h("button", {
    class: "mm-main mm-folder-head",
    type: "button",
    "aria-expanded": String(open),
  },
    icon("chevron"),
    icon("folder"),
    h("span", { class: "mm-text" }, h("span", { class: "mm-title", l10n: titleId, text: titleId ? null : node.title })),
    h("span", { class: "mm-count", text: String(countBookmarks(node)) }));
  head.querySelector(".mm-icon").classList.add("mm-chevron");
  const children = h("div", { class: "mm-children", hidden: !open });
  const fill = () => {
    if (children.childElementCount) {
      return;
    }
    for (const child of node.children ?? []) {
      const el = nodeElement(child, node.guid);
      if (el) {
        children.append(el);
      }
    }
    translate(children);
  };
  if (open) {
    fill();
  }
  head.addEventListener("click", () => {
    const now = head.getAttribute("aria-expanded") != "true";
    head.setAttribute("aria-expanded", String(now));
    children.hidden = !now;
    if (now) {
      expanded.add(node.guid);
      fill();
    } else {
      expanded.delete(node.guid);
    }
  });
  const actions = root
    ? null
    : h("span", { class: "mm-actions" },
      iconButton({ icon: "edit", l10n: "marmara-panel-bookmarks-rename-button", onClick: () => renameFolder(node) }),
      iconButton({
        icon: "delete",
        l10n: "marmara-panel-bookmarks-folder-remove",
        className: "destructive",
        onClick: () => removeFolder(node),
      }));
  return h("div", { class: "mm-folder" }, h("div", { class: "mm-row" }, head, actions), children);
}

function nodeElement(node, parentGuid) {
  if (isFolder(node)) {
    return folderNode(node);
  }
  if (isBookmark(node)) {
    return bookmarkRow(node, parentGuid);
  }
  return null; // ayraç ve akıllı klasörler gösterilmez
}

/** Arama: tüm klasörlerdeki eşleşmeler düz liste, alt satırda klasör yolu */
function flatten(nodes, path = [], out = []) {
  for (const node of nodes) {
    if (isFolder(node)) {
      flatten(node.children ?? [], [...path, node], out);
    } else if (isBookmark(node)) {
      out.push({ node, parent: path.at(-1), path });
    }
  }
  return out;
}

async function render() {
  const scrollTop = shell.scroll.scrollTop;
  const keep = list?.shown ?? 0;
  list?.stop();
  list = null;
  const roots = await backend.tree();
  shell.scroll.replaceChildren();

  if (search) {
    const needle = search.toLocaleLowerCase();
    const matches = flatten(roots).filter(({ node }) =>
      `${node.title ?? ""} ${node.uri}`.toLocaleLowerCase().includes(needle)
    );
    if (!matches.length) {
      shell.scroll.append(emptyState({ iconName: "bookmark", title: "marmara-panel-no-results" }));
      return;
    }
    list = chunkedRender(shell.scroll, {
      items: matches,
      initial: keep,
      renderItem: ({ node, parent, path }) =>
        bookmarkRow(node, parent?.guid, path.slice(1).map(p => p.title).filter(Boolean).join(" › ") || hostOf(node.uri)),
    });
    shell.scroll.scrollTop = scrollTop;
    return;
  }

  let any = false;
  for (const [guid, titleId] of ROOTS) {
    const root = roots.find(r => r.guid == guid);
    if (!root || (guid.startsWith("mobile") && !countBookmarks(root))) {
      continue;
    }
    any = any || countBookmarks(root) > 0;
    shell.scroll.append(folderNode(root, { root: true, titleId }));
  }
  if (!any) {
    shell.scroll.replaceChildren(emptyState({
      iconName: "bookmark",
      title: "marmara-panel-bookmarks-empty",
      sub: "marmara-panel-bookmarks-empty-sub",
    }));
  }
  translate(shell.scroll);
  shell.scroll.scrollTop = scrollTop;
}

function init() {
  shell = buildShell({
    title: "marmara-panel-bookmarks-title",
    searchPlaceholder: "marmara-panel-bookmarks-search",
    onSearch: value => {
      search = value;
      list = null;
      render();
    },
  });
  enableArrowNavigation(shell.scroll);
  backend.observe(debounce(render));
  render();
}

init();
