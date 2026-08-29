# Korespondenční asistent 5.10.10 — GARP 2.2 hardening

Datum: 28. 8. 2026

Toto vydání vzniklo v prvním implementačním kole GARP 2.2. Nemění pedagogický workflow aplikace; zpřesňuje bezpečnostní a privacy hranice.

## Změny

- Import nastavení a školní knihovny má limit 1 MB.
- Importovaný slovník jmen a vlastní bloky mají explicitní limity počtu, polí a délek.
- `PREFLIGHT_BLOCKED` vrací uživateli generickou bezpečnostní chybu bez zopakování nalezené osobní/citlivé hodnoty.
- Access bootstrap zobrazuje pouze typ chyby, ne raw message z autorizační vrstvy.
- Správa lokálních dat nabízí „Ukončit práci“, které vyčistí aplikační localStorage/sessionStorage, pracovní DOM/stav a následným reloadem zruší i paměť stránky.
- `data-manifest.json` pravdivě uvádí, že automatická časová expirace, logout mazání a serverový delete endpoint v aktuálním serverless release nejsou připojené.
- Bezpečnostní regresní sada obsahuje nové testy GARP hardeningu.

Nezávislý GARP audit a jeho release gate jsou vedeny v samostatném předávacím protokolu.

## Performance budget

Bezpečnostní opravy a čtyři nové runtime regresní testy zvětšily sestavený `index.html` přibližně o 8 kB. Statický performance budget byl proto jednorázově přebaselinován s přibližně 1–2% rezervou; runtime limity ani limit duplicitních velkých souborů se nezvyšovaly.
