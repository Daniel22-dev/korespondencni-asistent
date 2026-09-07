# Korespondenční asistent 5.4.4

## Perspektiva odesílatele

V pokročilém nastavení odpovědi přibyla volba **Píšu jako**:

- **Jednotlivec** — výchozí režim, vždy 1. osoba jednotného čísla;
- **Za tým / komisi** — množné číslo jen pro skutečně společné jednání;
- **Za školu / instituci** — institucionální množné číslo.

Pouhá zmínka o kolezích, komisi nebo škole už nesmí převést odpověď do tvarů „vážíme“, „budeme“ nebo „projednáme“. U jednotlivce prompt používá formulace typu „projednám s kolegy“ a kontrola konceptu zachytí nechtěné množné číslo jako blokující chybu.

## Jediný podpisový blok

Gemini má ukončit návrh pouze značkou `[podpis]`. Rozloučení a jméno doplňuje aplikace lokálně z profilu. Deterministická normalizace odstraní případné řádky „S pozdravem“, „S úctou“ apod. bezprostředně před značkou a sloučí více značek podpisu na jednu.

## Regresní testy

Přidány testy pro odstranění dvojitého rozloučení, právě jednu značku `[podpis]`, blokaci množného čísla při režimu Jednotlivec a přijetí správné 1. osoby jednotného čísla.
