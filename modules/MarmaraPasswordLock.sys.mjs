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
 * Bu yalnızca paneli kilitler; Firefox'un kayıtlı parolaları diskte
 * saklama biçimini değiştirmez. Şifre unutulursa kurtarılamaz.
 */

const PREF = "marmara.passwords.lock";
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
    return data?.h && data?.s && data?.i ? data : null;
  } catch (e) {
    return null;
  }
}

export function isEnabled() {
  return !!stored();
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
  if (!data) {
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
