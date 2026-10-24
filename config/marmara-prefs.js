
/** ------------------------------
 * [CATEGORY] MARMARA
 * LibreWolf ayarlarının üstüne eklenen Marmara ayarları.
 * defaultPref: kullanıcı değiştirebilir. lockPref: değiştirilemez.
 * ------------------------------- */

/** [SECTION] GÖRÜNÜM
 * Sekmeler başlık çubuğunda (istemci taraflı dekorasyon), GNOME gibi alt
 * köşeleri yuvarlatılmış pencere, menü çubuğu kapalı.
 */
defaultPref("browser.tabs.inTitlebar", 1);
defaultPref("widget.gtk.rounded-bottom-corners.enabled", true);
defaultPref("ui.key.menuAccessKeyFocuses", false);
defaultPref("browser.uidensity", 0);

/** [SECTION] SEKMELER
 * GNOME Web gibi: tek sekme varken sekme çubuğu gizli.
 */
defaultPref("marmara.tabs.autohide", true);

/** [SECTION] DESTEK BAĞLANTILARI
 * LibreWolf'un destek adresi yerine şimdilik Firefox'un genel destek sayfası.
 * Marmara'nın kendi sitesi olduğunda burası güncellenir.
 */
defaultPref("app.support.baseURL", "https://support.mozilla.org/1/firefox/%VERSION%/%OS%/%LOCALE%/");

/** [SECTION] ARAÇ ÇUBUĞU DÜZENİ
 * LibreWolf'un varsayılan düzenini (librewolf.cfg) geçersiz kılar. Yalnızca
 * yeni profillerde etkilidir; kullanıcı düzeni değiştirirse onunki saklanır.
 * - Yeni sekme (+) düğmesi adres çubuğunun hemen sağında
 * - Sekme çubuğunda yalnızca sekmeler: "+" ve "tüm sekmeler" düğmesi yok
 * - uBlock Origin dahil tüm eklentiler eklentiler (yapboz) menüsünde
 * currentVersion bu Firefox sürümünün düzen sürümüyle (kVersion) aynı; böylece
 * Firefox eski profiller için yaptığı geçiş adımlarını bu düzene uygulamaz.
 * Yapay zekâ düğmeleri "seen" listesinde, yani kendiliğinden geri eklenmez.
 */
defaultPref("browser.uiCustomization.state", '{"placements":{"widget-overflow-fixed-list":[],"unified-extensions-area":["ublock0_raymondhill_net-browser-action","jid1-mnnxcxisbpnsxq_jetpack-browser-action","_74145f27-f039-47ce-a470-a662b129930a_-browser-action"],"nav-bar":["back-button","forward-button","stop-reload-button","customizableui-special-spring1","vertical-spacer","urlbar-container","new-tab-button","customizableui-special-spring2","downloads-button","reset-pbm-toolbar-button","unified-extensions-button"],"toolbar-menubar":["menubar-items"],"TabsToolbar":["tabbrowser-tabs"],"vertical-tabs":[],"PersonalToolbar":["personal-bookmarks"]},"seen":["ai-window-toggle","smartwindow-group-tabs-button","reset-pbm-toolbar-button","developer-button","screenshot-button","alltabs-button","ublock0_raymondhill_net-browser-action","jid1-mnnxcxisbpnsxq_jetpack-browser-action","_74145f27-f039-47ce-a470-a662b129930a_-browser-action"],"dirtyAreaCache":["nav-bar","TabsToolbar","vertical-tabs","unified-extensions-area"],"currentVersion":28,"newElementCount":4}');

/** [SECTION] TEMA VE PARMAK İZİ KORUMASI
 * Web siteleri tarayıcının temasını izlesin: karanlık temada, destekleyen
 * siteler de karanlık görünür.
 *
 * LibreWolf "resistFingerprinting" (RFP) kullanıyor ve RFP web sitelerini her
 * zaman aydınlık temaya zorluyor; bu ayar RFP açıkken değiştirilemiyor. Bu
 * yüzden RFP yerine Firefox'un parmak izi korumasını (FPP) RFP'nin tüm
 * korumalarıyla (+AllTargets) açıyoruz ve yalnızca iki şeyi hariç tutuyoruz:
 *  - CSSPrefersColorScheme: sitelerin karanlık temayı görebilmesi için
 *  - JSLocale: RFP de varsayılan olarak dili İngilizceye zorlamıyor
 */
defaultPref("privacy.resistFingerprinting", false);
defaultPref("privacy.resistFingerprinting.pbmode", false);
defaultPref("privacy.fingerprintingProtection", true);
defaultPref("privacy.fingerprintingProtection.pbmode", true);
defaultPref("privacy.fingerprintingProtection.overrides", "+AllTargets,-CSSPrefersColorScheme,-JSLocale");
defaultPref("privacy.fingerprintingProtection.remoteOverrides.enabled", false);

