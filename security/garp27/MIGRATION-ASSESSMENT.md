# Korespondenční asistent — GARP 2.7 r2 migration assessment

Datum: 2026-09-24  
Aplikace: `correspondence` / Korespondenční asistent 5.10.29  
Aktivní kontrakt: GARP 2.7 / konsolidace `2026-09-23-r2`  
Vstupní aplikační ZIP SHA-256: `9c96a8588785c218d99e0f2451fbc47b0cfd996619497319d4998766eb5e60a0`  
GARP r2 vstupní ZIP SHA-256: `0c278aefa0581b3ba13dd5725da9d3fc624976c255602ec16b054fc81da6f7c8`

## Rozhodnutí

Původní 5.10.28 implementace GARP 2.7 r1 byla funkční, ale nový master r2 uzavírá G-02: r1 policy validator mohl přijmout formálně vyplněnou šablonu bez skutečné aplikační sémantiky. Korespondenční asistent proto musí být re-baselined na r2, nikoli pouze ponechán na r1 s konstatováním, že jeho aktuální policy náhodou projde přísnějším validátorem.

## Aplikační dopad

- aktuální `garp-policy.json` je s r2 sémantickým kontraktem kompatibilní;
- trusted ecosystem inventory obsahuje `appId=correspondence`;
- vendored master je přepnut na `vendor/garp-2.7-consolidated-r2/`;
- architecture gate ověřuje r2 revision, inventory identity, core/inventory digests a celý vendor tree;
- contract gate vyžaduje trusted package `checkDigest` a explicitně ověřuje G-02 reference selftest;
- přidána vlastní G-02 mutation sada, aby integrace prokazatelně odmítala unknown app, `0.0.0`, invalid semver, mode-only policy a placeholder substring;
- trust anchor a chráněný CI pin musejí být po všech změnách přepočteny společně.

## Server/LIVE

School-server fáze zůstává `DEFERRED_BY_OWNER_DECISION`. Žádné nové serverové endpointy, Fortinet změny ani infrastruktura se v tomto patchi nepřidávají. LIVE stav zůstává `NOT_TESTED`; r2 re-baseline je lokální/CI foundation změna.

## Governance

Technický nález G-02 je uzavřen implementací r2 a negativními testy. G-01 (formální governance přijetí normativní autority) je samostatný vlastnický krok a technický patch jej nesmí označit za automaticky schválený.
