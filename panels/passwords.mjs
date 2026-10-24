/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Parolalar paneli: kayıtlı girişler, arama, ayrıntı / düzenleme, silme.
 *
 * Parolayı göstermek, kopyalamak ve düzenlemeye açmak için Windows ve macOS'ta
 * işletim sisteminin kendi parola / Hello / Touch ID penceresi çıkar (sistem
 * parolası yoksa doğrudan geçer). Firefox Linux'ta bunu desteklemediğinden
 * (bug 1527745) orada doğrulama yoktur. Silmeler ve tümünü silme geri
 * alınamaz uyarısı gösterir.
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
  format,
  h,
  icon,
  iconButton,
  menuButton,
  showDialog,
  toast,
  topWindow,
  translate,
} from "./panel-common.mjs";

const MASK = "••••••••••";
const UNLOCK_MS = 30000; // doğrulamadan sonra kısa bir süre yeniden sorulmaz

function realBackend() {
  const { OSKeyStore } = ChromeUtils.importESModule("resource://gre/modules/OSKeyStore.sys.mjs");
  return {
    async list() {
      const logins = await Services.logins.getAllLogins();
      return logins
        .filter(login => !login.origin.startsWith("chrome:"))
        .map(login => ({ login, guid: login.guid, origin: login.origin, username: login.username }));
    },
    passwordOf: entry => entry.login.password,
    async modify(entry, { username, password }) {
      const updated = entry.login.clone().QueryInterface(Ci.nsILoginInfo);
      updated.username = username;
      updated.password = password;
      await Services.logins.modifyLoginAsync(entry.login, updated);
    },
    remove: entry => Services.logins.removeLoginAsync(entry.login),
    removeAll: () => Services.logins.removeAllUserFacingLoginsAsync(),
    observe(callback) {
      const observer = { observe: () => callback() };
      Services.obs.addObserver(observer, "passwordmgr-storage-changed");
      window.addEventListener("unload", () => Services.obs.removeObserver(observer, "passwordmgr-storage-changed"), { once: true });
    },
    async authenticate() {
      // Yalnızca işletim sisteminin kendi parola penceresi olan platformlarda (Windows,
      // macOS) sorulur; Linux'ta Firefox bunu desteklemediği için doğrulama yok.
      if (!OSKeyStore.canReauth()) {
        return true;
      }
      try {
        const reason = await format("marmara-panel-passwords-auth-reason");
        const caption = await format("marmara-panel-passwords-auth-caption");
        return (await OSKeyStore.ensureLoggedIn(reason, caption, topWindow(), false)).authenticated;
      } catch (e) {
        console.error("Marmara parolalar (kimlik doğrulama):", e);
        return false; // iptal ya da hata: parola gösterilmez
      }
    },
    copy: text => Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(text),
    openSettings: () => topWindow().openPreferences("passwords"),
  };
}

const backend = globalThis.marmaraPanelBackend ?? realBackend();

let shell;
let search = "";
let entries = [];
let list = null;
let unlockedUntil = 0;

async function ensureUnlocked() {
  if (Date.now() < unlockedUntil) {
    return true;
  }
  if (await backend.authenticate()) {
    unlockedUntil = Date.now() + UNLOCK_MS;
    return true;
  }
  return false;
}

function hostOf(origin) {
  try {
    return new URL(origin).host || origin;
  } catch {
    return origin;
  }
}

// ---------------------------------------------------------------------------
// İşlemler
// ---------------------------------------------------------------------------

async function removeEntry(entry) {
  const sure = await confirmDialog({
    heading: "marmara-panel-passwords-remove-heading",
    body: "marmara-panel-passwords-remove-body",
    args: { site: hostOf(entry.origin) },
    warning: "marmara-panel-irreversible",
    confirm: "marmara-panel-passwords-remove-confirm",
  });
  if (!sure) {
    return false;
  }
  await backend.remove(entry);
  return true;
}

async function removeAll() {
  const sure = await confirmDialog({
    heading: "marmara-panel-passwords-remove-all-heading",
    body: "marmara-panel-passwords-remove-all-body",
    args: { count: entries.length },
    warning: "marmara-panel-irreversible",
    confirm: "marmara-panel-passwords-remove-all-confirm",
  });
  if (sure) {
    await backend.removeAll();
  }
}

function copyWithToast(text) {
  backend.copy(text);
  toast({ l10n: "marmara-panel-copied", timeout: 2500 });
}

/** Düzenleme kutusu: kimlik doğrulandıktan sonra kullanıcı adı ve parola değiştirilebilir. */
async function editEntry(entry) {
  if (!(await ensureUnlocked())) {
    return;
  }
  const user = field({ name: "username", label: "marmara-panel-passwords-username", value: entry.username });
  const pass = field({
    name: "password",
    label: "marmara-panel-passwords-password",
    value: backend.passwordOf(entry),
    type: "password", // Firefox parola alanına kendi göz (göster/gizle) düğmesini ekler
  });
  await formDialog({
    heading: "marmara-panel-passwords-edit",
    fields: [user.root, pass.root],
    onSubmit: async () => {
      try {
        await backend.modify(entry, { username: user.input.value, password: pass.input.value });
        return null;
      } catch (e) {
        console.error("Marmara parolalar:", e);
        return /exist/i.test(String(e?.message ?? e))
          ? "marmara-panel-passwords-duplicate"
          : "marmara-panel-passwords-save-failed";
      }
    },
  });
}

