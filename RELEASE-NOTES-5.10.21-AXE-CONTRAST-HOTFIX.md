# Korespondenční asistent 5.10.21 — Axe kontrast hotfix

Datum: 2026-09-05
Platforma: GHRAB Platform 1.1.2 (beze změny)

## Důvod hotfixu

GitHub Actions nad 5.10.20 potvrdily, že oprava QA runtime bootstrapu funguje: `qa:runtime` má `initFailures: 0`, suite-session scénáře včetně Browser Back/Forward a fail-closed jsou PASS. Release gate však dál blokoval `qa:axe`.

Z publikovaného artefaktu `qa-p5-axe-runtime-report.json` bylo zjištěno, že všech 20 blokérů představuje jedinou konkrétní vadu: deset elementů `.term > b` v `manual/index.html` je započteno ve dvou viewport šířkách (1280 a 390 px). Axe 4.12.1 naměřilo foreground `#2c6e6b` na backgroundu `#111e2c` s kontrastem 2,84:1 při 16 px bold textu; požadavek je 4,5:1.

## Změna

- pouze glossary label `.term b` v interaktivním manuálu mění barvu z `var(--accent)` (`#2c6e6b`) na `#59b8b2`;
- vypočtený WCAG kontrast `#59b8b2` / `#111e2c` je přibližně 7,16:1;
- globální brand accent zůstává beze změny;
- verze interaktivního manuálu se zvyšuje z 1.3.15 na 1.3.16;
- Axe konfigurace, WCAG tagy, blocking impacts i threshold zůstávají beze změny;
- suite-session, storage cleanup, acknowledgement, Platform 1.1.2 a runtime bootstrap se nemění.

## Bezpečnostní dopad

Žádný nový persistence writer, storage namespace, credential path, prompt/debug path ani lifecycle handler. PC-01 a storage ownership se proti 5.10.20 nemění.

## Release status

Kandidát zůstává AMBER do nového nezávislého CI/Claude ověření. E-01 nelze uzavřít na úrovni celého ekosystému, dokud nejsou migrovány a společně otestovány všechny relevantní child aplikace.
