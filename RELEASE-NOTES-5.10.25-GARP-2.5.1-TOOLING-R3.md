# KS 5.10.25 — GARP 2.5.1 Tooling R3

Datum: 2026-09-07

Toto není nová runtime verze aplikace. Frozen `dist/` a `dist-school-server/` zůstávají bajtově identické s Claudeem ověřeným KS 5.10.25.

## Důvod
Nezávislý tooling audit R2 uzavřel N6 a N8, ale našel N11: čtyři další syntaxe mohly obejít statický SW checker tichým PASS (`cache['addAll']`, alias/bind metody, statické skládání stringu a `importScripts`). Dále našel N12 — nekonzistentní uloženou evidence varianty v6 — a N13 — chybějící provozní handoff autoritativního seznamu security-critical assetů.

## Opravy R3
- bracket notation `add` / `addAll` / `put` je analyzována;
- bound/direct method aliasy jsou rozpoznány a jejich argument je buď vyhodnocen, nebo klasifikován AMBER;
- statické skládání řetězců pomocí `+` se vyhodnotí;
- jakýkoli `importScripts(...)` je zatím explicitní AMBER `sw-imports-external-script-not-analyzed`;
- PASS text je zúžen na explicitně popsanou statickou obálku;
- selftest přidává čtyři nové N11 regresní kontroly;
- v6 evidence je sjednocena na AMBER / exit 2 s transparentním N12 errata;
- školní IT handoff vyžaduje `security-critical-assets.json` a explicitní `--critical-list`.

## Stav
Tooling selftest: 47/47 PASS. Frozen runtime KS 5.10.25: beze změny. SHIELD-LIVE / RI-LIVE zůstávají NOT TESTED do skutečného školního serveru.
