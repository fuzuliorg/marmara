# Marmara

**Basit ve şeffaf.**

🇬🇧 [English](README.md)

Marmara, [LibreWolf](https://librewolf.net) (dolayısıyla Firefox) üzerine kuruludur.
LibreWolf'un gizlilik odaklı tarayıcısına GNOME İnsan Arayüzü Yönergeleri'ni izleyen temiz
bir tasarım, sade ayarlar, birkaç ek özellik ve kendi adını verir. Sıfırdan yazılmış bir tarayıcı değildir ve Firefox'u derlemez.
LibreWolf'un hazır dosyalarını yeniden paketler. Bu yüzden her yeni LibreWolf sürümü
kendiliğinden yeni bir Marmara sürümüne dönüşebilir.

![Adwaita görünümlü sekmeler ve adres çubuğu](flatpak/screenshot-1.png)

## Fikir

Marmara'nın ilham kaynağı deniz anaları, logosu da öyle.

- Deniz anası gibi **şeffaf**: kod açık kaynaktır, hiçbir şey gizli değildir, telemetri
  yoktur ve sizin yerinize bir şey seçilmez.
- Biçimi gibi **basit**: kullanımı kolay ve işlevsel. Akıllı varsayılanlar, yüzlerce
  seçenek yerine küçük bir ayarlar penceresi ve GNOME İnsan Arayüzü Yönergeleri'ni
  izleyen temiz bir tasarım.

## Özellikler

- **Adwaita tarzı tasarım:** adres çubuğu başlık çubuğunda, sekmeler altında, libadwaita
  renkleri ve köşeleri, açık/koyu mod, sistem vurgu rengi.
- **Varsayılan olarak gizli:** LibreWolf'un ayarları. Telemetri yok, sıkı izleme koruması,
  yalnızca HTTPS.
- **Yararlı eklentiler hazır:** uBlock Origin, Privacy Badger, ClearURLs ve ToS;DR ilk
  açılışta kurulur, gizli pencerelerde de çalışır.
- **Kullanım koşulları bir bakışta (isteğe bağlı):** Adres çubuğu, ziyaret ettiğiniz
  sitenin [ToS;DR](https://tosdr.org) puanını gösterebilir. Sitenin alan adı ToS;DR'a
  gönderildiği için **varsayılan olarak kapalıdır**; Marmara ilk açılışta size sorar.
  Gizli pencerelerden hiçbir şey gönderilmez.
- **Sade ayarlar:** Uzun bir seçenek sayfası yerine arama özellikli, küçük, Adwaita
  görünümlü tek bir pencere.
- **İlk açılış karşılaması:** Dilinizi, temanızı ve arama motorunuzu kendiniz seçersiniz.
  Sizin yerinize hiçbir şey seçilmez.
- **Kendi kimliği:** Kendi adı, logosu, profil klasörü (`~/.marmara`) ve pencere sınıfı
  vardır. LibreWolf ile yan yana çalışabilir.

| | |
|---|---|
| ![Adres çubuğunda ToS;DR puanı](flatpak/screenshot-2.png) | ![Açık ve koyu başlangıç sayfası](flatpak/screenshot-3.png) |
| ![Sade uygulama menüsü](flatpak/screenshot-4.png) | |

## Kurulum

### Flatpak (Linux)

```sh
flatpak remote-add --user marmara https://fuzuliorg.github.io/marmara/marmara.flatpakrepo
flatpak install --user marmara io.github.fuzuliorg.Marmara
flatpak run io.github.fuzuliorg.Marmara
```

Güncellemek için:

```sh
flatpak update io.github.fuzuliorg.Marmara
```

Yeni sürüm çıktığında Marmara bunu **Ayarlar → Genel → Güncellemeler** bölümünde söyler.
Depo imzalıdır. Anahtar `marmara.flatpakrepo` dosyasında bulunur.

> Marmara henüz Flathub'da değil, bu yüzden Bazaar gibi yazılım merkezleri onu
> listelemez. GNOME Yazılım ve yukarıdaki komutlar çalışır.

### Windows

[En son sürümden](https://github.com/fuzuliorg/marmara/releases/latest)
`Marmara-<sürüm>-windows-x86_64-setup.exe` dosyasını indirip çalıştırın. Yönetici izni
gerekmez. Yalnızca sizin kullanıcınız için kurulur, Başlat menüsü ve masaüstü kısayolu
ekler, Windows'un *Yüklü uygulamalar* listesinden kaldırılabilir (profiliniz, yani yer
imleri ve geçmiş, silinmez).

> Kurulum dosyası kod imzalı değildir, bu yüzden Windows SmartScreen uyarı verebilir;
> *Daha fazla bilgi → Yine de çalıştır* deyin. Güncelleme tek tıktır: yeni sürüm çıkınca
> **Ayarlar → Genel → Güncellemeler** bölümünde **Şimdi güncelle**'ye basın. Marmara
> kurulum dosyasını indirir, sağlama toplamını doğrular, eski sürümün üzerine kurar ve
> yeniden açılır.
>
> Taşınabilir `marmara-<sürüm>-windows-x86_64.zip` da yayımlanır (istediğiniz yere açıp
> `marmara.exe`'yi çalıştırın); kendini güncellemez, bunun yerine sürüm sayfasını açar.

### Sürüm arşivinden (Linux)

[En son sürümden](https://github.com/fuzuliorg/marmara/releases/latest)
`marmara-<sürüm>-linux-x86_64.tar.xz` dosyasını indirin, açın ve `./marmara/marmara`
çalıştırın.

## Marmara nereye bağlanır

Temiz bir kurulumda, hiçbir sayfa açılmadan beş dakika boşta bırakılarak ölçüldü.
Gerisi yalnızca bir siteye girdiğinizde olur.

| Adres | Neden |
|---|---|
| `ublockorigin.github.io`, `ublockorigin.pages.dev` | uBlock Origin filtre listelerini günceller |
| `rules2.clearurls.xyz` | ClearURLs kurallarını günceller |
| `*.cdn.mozilla.net` | Firefox'un Remote Settings sistemi: sertifika iptal filtreleri ve engelleme listeleri, imzayla doğrulanır |
| `push.services.mozilla.com` | Firefox'un push servisi: yeni Remote Settings verisi hazır olunca tarayıcıya haber verir (sitelerin web bildirimleri için de kullanılır). Güvenlik güncellemeleri hızlı gelsin diye açık bırakıldı |

Telemetri, Google, sponsorlu içerik ve hesap yoktur. Marmara kendi güncellemesini
yalnızca Ayarlar'daki düğmeye bastığınızda denetler ve o zaman `api.github.com` ile
`github.com`'a bağlanır. Hizmet koşulları notları siz açmadıkça kapalıdır; açarsanız
sitenin alan adı ToS;DR'a gönderilir.

## Sorun bildirme

Bir [issue](https://github.com/fuzuliorg/marmara/issues/new) açın. Marmara'nın
**Hakkında → Sorun bildir** düğmesi de aynı yere gider.

## Kendiniz derlemek

[CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bakın.

## Lisans

Marmara'nın kendi dosyaları ve LibreWolf/Firefox'tan değiştirilen dosyalar
[Mozilla Public License 2.0](LICENSE) kapsamındadır.

**"Marmara" adı ve logosu bu lisansın kapsamında değildir.** Kodu serbestçe
fork'layabilirsiniz, ama değiştirilmiş bir sürüm Marmara adını ya da logosunu
kullanamaz. Ayrıntı: [TRADEMARK.md](TRADEMARK.md).

Marmara, Mozilla ya da LibreWolf projesi tarafından geliştirilmez ve onaylanmamıştır.
"Firefox" ve "LibreWolf" sahiplerinin markalarıdır, yalnızca Marmara'nın nereden
türediğini anlatmak için anılır. Hazır eklentiler kendi geliştiricilerinindir ve
addons.mozilla.org'dan değiştirilmeden indirilir.