/** Parola ayrıntı kutusu: gösterme ve kopyalama kimlik doğrulaması ister. */
function openEntry(entry) {
  let revealed = false;
  const host = hostOf(entry.origin);
  const user = h("input", { type: "text", autocomplete: "off", spellcheck: "false", readonly: true });
  user.value = entry.username;
  const pass = h("input", { type: "text", autocomplete: "off", spellcheck: "false", readonly: true });
  pass.value = MASK;

  const setEye = () => {
    eye.replaceChildren(icon(revealed ? "eye-slash" : "eye"));
    eye.setAttribute("data-l10n-id", revealed ? "marmara-panel-passwords-hide" : "marmara-panel-passwords-show");
    translate(eye);
  };
  const eye = iconButton({
    icon: "eye",
    l10n: "marmara-panel-passwords-show",
    onClick: async () => {
      if (!revealed && !(await ensureUnlocked())) {
        return;
      }
      revealed = !revealed;
      pass.value = revealed ? backend.passwordOf(entry) : MASK;
      setEye();
    },
  });
  const copyUser = iconButton({
    icon: "copy",
    l10n: "marmara-panel-passwords-copy-username",
    onClick: () => copyWithToast(user.value),
  });
  const copyPass = iconButton({
    icon: "copy",
    l10n: "marmara-panel-passwords-copy-password",
    onClick: async () => {
      if (await ensureUnlocked()) {
        copyWithToast(backend.passwordOf(entry));
      }
    },
  });
  const close = iconButton({ icon: "close", l10n: "marmara-panel-close", className: "mm-dialog-close", onClick: () => dialog.close() });
  const button = (cls, l10n, onClick) => {
    const el = h("button", { class: `mm-pill ${cls}`.trim(), type: "button", l10n });
    el.addEventListener("click", onClick);
    return el;
  };
  const dialog = h("dialog", { class: "mm-dialog", tabindex: "-1" },
    close,
    h("h2", { text: host }),
    h("div", { class: "mm-fields" },
      h("div", { class: "mm-field" },
        h("span", { class: "mm-label", l10n: "marmara-panel-passwords-site" }),
        h("div", { class: "mm-entry" }, h("span", { class: "mm-value", text: host }))),
      h("div", { class: "mm-field" },
        h("label", { l10n: "marmara-panel-passwords-username" }),
        h("div", { class: "mm-entry" }, user, copyUser)),
      h("div", { class: "mm-field" },
        h("label", { l10n: "marmara-panel-passwords-password" }),
        h("div", { class: "mm-entry" }, pass, eye, copyPass))),
    h("div", { class: "mm-buttons" },
      button("outline", "marmara-panel-passwords-remove", async () => {
        if (await removeEntry(entry)) {
          dialog.close();
        }
      }),
      button("suggested", "marmara-panel-passwords-edit", async () => {
        dialog.close();
        await editEntry(entry);
      })));
  showDialog(dialog);
  dialog.focus(); // alanlardan birine odaklanıp yanlışlıkla düzenlenmesin
}

// ---------------------------------------------------------------------------
// Çizim
// ---------------------------------------------------------------------------

function entryRow(entry) {
  const main = h("button", { class: "mm-main", type: "button" },
    favicon(entry.origin),
    h("span", { class: "mm-text" },
      h("span", { class: "mm-title", text: hostOf(entry.origin) }),
      entry.username
        ? h("span", { class: "mm-sub", text: entry.username })
        : h("span", { class: "mm-sub", l10n: "marmara-panel-passwords-no-username" })));
  main.addEventListener("click", () => openEntry(entry));
  return h("div", { class: "mm-row" }, main, h("span", { class: "mm-actions" },
    iconButton({
      icon: "edit",
      l10n: "marmara-panel-passwords-edit-button",
      onClick: () => editEntry(entry),
    }),
    iconButton({
      icon: "delete",
      l10n: "marmara-panel-passwords-remove-button",
      className: "destructive",
      onClick: () => removeEntry(entry),
    })));
}

async function render() {
  const scrollTop = shell.scroll.scrollTop;
  const keep = list?.shown ?? 0;
  list?.stop();
  list = null;
  entries = (await backend.list()).sort(
    (a, b) => hostOf(a.origin).localeCompare(hostOf(b.origin)) || a.username.localeCompare(b.username)
  );
  shell.scroll.replaceChildren();
  const needle = search.toLocaleLowerCase();
  const shown = needle
    ? entries.filter(e => `${hostOf(e.origin)} ${e.username}`.toLocaleLowerCase().includes(needle))
    : entries;
  if (!shown.length) {
    const empty = emptyState({
      iconName: "login",
      title: search ? "marmara-panel-no-results" : "marmara-panel-passwords-empty",
      sub: search ? null : "marmara-panel-passwords-empty-sub",
    });
    if (!search) {
      const settings = h("button", { class: "mm-pill", type: "button", l10n: "marmara-panel-passwords-open-settings" });
      settings.addEventListener("click", () => backend.openSettings());
      empty.append(settings);
      translate(empty);
    }
    shell.scroll.append(empty);
    return;
  }
  list = chunkedRender(shell.scroll, { items: shown, renderItem: entryRow, initial: keep });
  shell.scroll.scrollTop = scrollTop;
}

function init() {
  const menu = menuButton({
    l10n: "marmara-panel-passwords-menu",
    items: [
      { l10n: "marmara-panel-passwords-open-settings", onClick: () => backend.openSettings() },
      "-",
      { l10n: "marmara-panel-passwords-remove-all", destructive: true, onClick: removeAll },
    ],
  });
  shell = buildShell({
    title: "marmara-panel-passwords-title",
    searchPlaceholder: "marmara-panel-passwords-search",
    menu,
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
