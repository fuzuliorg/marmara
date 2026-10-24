/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Marmara: ilk açılış karşılaması
 *
 * Tarayıcı ilk kez açıldığında pencere içinde, Adwaita görünümlü bir kutu
 * gösterir ve şunları sorar: dil, tema, hizmet koşulları notu (ToS;DR), arama motoru. Arama motoru önceden
 * seçili gelmez; kullanıcı kendisi seçer. Bitince (ya da atlanınca)
 * marmara.welcome.done işaretlenir ve bir daha gösterilmez.
 *
 * components.manifest'teki "browser-window-delayed-startup" kaydıyla her
 * tarayıcı penceresi için initWindow çağrılır.
 */

const HTML_NS = "http://www.w3.org/1999/xhtml";
const PREF_DONE = "marmara.welcome.done";
const CHECK_ICON = "chrome://global/skin/icons/check.svg";
const LOGO = "chrome://branding/content/about-logo.svg";

const id = key => `marmara-welcome-${key}`;

function create(doc, tag, { className, l10n, text, attrs } = {}, ...children) {
  const node = doc.createElementNS(HTML_NS, tag);
  if (className) {
    node.className = className;
  }
  if (l10n) {
    node.setAttribute("data-l10n-id", l10n);
  }
  if (text) {
    node.textContent = text;
  }
  for (const [name, value] of Object.entries(attrs ?? {})) {
    node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

class WelcomeDialog {
  constructor(win) {
    this.win = win;
    this.doc = win.document;
    const { themeBinding, localeBinding, LANGUAGES, restartBrowser } = ChromeUtils.importESModule(
      "resource:///modules/MarmaraSettings.sys.mjs"
    ).MarmaraSettingsShared;
    this.shared = { themeBinding, localeBinding, LANGUAGES, restartBrowser };
    this.initialLocale = localeBinding.get();
    this.engines = [];
    this.engineChoice = null; // kullanıcı seçene kadar boş
    this.index = 0;
    this.steps = [
      { key: "language", build: () => this.#languageList() },
      { key: "theme", build: () => this.#themeList() },
      { key: "tosdr", build: () => this.#tosdrList() },
      { key: "passwords", build: () => this.#passwordsList() },
      { key: "search", build: () => this.#searchList() },
    ];
  }

  /** Seçenek satırı: bir "radyo" davranışı; seçili olanda onay işareti görünür */
  #choiceRow({ label, l10n, selected, onPick }) {
    const row = create(
      this.doc,
      "button",
      { className: "marmara-settings-row clickable marmara-welcome-choice", attrs: { type: "button", role: "radio", "aria-checked": String(selected) } },
      create(this.doc, "span", { className: "marmara-settings-title", l10n, text: label }),
      create(this.doc, "img", { className: "marmara-welcome-check", attrs: { src: CHECK_ICON, alt: "" } })
    );
    row.addEventListener("click", () => {
      for (const sibling of row.parentElement.children) {
        sibling.setAttribute("aria-checked", String(sibling == row));
      }
      onPick();
      this.#syncButtons();
    });
    return row;
  }

  #card(...rows) {
    return create(this.doc, "div", { className: "marmara-settings-card", attrs: { role: "radiogroup" } }, ...rows);
  }

  #languageList() {
    const { localeBinding, LANGUAGES } = this.shared;
    const current = localeBinding.get();
    return this.#card(
      ...LANGUAGES.map(([code, name]) =>
        this.#choiceRow({ label: name, selected: code == current, onPick: () => localeBinding.set(code) })
      )
    );
  }

  #themeList() {
    const { themeBinding } = this.shared;
    const current = themeBinding.get();
    const options = [
      ["auto", "marmara-settings-theme-auto"],
      ["light", "marmara-settings-theme-light"],
      ["dark", "marmara-settings-theme-dark"],
    ];
    return this.#card(
      ...options.map(([value, l10n]) =>
        // Tema seçilince hemen uygulanır; kutu da yeni renklere geçer
        this.#choiceRow({ l10n, selected: value == current, onPick: () => themeBinding.set(value) })
      )
    );
  }

  /** Hizmet koşulları notu: alan adı ToS;DR'a gittiği için açıkça sorulur, varsayılan "gösterme" */
  #tosdrList() {
    const pref = "marmara.tosdr.enabled";
    const on = Services.prefs.getBoolPref(pref, false);
    return this.#card(
      this.#choiceRow({ l10n: id("tosdr-off"), selected: !on, onPick: () => Services.prefs.setBoolPref(pref, false) }),
      this.#choiceRow({ l10n: id("tosdr-on"), selected: on, onPick: () => Services.prefs.setBoolPref(pref, true) })
    );
  }

  /** Parolaları kaydetme: varsayılan kapalı; seçim signon.rememberSignons'a yazılır */
  #passwordsList() {
    const pref = "signon.rememberSignons";
    const on = Services.prefs.getBoolPref(pref, false);
    return this.#card(
      this.#choiceRow({ l10n: id("passwords-off"), selected: !on, onPick: () => Services.prefs.setBoolPref(pref, false) }),
      this.#choiceRow({ l10n: id("passwords-on"), selected: on, onPick: () => Services.prefs.setBoolPref(pref, true) })
    );
  }

  #searchList() {
    const card = this.#card();
    (async () => {
      try {
        const { SearchService } = ChromeUtils.importESModule(
          "moz-src:///toolkit/components/search/SearchService.sys.mjs"
        );
        await SearchService.init();
        this.engines = await SearchService.getVisibleEngines();
        for (const engine of this.engines) {
          card.append(
            this.#choiceRow({
              label: engine.name,
              selected: false,
              onPick: () => {
                this.engineChoice = engine;
              },
            })
          );
        }
        this.SearchService = SearchService;
      } catch (e) {
        console.error("Marmara karşılama (arama motorları):", e);
        // Motor listesi alınamazsa kullanıcı engellenmesin
        this.engineChoice = false;
        this.#syncButtons();
      }
    })();
    return card;
  }

  #syncButtons() {
    const last = this.index == this.steps.length - 1;
    this.back.hidden = this.index == 0;
    this.skip.hidden = last;
    const needsRestart = this.shared.localeBinding.get() != this.initialLocale;
    this.next.setAttribute("data-l10n-id", id(last ? (needsRestart ? "restart" : "finish") : "next"));
    this.next.disabled = last && this.engineChoice === null;
    this.doc.l10n.translateFragment(this.footer);
    this.dots.forEach((dot, i) => dot.classList.toggle("current", i == this.index));
  }

  #showStep() {
    const step = this.steps[this.index];
    this.title.setAttribute("data-l10n-id", id(`${step.key}-title`));
    this.sub.setAttribute("data-l10n-id", id(`${step.key}-sub`));
    this.body.replaceChildren(step.build());
    this.doc.l10n.translateFragment(this.dialog);
    this.#syncButtons();
  }

  async #finish() {
    try {
      if (this.engineChoice && this.SearchService) {
        const reason = this.SearchService.CHANGE_REASON.USER;
        await this.SearchService.setDefault(this.engineChoice, reason);
        await this.SearchService.setDefaultPrivate(this.engineChoice, reason);
      }
    } catch (e) {
      console.error("Marmara karşılama (arama motoru):", e);
    }
    const restart = this.shared.localeBinding.get() != this.initialLocale;
    this.dialog.close();
    if (restart) {
      this.shared.restartBrowser();
    }
  }

  open() {
    const { doc } = this;
    this.title = create(doc, "h1", { className: "marmara-welcome-title" });
    this.sub = create(doc, "p", { className: "marmara-welcome-sub" });
    this.body = create(doc, "div", { className: "marmara-welcome-body" });

    this.dots = this.steps.map(() => create(doc, "span", { className: "marmara-welcome-dot" }));
    this.back = create(doc, "button", { className: "marmara-settings-pill", l10n: id("back"), attrs: { type: "button" } });
    this.skip = create(doc, "button", { className: "marmara-settings-pill", l10n: id("skip"), attrs: { type: "button" } });
    this.next = create(doc, "button", { className: "marmara-settings-pill suggested", attrs: { type: "button" } });
    const dots = create(doc, "div", { className: "marmara-welcome-dots", attrs: { "aria-hidden": "true" } }, ...this.dots);
    this.footer = create(
      doc,
      "footer",
      { className: "marmara-welcome-footer" },
      create(doc, "div", { className: "marmara-welcome-side" }, this.back, this.skip),
      dots,
      create(doc, "div", { className: "marmara-welcome-side end" }, this.next)
    );

    this.back.addEventListener("click", () => {
      this.index--;
      this.#showStep();
    });
    this.skip.addEventListener("click", () => this.dialog.close());
    this.next.addEventListener("click", () => {
      if (this.index < this.steps.length - 1) {
        this.index++;
        this.#showStep();
      } else {
        this.#finish();
      }
    });

    const logo = create(doc, "img", { className: "marmara-welcome-logo", attrs: { src: LOGO, alt: "" } });
    this.dialog = create(
      doc,
      "dialog",
      { className: "marmara-welcome-dialog", attrs: { "aria-labelledby": "marmara-welcome-heading" } },
      logo,
      this.title,
      this.sub,
      this.body,
      this.footer
    );
    this.title.id = "marmara-welcome-heading";
    // Hangi yolla kapanırsa kapansın bir daha gösterilmez
    this.dialog.addEventListener("close", () => {
      Services.prefs.setBoolPref(PREF_DONE, true);
      this.dialog.remove();
    });

    doc.documentElement.append(this.dialog);
    this.#showStep();
    this.dialog.showModal();
  }
}

export const MarmaraWelcome = {
  /** browser-window-delayed-startup: ilk bağımsız değişken pencerenin kendisi */
  initWindow(win) {
    try {
      if (
        !win?.toolbar?.visible ||
        win.document.querySelector("dialog.marmara-welcome-dialog") ||
        Services.prefs.getBoolPref(PREF_DONE, false) ||
        Services.appinfo.inSafeMode
      ) {
        return;
      }
      win.MozXULElement.insertFTLIfNeeded("browser/marmara.ftl");
      // Pencere tam çizildikten sonra göster
      win.requestIdleCallback(() => new WelcomeDialog(win).open());
    } catch (e) {
      console.error("Marmara karşılama:", e);
    }
  },
};
