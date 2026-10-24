#!/usr/bin/env python3
"""config/policies.json + config/extensions.json -> dağıtılacak policies.json

Kullanım: python3 scripts/make_policies.py <çıktı-yolu> [--offline]

İnternet varsa her eklentinin kimliğini (guid) addons.mozilla.org'dan
doğrular. Kimlik değişmişse config/extensions.json'u günceller ve bunu
ekrana yazar. İnternet yoksa dosyadaki kimliklerle devam eder.
"""
import json
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXT_FILE = ROOT / "config" / "extensions.json"
POLICY_FILE = ROOT / "config" / "policies.json"
AMO_API = "https://addons.mozilla.org/api/v5/addons/addon/{slug}/"
XPI_URL = "https://addons.mozilla.org/firefox/downloads/latest/{slug}/latest.xpi"


def amo_guid(slug: str) -> str | None:
    try:
        req = urllib.request.Request(AMO_API.format(slug=slug), headers={"User-Agent": "marmara-build"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.load(r)["guid"]
    except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError):
        return None


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    out = pathlib.Path(sys.argv[1])
    offline = "--offline" in sys.argv

    ext_doc = json.loads(EXT_FILE.read_text(encoding="utf-8"))
    changed = False
    for ext in ext_doc["extensions"]:
        if offline:
            print(f"  • {ext['name']}: {ext['id']} (doğrulanmadı, çevrimdışı)")
            continue
        guid = amo_guid(ext["slug"])
        if guid is None:
            print(f"  • {ext['name']}: AMO'ya ulaşılamadı, dosyadaki kimlik kullanılıyor ({ext['id']})")
        elif guid != ext["id"]:
            print(f"  • {ext['name']}: kimlik güncellendi {ext['id']} → {guid}")
            ext["id"] = guid
            changed = True
        else:
            print(f"  • {ext['name']}: {guid} ✓")
    if changed:
        EXT_FILE.write_text(json.dumps(ext_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    policies = json.loads(POLICY_FILE.read_text(encoding="utf-8"))
    settings = policies["policies"].setdefault("ExtensionSettings", {})
    for ext in ext_doc["extensions"]:
        settings[ext["id"]] = {
            "install_url": XPI_URL.format(slug=ext["slug"]),
            # "allowed": politika kurmaz, kaldırılabilir bırakır. İlk kurulumu
            # modules/MarmaraExtensions.sys.mjs bir kez yapar (install_url'den).
            "installation_mode": "allowed",
            "private_browsing": True,
            # Düğmesi araç çubuğunda değil, eklentiler (yapboz) menüsünde dursun
            "default_area": "menupanel",
        }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(policies, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
