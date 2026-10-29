/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Marmara: "Hakkında" iletişim kutusu
 *
 * libadwaita'nın AdwAboutDialog'una göre: ortada simge, ad, geliştirici ve
 * sürüm; altında bağlantılar ile "Oluşturanlar" ve "Yasal" alt sayfaları.
 * Ayrı bir pencere yerine tarayıcı penceresinin içinde, yuvarlak köşeli bir
 * iletişim kutusu olarak açılır. Görünümü theme/browser/about.css'te.
 *
 * utilityOverlay.js'teki openAboutDialog() buraya yönlendirilir
 * (scripts/patch_omni.py). Metinler l10n/*\/marmara.ftl'de.
 */

const HTML_NS = "http://www.w3.org/1999/xhtml";

// Sürüm numarası distribution.ini ile aynı tutulur.
const VERSION = "1.0";
export const MARMARA_VERSION = VERSION;
const WEBSITE = "https://marmara.fuzuli.org";
const REPORT_ISSUE = "https://github.com/fuzuliorg/marmara/issues/new";

const ICON_EXTERNAL = "chrome://global/skin/icons/open-in-new.svg";
const ICON_NEXT = "chrome://global/skin/icons/arrow-right.svg";
const ICON_BACK = "chrome://global/skin/icons/arrow-left.svg";
const ICON_CLOSE = "chrome://global/skin/icons/close.svg";
const LOGO = "chrome://branding/content/about-logo.svg";

// Marmara'nın içinde gelen üçüncü taraf bileşenler ve lisansları
const THIRD_PARTY = [
  ["LibreWolf", "MPL-2.0"],
  ["Mozilla Firefox", "MPL-2.0"],
  ["uBlock Origin", "GPL-3.0"],
  ["Privacy Badger", "GPL-3.0"],
  ["ClearURLs", "LGPL-3.0"],
  ["ToS;DR", "CC BY-SA"],
  ["Inter", "OFL-1.1"],
  ["Phosphor Icons", "MIT"],
];

// Alt sayfalar: başlık iletisi ve bölümleri (başlık iletisi, gövde iletisi)
const PAGES = {
  credits: {
    title: "marmara-about-credits",
    sections: [
      { heading: "marmara-about-credits-made-by", names: [{ l10n: "marmara-about-developer" }] },
      { heading: "marmara-about-credits-based-on", names: ["LibreWolf", "Mozilla Firefox"] },
    ],
  },
  legal: {
    title: "marmara-about-legal",
    sections: [
      { heading: "marmara-about-legal-license", body: "marmara-about-legal-license-text" },
      { heading: "marmara-about-legal-copyright", body: "marmara-about-legal-copyright-text" },
      { heading: "marmara-about-legal-trademarks", body: "marmara-about-legal-trademarks-text" },
      { heading: "marmara-about-legal-third-party", components: THIRD_PARTY },
    ],
  },
};

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

function icon(doc, src) {
  return create(doc, "img", { className: "marmara-about-icon", attrs: { src, alt: "" } });
}

class AboutDialog {
  constructor(win) {
    this.win = win;
    this.doc = win.document;
  }