/** Firefox'un renkli tema seçicisi (Nova) yerine yalnızca Sistem/Aydınlık/Karanlık */
defaultPref("browser.aboutaddons.novaThemesPickerEnabled", false);

/** [SECTION] HİZMET KOŞULLARI NOTU (ToS;DR)
 * Adres çubuğunda sitenin ToS;DR notu (modules/MarmaraTosdr.sys.mjs).
 * Not için sitenin alan adı ToS;DR'a gönderilir; bu yüzden varsayılan KAPALI.
 * Kullanıcı ilk açılış karşılamasında ya da Ayarlar > Gizlilik'ten kendisi açar.
 * Gizli pencerelerde ayrıca varsayılan olarak kapalı.
 */
defaultPref("marmara.tosdr.enabled", false);
defaultPref("marmara.tosdr.privateWindows", false);

/** [SECTION] PROFİLLER
 * Firefox'un çoklu profil özelliği kapalı: menüde, ayarlarda ve açılışta
 * profil seçici ya da "yeni profil" penceresi yok. (Politikadaki
 * BlockAboutProfiles da özelliği tamamen devre dışı bırakıyor.)
 */
lockPref("browser.profiles.enabled", false);

/** [SECTION] YER İMLERİ ÇUBUĞU
 * Yer imleri sekmelerin altında bir çubuk olarak gösterilmez; yalnızca
 * uygulama menüsünden açılır. Başka bir tarayıcıyla eşitleme yer imlerini
 * getirdiğinde Firefox çubuğu kendiliğinden açabiliyor; bu yüzden ayar
 * kilitli, çubuk ayrıca theme/browser/removed.css ile gizli.
 */
lockPref("browser.toolbars.bookmarks.visibility", "never");

/** [SECTION] DİKEY SEKMELER
 * Marmara yatay sekmeleri kullanır; dikey sekmeler kullanılamaz.
 */
lockPref("sidebar.verticalTabs", false);
// Yan panel sağda açılır
lockPref("sidebar.position_start", false);
// Parolalar paneli (viewCPMSidebar) bu ayara bağlı olarak yan panellere eklenir
lockPref("browser.contextual-password-manager.enabled", true);

/** [SECTION] GEÇMİŞİ KAPANIRKEN TEMİZLEME
 * LibreWolf varsayılan olarak tarayıcı kapanırken çerezleri ve site verilerini
 * siler. Marmara'da kapalı: oturumlar ve geçmiş saklanır. İsteyen Ayarlar >
 * Gizlilik'ten açabilir.
 */
defaultPref("privacy.sanitize.sanitizeOnShutdown", false);

/** [SECTION] HESAP VE EŞİTLEME
 * Mozilla hesabı ve Firefox Eşitleme kapalı (LibreWolf varsayılanı). Başka
 * bir tarayıcıdan yer imi ve geçmiş almak için Ayarlar > Temel ayarlar >
 * "Tarayıcı verilerini içe aktar" kullanılır.
 */
lockPref("identity.fxaccounts.enabled", false);

/** [SECTION] ARAMA
 * Motor listesi (Startpage varsayılan; Google, Bing, Ecosia eklenmiş) ve
 * zaman damgaları tarayıcıyla birlikte geliyor, bkz. scripts/patch_omni.py.
 * Varsayılanı hiç değiştirmemiş profiller de yeni listeyi alır.
 */

// Başlangıç sayfası: tarayıcının kendi sayfası about:marmara
// (modules/MarmaraStartpage.sys.mjs). Yeni sekme de aynı sayfayı açar.
defaultPref("browser.startup.homepage", "about:marmara");
defaultPref("browser.startup.page", 1);

/** [SECTION] İLK AÇILIŞ
 * Firefox'un "tarayıcıyı sistem dilinizde kullanmak ister misiniz?" sorusu ve
 * kendi karşılama sayfası kapalı; dil, tema ve arama motoru Marmara'nın kendi
 * karşılama ekranında (modules/MarmaraWelcome.sys.mjs) seçilir.
 */
lockPref("intl.multilingual.aboutWelcome.languageMismatchEnabled", false);
// "Web sayfalarının İngilizce sürümlerini görmek ister misiniz?" sorusu (Tor/RFP'den
// gelir): 1 = sorma, dili değiştirme. Dil Marmara'nın kendi karşılamasında seçilir.
lockPref("privacy.spoof_english", 1);

/** [SECTION] BAŞLANGIÇ VE YENİ SEKME
 * "start": Marmara başlangıç sayfası (about:marmara), "blank": boş sayfa.
 * Açılış sayfası browser.startup.homepage ile belirlenir (yukarıda).
 */
defaultPref("marmara.newtab.page", "start");
lockPref("browser.aboutwelcome.enabled", false);
