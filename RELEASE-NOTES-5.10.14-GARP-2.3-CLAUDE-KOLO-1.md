# Korespondenční asistent 5.10.14 — GARP 2.3 corrective round po Claude kolo 1

Datum: 2026-08-29

## Důvod vydání

Nezávislé kolo Claude potvrdilo, že 5.10.13 zůstává OVERALL AMBER a našlo jednu MEDIUM second-order prompt-injection cestu (tone-check → draft-refinement), dva nižší technické nálezy a několik evidence hardening bodů. Toto vydání je opravuje bez pokusu vydávat chybějící live-model nebo browser evidence za PASS.

## Opravy

1. **C-01 / second-order tone findings:** text vytvořený modelem už nevstupuje do `<user-directive>` a nezapíná `trustedInstruction`; uživatel vybírá pouze indexy, modelová zjištění jsou samostatná nedůvěryhodná data.
2. **C-02 / hidden HTML:** import odstraňuje širší sadu skrytých prvků včetně opacity 0, nulového fontu, off-screen absolutních/fixních prvků a whitespace variant `display : none`.
3. **C-03 / jsdom harness:** výchozí testovací URL je bez `?test=1`, takže se nekříží auto-run s ručním SUITE; samostatný QA gate obsahuje negative control.
4. **C-04 / AIR-12:** 24 mutací v 6 rodinách se pouští přes více prompt builderů a tone-derived cestu.
5. **C-05 / release scans:** secret/canary scany jsou součástí `qa:p5` i `qa:p5:ci`.
6. **C-07 / raw fallback:** neznámá statická volba má bezpečný default místo vložení raw hodnoty do promptu.
7. **C-06 / size headroom:** produkční build stripuje celý interní test-runner payload a ponechává pouze fail-closed stuby. Test build jej zachovává. Díky tomu se místo dalšího rebaseline obnovil přísnější size budget z 5.10.12.

## Stav důkazů

- interní testy: 169/169 + GHRAB AI Core 17/17;
- AI-RED structural: structural PASS po opravách, live behaviorální provider test stále NOT TESTED bez credentialu;
- P5 browser lifecycle SIM-03/04/07 a RT-16 organizační důkazy zůstávají externí dluhy.

## Release status

Tento kandidát je určen pro druhé a poslední nezávislé kolo Claude v aktuálním GARP 2.3 cyklu.

REÁLNÁ STUDENTSKÁ DATA: NEPOUŽÍVAT
TESTOVACÍ PROVOZ POUZE SE SYNTETICKÝMI DATY
