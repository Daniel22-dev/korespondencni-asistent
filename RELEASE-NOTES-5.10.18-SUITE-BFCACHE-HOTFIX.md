# Korespondenční asistent 5.10.18 – suite-session BFCache hotfix

Datum: 2026-09-04  
Platforma: GHRAB Platform 1.1.2  
Kontrakt: `ghrab-suite-session-v1`

## Důvod opravy

GitHub Actions nad kandidátem 5.10.17 reprodukovaly jediný suite-session FAIL ve scénáři Browser Back / Forward. Lokální i session storage byly vyčištěny, per-tab marker i acknowledgement vznikly a write lock byl aktivní, ale Chromium po návratu z BFCache obnovilo do `my_raw` starou syntetickou canary hodnotu z DOM snapshotu.

## Oprava

- při `pagehide` s `persisted=true` child zaznamená suite generation a per-tab stav a přepne stránku do `restoring` seal stavu;
- `platform.session.onEnd` a child storage guard během BFCache neprovádějí cleanup ani acknowledgement, ale odloží nejnovější suite detail;
- `focus`/`visibilitychange` guardy během pending history restore nesmějí předběhnout `pageshow`;
- po `pageshow` s `persisted=true` se po post-restore tasku vyhodnotí, zda během nepřítomnosti vznikla nová nebo dosud nezpracovaná generation;
- pokud ano, provede se nucený idempotentní `privacy.endWork({reload:false,lifecycleLock:true,silent:true})`, znovu se ověří storage a completion markery a teprve poté vznikne ACK;
- pokud žádný nový/pending suite end nenastal, běžný návrat z BFCache uživatelskou práci nemaže;
- `restoring` a `blocked` stav vizuálně neukazují starý obsah; při fail-closed stavu zůstává zobrazena pouze bezpečnostní informace.
- opraven i verzovací drift `reporter-test.config.json` z 5.10.17 na 5.10.18, který po prvním hotfix buildu správně zachytil reporter gate.

## Bezpečnostní význam

Hotfix odstraňuje cestu, kdy mohlo být po suite cleanupu znovu viditelné osobní pracovní data pouze v obnoveném DOM/in-memory snapshotu, přestože persistence již byla čistá. Neřeší a neuzavírá globální F-02/F-03 trust-boundary dluh Platformy 1.1.2.
