# Korespondenční asistent (KS) – GARP 2.7 r2 G-02 FINAL REPORT

Datum: 2026-09-24  
Aplikace: `correspondence`  
Verze: `5.10.29`  
Aktivní GARP master: `2026-09-23-r2` / G-02 FIX

## Co bylo provedeno

- migrace vendored GARP 2.7 z konsolidovaného r1 na dodaný r2 / G-02 FIX,
- aktualizace trust anchoru, CI pinu a architektonických vazeb na r2,
- vazba na trusted ecosystem inventory pro `correspondence`,
- aktualizace aplikační verze na 5.10.29 a souvisejících manifestů/release metadata,
- doplnění aplikačních negativních admission testů pro G-02,
- zachování GARP 2.5.1 jako povinného regresního baseline,
- zachování serverové fáze jako `DEFERRED_BY_OWNER_DECISION` / `NOT_TESTED`,
- `dist-school-server` ponechán byte-for-byte beze změny.

## G-02 aplikační admission testy

PASS 6/6:

1. aktuální korektní policy je přijata,
2. neznámý `appId` je odmítnut,
3. `appVersion: 0.0.0` je odmítnuta,
4. neplatný semver je odmítnut,
5. prázdné/mode-only povinné policy sekce jsou odmítnuty,
6. placeholder v policy je odmítnut.

## Finální ověření

- GARP 2.7 r2 package selftest: PASS (19/19)
- GARP 2.7 r2 contract selftest: PASS (25/25)
- GARP 2.7 aplikační G-02 mutation/admission testy: PASS (6/6)
- GARP 2.7 architecture mutation testy: PASS (10/10)
- GARP 2.7 auto-patch contract: PASS (6/6)
- GARP 2.7 static chain: PASS
- GARP 2.5.1 regresní static chain: PASS
- GARP 2.7 Foundation: PASS (10/10), stav `FOUNDATION_PASS_LIVE_NOT_TESTED`
- GHRAB Platform conformance: PASS (139/139)
- interní aplikační testy: PASS (171/171)
- AI Core conformance: PASS (17/17)
- AI profiles: PASS (15/15)
- produkční UI interaction regression: PASS (48/48)
- produkční browser smoke test: PASS
- quality gate: PASS (31/31)
- XSS sink regression: PASS
- secret scan: PASS, 0 nálezů
- canary scan: PASS, bez neočekávaných nálezů
- produkční test API: odstraněno / test hooks OFF

## Známé hranice lokálního ověření

Lokální prostředí poskytuje Node.js 22.16.0, zatímco projekt deklaruje Node.js >=24 pro cílové CI/serverové prostředí. `npm ci` nebylo možné v tomto sandboxu dokončit kvůli síťové nedostupnosti, proto zde nebylo možné znovu spustit dependency-based AXE větev.

Lokální `qa:runtime` harness skončil timeoutem `Runtime page timeout: index.html`. Stejný lokální Node 22 timeout je uložen i ve starších auditních evidencích aplikace (5.10.17, 5.10.20, 5.10.21, 5.10.24); nejde o novou regresi zavedenou GARP r2. Produkční browser smoke a produkční UI interaction testy současné 5.10.29 přitom prošly. Kvůli chybějícímu runtime reportu lokální agregovaný P5 release report skončil 43/44, pouze na `report.runtime.exists`. Tento stav není maskován ani přepisován na PASS.

## Stav LIVE/server

Žádný LIVE/server claim nebyl proveden. Serverová část zůstává `DEFERRED_BY_OWNER_DECISION` / `NOT_TESTED`. Formální governance acceptance G-01 zůstává samostatným krokem vlastníka a nebyla automaticky self-approved.
