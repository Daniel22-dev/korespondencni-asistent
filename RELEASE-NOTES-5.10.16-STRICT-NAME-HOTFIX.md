# Korespondenční asistent 5.10.16 - strict-name privacy hotfix

Datum: 2026-08-30

## Důvod

Osobní retest anonymizovaného Gmail `.eml` odhalil, že obecná preventivní témata byla v 5.10.15 již správně kalibrována, ale finální strict-name preflight stále tvrdě blokoval neurčité kandidáty jako názvy institucí, míst a běžná slova na začátku vět.

## Oprava

- Centrální preflight používá pro hard block pouze high-confidence osobní jména a kontextově silné jednoslovné kandidáty.
- Názvy institucí a samostatné místní/adresní řádky nejsou automaticky povyšovány na osobní jména.
- Gmail `.eml` scrubber odstraňuje vedle celého jména i samostatné části person-like identity odesílatele ze signatury.
- Skutečná jména, strukturované identifikátory a konkrétní zdravotní/kázeňské případy zůstávají blokované.
- Regrese obsahuje celý anonymizovaný preventivní e-mail včetně instituce a adresní paty a zachovává blokace Nguyen/Halama/Nováková.
