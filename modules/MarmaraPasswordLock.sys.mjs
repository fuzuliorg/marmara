/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Marmara: Parolalar paneli şifresi
 *
 * Ayarlar > Parolalar ve formlar'dan açılıp kapatılır. Açıkken Parolalar
 * paneli her açılışta şifre sorar. Şifre düz metin olarak saklanmaz:
 * marmara.passwords.lock tercihinde rastgele tuz + PBKDF2-SHA256 özeti durur.
 *
 * İki tür kilit vardır:
 *  - "system": bilgisayarın kendi şifresi. Windows'ta (ve macOS'ta) işletim sisteminin kendi
 *    doğrulama penceresi; Linux'ta yalnızca AppImage'da, PAM'in unix_chkpwd yardımcısıyla
 *    kullanıcının oturum şifresi doğrulanır (Flatpak sanal ortamında yoktur). Şifre
 *    Marmara tarafından saklanmaz.
 *  - "custom": Marmara'nın kendi şifresi (yukarıdaki özetle). Sistem doğrulaması olmayan
 *    ortamlarda kullanılır.
 *
 * Bu yalnızca paneli kilitler; Firefox'un kayıtlı parolaları diskte
 * saklama biçimini değiştirmez. Şifre unutulursa kurtarılamaz.
 */

const PREF = "marmara.passwords.lock";
const CHKPWD = ["/usr/bin/unix_chkpwd", "/usr/sbin/unix_chkpwd", "/sbin/unix_chkpwd", "/bin/unix_chkpwd"];
const ITERATIONS = 200000;
export const MIN_LENGTH = 4;

function webcrypto() {
  return globalThis.crypto ?? Services.appShell.hiddenDOMWindow.crypto;
}

const toHex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
const fromHex = hex => Uint8Array.from(hex.match(/../g) ?? [], pair => parseInt(pair, 16));

async function derive(password, salt, iterations) {
  const subtle = webcrypto().subtle;
  const key = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return toHex(await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

function stored() {
  try {
    const data = JSON.parse(Services.prefs.getStringPref(PREF, ""));
    return data?.mode == "system" || (data?.h && data?.s && data?.i) ? data : null;
  } catch (e) {
    return null;
  }
}

export function isEnabled() {
  return !!stored();
}

/** "system" | "custom" | null (kilit kapalı) */
export function mode() {
  const data = stored();
  return !data ? null : data.mode == "system" ? "system" : "custom";
}

function chkpwdPath() {
  for (const path of CHKPWD) {
    try {
      const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      file.initWithPath(path);
      if (file.exists()) {
        return path;
      }
    } catch (e) {
      // sıradakini dene
    }
  }
  return null;
}

/**
 * Bu ortamda bilgisayar şifresi doğrulanabiliyor mu?
 *  "os":    Windows/macOS'un kendi penceresi (authenticateOs)
 *  "linux": Marmara'nın şifre kutusu + unix_chkpwd, yalnızca AppImage'da (verifySystemPassword)
 *  null:    yok (Flatpak vb.)
 */
export function systemKind() {
  try {
    const { AppConstants } = ChromeUtils.importESModule("resource://gre/modules/AppConstants.sys.mjs");
    if (AppConstants.platform != "linux") {
      const { OSKeyStore } = ChromeUtils.importESModule("resource://gre/modules/OSKeyStore.sys.mjs");
      return OSKeyStore.canReauth() ? "os" : null;
    }
    return Services.env.get("APPIMAGE") && chkpwdPath() ? "linux" : null;
  } catch (e) {
    return null;
  }
}

/** Açılışta kilit ekranı gösterilmeli mi? (sistem doğrulaması yoksa kullanıcı dışarıda kalmasın) */
export function needsPrompt() {
  const m = mode();
  return m == "custom" || (m == "system" && systemKind() != null);
}

/** İşletim sisteminin kendi doğrulama penceresi (Windows/macOS). true: doğrulandı */
export async function authenticateOs(reason, caption, win) {
  const { OSKeyStore } = ChromeUtils.importESModule("resource://gre/modules/OSKeyStore.sys.mjs");
  try {
    return (await OSKeyStore.ensureLoggedIn(reason, caption, win, false)).authenticated;
  } catch (e) {
    return false; // iptal ya da hata
  }
}

/** Linux oturum şifresini PAM'in unix_chkpwd yardımcısıyla doğrular (yalnızca kendi hesabı) */
export async function verifySystemPassword(password) {
  const path = chkpwdPath();
  if (!path || !password) {
    return false;
  }
  try {
    const { Subprocess } = ChromeUtils.importESModule("resource://gre/modules/Subprocess.sys.mjs");
    const user = Cc["@mozilla.org/userinfo;1"].getService(Ci.nsIUserInfo).username;
    const proc = await Subprocess.call({ command: path, arguments: [user, "nullok"], stderr: "ignore" });
    await proc.stdin.write(password + "\0");
    await proc.stdin.close();
    const { exitCode } = await proc.wait();
    return exitCode === 0;
  } catch (e) {
    console.error("Marmara parola kilidi (sistem şifresi):", e);
    return false;
  }
}

/** Bilgisayar şifresiyle kilidi açar (şifre saklanmaz) */
export function enableSystem() {
  Services.prefs.setStringPref(PREF, JSON.stringify({ v: 2, mode: "system" }));
}

/** Şifreyi belirler (ya da değiştirir) */
export async function set(password) {
  const salt = webcrypto().getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  Services.prefs.setStringPref(PREF, JSON.stringify({ v: 1, s: toHex(salt), i: ITERATIONS, h: hash }));
}

/** Şifre doğru mu? Kayıtlı şifre yoksa false */
export async function verify(password) {
  const data = stored();
  if (!data || data.mode == "system") {
    return false;
  }
  const hash = await derive(password, fromHex(data.s), data.i);
  // Sabit sürede karşılaştırma
  let diff = hash.length ^ data.h.length;
  for (let i = 0; i < hash.length; i++) {
    diff |= hash.charCodeAt(i) ^ (data.h.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function clear() {
  Services.prefs.clearUserPref(PREF);
}
