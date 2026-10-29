; Marmara kurulum sihirbazı (Windows).
;
; Yönetici izni istemez; kullanıcının kendi klasörüne kurar:
;   %LOCALAPPDATA%\Programs\Marmara
; Başlat menüsü ve masaüstü kısayolları oluşturur, "Uygulamalar" listesine kaldırma
; kaydı ekler. Kaldırınca yalnızca program dosyalarını siler; profil (yer imleri,
; geçmiş vb.) silinmez.
;
; Kısayollar başlatıcıyı (marmara.exe) atlayıp doğrudan marmara-bin.exe'yi
; "-app browser\application.ini" ile açar; görev çubuğunda tek düğme olsun diye.
;
; Derleme (Linux'ta): makensis -DVERSION=1.0.9 -DAPPDIR=/yol/marmara -DICON=/yol/marmara.ico \
;                              -DOUTFILE=/yol/Marmara-Setup.exe installer.nsi

Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!ifndef VERSION
  !error "VERSION verilmedi"
!endif

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

Name "Marmara"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\Marmara"
InstallDirRegKey HKCU "Software\Marmara" "InstallDir"
RequestExecutionLevel user
BrandingText "Marmara ${VERSION}"

!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Marmara"

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\marmara.exe"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; İlk dil varsayılan; sistem dili Türkçeyse NSIS onu seçer
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Turkish"

Section "Marmara" SecMain
  ; Uygulama içinden güncellemede Marmara kapanana kadar bekle (en çok ~60 sn):
  ; çalışan marmara-bin.exe açılamaz.
  StrCpy $1 0
  wait_loop:
    IfFileExists "$INSTDIR\marmara-bin.exe" 0 wait_done
    ClearErrors
    FileOpen $0 "$INSTDIR\marmara-bin.exe" a
    IfErrors 0 wait_free
    IntOp $1 $1 + 1
    ${If} $1 > 120
      Abort "Marmara kapatılamadı; lütfen Marmara'yı kapatıp tekrar deneyin."
    ${EndIf}
    Sleep 500
    Goto wait_loop
  wait_free:
    FileClose $0
  wait_done:

  SetOutPath "$INSTDIR"
  ; Eski sürümü temizle (profil başka yerde olduğu için güvenli)
  IfFileExists "$INSTDIR\marmara-bin.exe" 0 +2
    RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "${APPDIR}/*"

  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Kısayollar: doğrudan marmara-bin.exe + -app
  CreateShortcut "$SMPROGRAMS\Marmara.lnk" "$INSTDIR\marmara-bin.exe" '-app "$INSTDIR\browser\application.ini"' "$INSTDIR\marmara-bin.exe" 0
  CreateShortcut "$DESKTOP\Marmara.lnk" "$INSTDIR\marmara-bin.exe" '-app "$INSTDIR\browser\application.ini"' "$INSTDIR\marmara-bin.exe" 0

  WriteRegStr HKCU "Software\Marmara" "InstallDir" "$INSTDIR"

  ; Windows'a "Marmara bir tarayıcıdır" kaydı: Ayarlar > Varsayılan uygulamalar listesinde görünür
  !define BROWSER_KEY "Software\Clients\StartMenuInternet\Marmara"
  WriteRegStr HKCU "${BROWSER_KEY}" "" "Marmara"
  WriteRegStr HKCU "${BROWSER_KEY}\DefaultIcon" "" "$INSTDIR\marmara-bin.exe,0"
  WriteRegStr HKCU "${BROWSER_KEY}\shell\open\command" "" '"$INSTDIR\marmara-bin.exe" -app "$INSTDIR\browser\application.ini"'
  WriteRegStr HKCU "${BROWSER_KEY}\Capabilities" "ApplicationName" "Marmara"
  WriteRegStr HKCU "${BROWSER_KEY}\Capabilities" "ApplicationDescription" "Basit ve şeffaf web tarayıcısı"
  WriteRegStr HKCU "${BROWSER_KEY}\Capabilities\URLAssociations" "http" "MarmaraURL"
  WriteRegStr HKCU "${BROWSER_KEY}\Capabilities\URLAssociations" "https" "MarmaraURL"
  WriteRegStr HKCU "${BROWSER_KEY}\Capabilities\FileAssociations" ".htm" "MarmaraHTML"
  WriteRegStr HKCU "${BROWSER_KEY}\Capabilities\FileAssociations" ".html" "MarmaraHTML"
  WriteRegStr HKCU "Software\RegisteredApplications" "Marmara" "${BROWSER_KEY}\Capabilities"
  WriteRegStr HKCU "Software\Classes\MarmaraURL" "" "Marmara URL"
  WriteRegStr HKCU "Software\Classes\MarmaraURL" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\MarmaraURL\DefaultIcon" "" "$INSTDIR\marmara-bin.exe,0"
  WriteRegStr HKCU "Software\Classes\MarmaraURL\shell\open\command" "" '"$INSTDIR\marmara-bin.exe" -app "$INSTDIR\browser\application.ini" -osint -url "%1"'
  WriteRegStr HKCU "Software\Classes\MarmaraHTML" "" "Marmara HTML"
  WriteRegStr HKCU "Software\Classes\MarmaraHTML\DefaultIcon" "" "$INSTDIR\marmara-bin.exe,0"
  WriteRegStr HKCU "Software\Classes\MarmaraHTML\shell\open\command" "" '"$INSTDIR\marmara-bin.exe" -app "$INSTDIR\browser\application.ini" -osint -url "%1"'
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "Marmara"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "Fuzuliinitiative"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\marmara-bin.exe"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "${UNINSTALL_KEY}" "URLInfoAbout" "https://github.com/fuzuliorg/marmara"
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1

  ; Uygulama içi güncellemeden geldiyse yeniden aç
  ${GetParameters} $2
  ClearErrors
  ${GetOptions} $2 "/RELAUNCH" $3
  ${IfNot} ${Errors}
    Exec '"$INSTDIR\marmara-bin.exe" -app "$INSTDIR\browser\application.ini"'
  ${EndIf}
SectionEnd

Section "Uninstall"
  ; Yanlışlıkla başka bir klasörü silmemek için: Marmara'nın kendi dosyası yoksa durur
  IfFileExists "$INSTDIR\marmara-bin.exe" +2 0
    Abort
  Delete "$SMPROGRAMS\Marmara.lnk"
  Delete "$DESKTOP\Marmara.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  DeleteRegKey HKCU "Software\Marmara"
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\Marmara"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Marmara"
  DeleteRegKey HKCU "Software\Classes\MarmaraURL"
  DeleteRegKey HKCU "Software\Classes\MarmaraHTML"
SectionEnd
