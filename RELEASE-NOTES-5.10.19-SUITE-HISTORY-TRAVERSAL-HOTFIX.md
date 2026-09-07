# Korespondenční asistent 5.10.19 – suite-session history traversal hotfix

Datum: 2026-09-04  
Platforma: GHRAB Platform 1.1.2  
Kontrakt: `ghrab-suite-session-v1`

## Důvod opravy

GitHub Actions nad kandidátem 5.10.18 nadále reprodukovaly jediný suite-session FAIL `browser-back-forward / back-dom-not-restored`. Storage cleanup, per-tab marker, acknowledgement, write lock i fail-closed byly PASS. Selhávala pouze kontrola, že se po Browser Back/Forward neobnoví syntetická canary hodnota v `my_raw`.

Příčinou byla druhá implementace history traversal v Chromiu: návrat nemusí být obsloužen jako čistý BFCache resume (`pageshow.persisted=true`), ale jako nový dokument s Navigation Timing typem `back_forward`. Platformní replay se v takovém dokumentu může spustit už při registraci handleru, tedy dříve, než browser dokončí obnovu hodnot formulářových prvků. Cleanup proto mohl správně vyčistit storage a aktuálně prázdný DOM, zapsat ACK, a browser následně obnovil starou hodnotu textarea z historie.

## Oprava

- child při bootu detekuje Navigation Timing `back_forward` (s legacy fallbackem `performance.navigation.type === 2`);
- `historyRestorePending` je nastaven ještě před registrací suite-session replay handleru;
- platformní replay, storage guard, startup/focus/visibility guardy nesmějí během tohoto stavu provést cleanup ani ACK;
- `pageshow` zpracovává společnou post-restore cestou jak `persisted=true`, tak fresh `back_forward` boot;
- cleanup se spustí až po `requestAnimationFrame` + tasku za `pageshow`, aby proběhl nad browserem skutečně obnoveným DOM;
- nucený cleanup znovu čistí transient DOM/in-memory stav i vlastněná persistence data a ACK zapisuje až po ověření;
- při absenci suite generation se history seal pouze bezpečně uvolní a běžná práce se nemaže;
- přidána deterministická regrese `browser-history-fresh-navigation-replay`, která ověřuje, že před `pageshow` citlivý stav zůstává pending bez ACK a až po `pageshow` dojde k cleanupu a potvrzení.

## Bezpečnostní význam

Oprava uzavírá lokální časovací mezeru mezi Platform replayem a browserovou obnovou formulářových hodnot při fresh history navigation. Platforma samotná zůstává byte-for-byte GHRAB Platform 1.1.2. Globální F-02/F-03 a ekosystémové E-01 zůstávají předmětem koordinované release wave a nejsou tímto child hotfixem automaticky uzavřeny.