  /** Satır: bağlantı (dış simge) ya da alt sayfa (ok simgesi) */
  #row(l10n, trailingIcon, onClick) {
    const row = create(
      this.doc,
      "button",
      { className: "marmara-about-row", attrs: { type: "button" } },
      create(this.doc, "span", { l10n }),
      icon(this.doc, trailingIcon)
    );
    row.addEventListener("click", onClick);
    return row;
  }

  #openLink(url) {
    this.close();
    this.win.openTrustedLinkIn(url, "tab");
  }

  #mainPage() {
    const { doc } = this;
    const page = create(
      doc,
      "div",
      { className: "marmara-about-page marmara-about-main" },
      create(doc, "img", { className: "marmara-about-logo", attrs: { src: LOGO, alt: "" } }),
      create(doc, "h1", { className: "marmara-about-name", attrs: { id: "marmara-about-name" }, text: "Marmara" }),
      create(doc, "div", { className: "marmara-about-developer", l10n: "marmara-about-developer" }),
      create(doc, "div", { className: "marmara-about-version", text: VERSION }),
      create(
        doc,
        "div",
        { className: "marmara-about-group" },
        this.#row("marmara-about-website", ICON_EXTERNAL, () => this.#openLink(WEBSITE)),
        this.#row("marmara-about-report", ICON_EXTERNAL, () => this.#openLink(REPORT_ISSUE))
      ),
      create(
        doc,
        "div",
        { className: "marmara-about-group" },
        this.#row("marmara-about-credits", ICON_NEXT, () => this.#show("credits")),
        this.#row("marmara-about-legal", ICON_NEXT, () => this.#show("legal"))
      )
    );
    return page;
  }

  #subPage(name) {
    const { doc } = this;
    const spec = PAGES[name];
    const back = create(
      doc,
      "button",
      { className: "marmara-about-round marmara-about-back", l10n: "marmara-about-back", attrs: { type: "button" } },
      icon(doc, ICON_BACK)
    );
    back.addEventListener("click", () => this.#show("main"));

    const body = create(doc, "div", { className: "marmara-about-sections" });
    for (const section of spec.sections) {
      const box = create(doc, "section", { className: "marmara-about-section" });
      box.append(create(doc, "h2", { l10n: section.heading }));
      if (section.body) {
        box.append(create(doc, "p", { l10n: section.body }));
      }
      for (const name of section.names ?? []) {
        const line = typeof name == "string" ? { text: name } : name;
        box.append(create(doc, "p", { className: "marmara-about-name-line", ...line }));
      }
      if (section.components) {
        const group = create(doc, "div", { className: "marmara-about-group" });
        for (const [component, license] of section.components) {
          group.append(
            create(
              doc,
              "div",
              { className: "marmara-about-row marmara-about-static" },
              create(doc, "span", { text: component }),
              create(doc, "span", { className: "marmara-about-license", text: license })
            )
          );
        }
        box.append(group);
      }
      body.append(box);
    }

    return create(
      doc,
      "div",
      { className: "marmara-about-page marmara-about-sub" },
      create(
        doc,
        "div",
        { className: "marmara-about-subheader" },
        back,
        create(doc, "h1", { l10n: spec.title })
      ),
      body
    );
  }

  /** Sayfayı gösterir: "main", "credits" ya da "legal" */
  #show(name) {
    const page = name == "main" ? this.#mainPage() : this.#subPage(name);
    this.content.replaceChildren(page);
    this.content.scrollTop = 0;
    this.doc.l10n.translateFragment(page);
    (name == "main" ? page.querySelector(".marmara-about-row") : page.querySelector(".marmara-about-back"))?.focus();
  }

  close() {
    this.dialog?.close();
  }

  open() {
    const { doc } = this;
    const close = create(
      doc,
      "button",
      { className: "marmara-about-round marmara-about-close", l10n: "marmara-about-close", attrs: { type: "button" } },
      icon(doc, ICON_CLOSE)
    );
    close.addEventListener("click", () => this.close());

    this.content = create(doc, "div", { className: "marmara-about-content" });
    this.dialog = create(
      doc,
      "dialog",
      { className: "marmara-about", attrs: { "aria-labelledby": "marmara-about-name" } },
      close,
      this.content
    );
    // Dışına tıklamak kapatır
    this.dialog.addEventListener("click", event => {
      if (event.target == this.dialog) {
        this.close();
      }
    });
    this.dialog.addEventListener("close", () => this.dialog.remove());

    doc.documentElement.append(this.dialog);
    doc.l10n.translateFragment(close);
    this.#show("main");
    this.dialog.showModal();
    // showModal() ilk odaklanabilir öğeyi (kapat) seçer; odak ilk satıra verilir
    this.dialog.querySelector(".marmara-about-row")?.focus();
  }
}

export const MarmaraAbout = {
  /** Hakkında kutusunu verilen tarayıcı penceresinde açar (zaten açıksa dokunmaz). */
  show(win) {
    if (win.document.querySelector("dialog.marmara-about")) {
      return;
    }
    new AboutDialog(win).open();
  },
};
