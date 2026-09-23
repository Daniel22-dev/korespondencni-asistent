# GARP 2.7 — konsolidovaný master r1

Tato složka je referenční implementační jádro konsolidace ze dne 2026-09-23.
Nejde o nový GARP 2.8. Aktuální kontrakt zůstává **GARP 2.7**.

Cíl masteru:
- uzavřít nálezy A-01 až A-07 z auditu původního pracovního balíku;
- oddělit validaci tvaru, sémantické admission rozhodnutí a skutečné LIVE ověření;
- umožnit postupnou migraci aplikací bez falešného PASS/FAIL kvůli chybějícímu školnímu serveru;
- dodat opakovatelný referenční harness pro druhou aplikaci (KS) a další rollout.

## Stav serveru
Aktivní příprava školního serveru je **DEFERRED_BY_OWNER_DECISION**. Balík proto
neobsahuje konkrétní implementaci školní infrastruktury ani Fortinet integrace.
Serverově závislé testy musí vracet `NOT_TESTED`/`DEFERRED`, nikoli PASS. To nesmí
oslabit žádnou lokální nebo CI ochranu.

## Nástroje a exit kódy
- `0` — daný kontrakt/admission test prošel v deklarovaném scope.
- `1` — bezpečnostní/kontraktní FAIL.
- `2` — HARNESS_ERROR (chyba vstupu/nástroje, nikdy PASS).
- `3` — NOT_TESTED / DEFERRED; tento stav nesmí být překládán na LIVE PASS.

## Co spustit
```bash
node MASTER/TOOLS/package-selftest.mjs
node MASTER/TOOLS/contract-selftest.mjs
```

`PACKAGE_SELFTEST` potvrzuje integritu a konzistenci tohoto balíku. `CONTRACT_TEST`
ověřuje referenční validátory na syntetických pozitivních a negativních případech.
Ani jeden výsledek není APP_BEHAVIOR_TEST nebo LIVE_TEST konkrétní aplikace.
