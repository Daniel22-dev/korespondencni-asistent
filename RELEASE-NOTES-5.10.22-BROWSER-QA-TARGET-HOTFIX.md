# Korespondenční asistent 5.10.22 — Browser QA target readiness hotfix

## Důvod
GitHub Actions po verzi 5.10.21 potvrdily ostatní release kontroly jako PASS. Jediný zbývající pád nastal v `qa:browser` ještě před testováním aplikace: `/json` v krátkém startovacím okně Chromia neobsahovalo `type: page`, takže harness dereferencoval `undefined.webSocketDebuggerUrl`.

## Oprava
- `scripts/qa-p3-browser.mjs` již nepředpokládá okamžitou existenci page targetu.
- Harness na page target opakovaně čeká.
- Pokud target stále neexistuje, zkusí jej vytvořit přes DevTools HTTP endpoint `/json/new?about:blank` metodou PUT a znovu čeká.
- Při skutečné nedostupnosti targetu skončí explicitní chybou `Chromium page target timeout`, nikoli TypeError.
- Produkční aplikace, suite-session lifecycle a vendor GHRAB Platform 1.1.2 nejsou tímto hotfixem funkčně měněny.

## Verze
- aplikace: 5.10.22
- manuál: 1.3.16
- GHRAB Platform: 1.1.2

## Release status
Kandidát zůstává AMBER do potvrzení novým GitHub Actions během. Rozhodující je `qa:browser` a následný P5 R2 release gate.
