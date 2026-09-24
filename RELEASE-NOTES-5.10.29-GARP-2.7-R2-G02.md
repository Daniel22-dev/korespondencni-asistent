# Korespondenční asistent 5.10.29 — GARP 2.7 r2 / G-02 FIX

**Datum:** 2026-09-24  
**Typ:** bezpečnostní re-baseline / contract hardening  
**Aktivní autorita:** GARP 2.7  
**Konsolidace:** `2026-09-23-r2`  
**Serverová fáze:** `DEFERRED_BY_OWNER_DECISION`  
**LIVE:** `NOT_TESTED`

## Důvod změny

Nový konsolidovaný GARP 2.7 r2 uzavírá G-02 v policy validatoru. R1 kontroloval především tvar a neprázdnost policy; r2 navíc vyžaduje důvěryhodnou identitu aplikace, platný semver, skutečnou sémantiku každé povinné sekce a fail-closed odmítnutí placeholderů.

## Implementováno

- vendored master `r1 -> r2`;
- explicitní r2 ecosystem inventory pro `correspondence`;
- trusted SHA-256 vazba na r2 core, inventory a celý vendor tree;
- contract gate kontrolující trusted `PACKAGE_SELFTEST.checkDigest` a G-02 selftest;
- aplikační G-02 mutation suite: positive current policy + unknown appId + `0.0.0` + invalid semver + mode-only sections + placeholder substring;
- architecture-integrity kontroly revize/inventory a aktualizovaný trust tool scope;
- nový externí CI pin trust anchoru;
- release metadata/verze 5.10.29.

## Co se nemění

GARP 2.5.1/N5/P5/Safe Promotion zůstávají povinnou regresní vrstvou. Uživatelská AI logika, anonymizace, prompt assembly a funkční workflow se tímto patchem nemění. Historický `dist-school-server/` zůstává frozen na 5.10.25.

## Limity

Tento patch není LIVE penetrační certifikace. Školní server není v této fázi schválen k implementaci ani testování, proto server-dependent AG kontroly zůstávají `DEFERRED` / `NOT_TESTED` a nesmějí být prezentovány jako PASS.

## Legacy AI assurance re-pin

`src/ai-operations.json` se oproti 5.10.28 změnil pouze v poli `appVersion` (`5.10.28 -> 5.10.29`). Registry operací, capability kontrakt, AI Core verze ani prompt/anonymizační moduly se nezměnily. GARP 2.5.1 AI assurance baseline proto přepíná pouze SHA-256 tohoto metadata souboru a následná regresní brána musí znovu projít.
