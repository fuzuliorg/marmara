# Building and contributing

Marmara does not compile Firefox. `build.sh` takes LibreWolf's ready-made files, patches
them and repacks them. (Türkçe notlar kod içi yorumlardadır.)

## Build

```sh
sudo pacman -S --needed librewolf python unzip zip     # Arch; otherwise download LibreWolf's Linux archive
./build.sh                      # builds from /usr/lib/librewolf → dist/marmara/
./dist/marmara/marmara          # try it
./scripts/install-local.sh      # add to the app menu (no root needed)
```

From LibreWolf's official Linux archive:

```sh
./build.sh librewolf-<version>-linux-x86_64-package.tar.xz --tarball
```

Arch package: `cd packaging/arch && makepkg -sif`.

## Layout

| Path | Contents |
|---|---|
| `build.sh` | One-command repack script |
| `theme/global/tokens.css` | Global Adwaita palette (menus, panels, about: pages) |
| `theme/browser/*.css` | Browser window: colors, sizes, header bar, tabs, content, settings, welcome |
| `modules/` | Marmara's JavaScript modules (settings, about, welcome, ToS;DR, app menu…) |
| `l10n/` | Turkish and English strings (Fluent) |
| `branding/` | Logo (`marmara.svg`), icons, brand strings |
| `config/policies.json` | Enterprise policies (based on LibreWolf's) |
| `config/extensions.json` | Preinstalled extensions |
| `config/marmara-prefs.js` | Marmara's settings added on top of LibreWolf's |
| `scripts/patch_omni.py` | Patches inside `omni.ja` |
| `scripts/check_theme.py` | Checks the theme against a new Firefox version |
| `packaging/` | Linux launcher, `.desktop` file, Arch `PKGBUILD` |
| `flatpak/` | Flatpak manifest and metadata |
| `ci/` | Workflow sources (they live in `.github/workflows/` on GitHub) |

## How the theme stays stable

Firefox keeps its colors and sizes in CSS variables ("tokens") inside `@layer`s. Marmara's
rules have no layer, so they always win. Most of the theme depends on token names, not
selectors, and those rarely change between Firefox versions. The few selector-based rules
live in separate files (`headerbar.css`, `tabs.css`, `content.css`), so if one breaks only
that part is affected.

On every build `check_theme.py` verifies that each token, id and class the theme uses
still exists in the new version, and prints which file is affected if not.

To disable a part, remove its `@import` line in `theme/browser/marmara.css` and rebuild.

## Moving to a new LibreWolf version

```sh
./build.sh
```

If there is no "HATA" (error) and no ✗ in the theme check, the version is fine. Update
`LIBREWOLF_VERSION` to the new version number.

## Automation (GitHub Actions)

- **LibreWolf güncellemesi** (`librewolf-update.yml`) builds Marmara and opens a GitHub
  release. It runs when Marmara's code (modules, theme, l10n, scripts, config…) is pushed
  to `main`, every 6 hours to look for a new LibreWolf, or by hand with *Run workflow*
  (tick *force* to release even if LibreWolf has not changed). Version numbers go
  1.0 → 1.0.1 …; it does not write back to the repository. If the patches no longer fit
  a new Firefox, it opens an issue.
- **Flatpak deposu** (`flatpak-repo.yml`) runs after a release: it packages the Flatpak,
  signs it with GPG and publishes the repository to GitHub Pages
  (`https://fuzuliorg.github.io/marmara/`).

Set-up (once):

1. Create a signing key (no passphrase):
   ```sh
   gpg --batch --passphrase '' --quick-generate-key "Marmara Flatpak" rsa4096 sign never
   gpg --armor --export-secret-keys "Marmara Flatpak"
   ```
2. In the GitHub repository: **Settings → Secrets and variables → Actions → New repository
   secret**, name `FLATPAK_GPG_PRIVATE_KEY`, value the full output above.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Actions → Flatpak deposu → Run workflow**.

Never share the private key or commit it.

To change the version number by hand: `scripts/bump-version.sh 1.1` (updates `VERSION`, the
About dialog, `distribution.ini` and the `.desktop` file together).

## Flatpak (local build)

```sh
sha256sum marmara-<version>-linux-x86_64.tar.xz   # put the output in the manifest's sha256
flatpak install flathub org.freedesktop.Platform//25.08 org.freedesktop.Sdk//25.08 org.mozilla.firefox.BaseApp//25.08
cd flatpak
flatpak-builder --user --install --force-clean build-dir io.github.fuzuliorg.Marmara.yml
flatpak run io.github.fuzuliorg.Marmara
```

## Trademark

The Marmara name and logo are not under the code license; see [TRADEMARK.md](TRADEMARK.md).
If you fork the project, pick your own name and logo (the strings and assets to replace
are listed in `scripts/patch_omni.py` and `branding/`).
