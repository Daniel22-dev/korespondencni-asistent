# Korespondenční asistent 5.10.7 — přísná kontrola začátku věty

Datum: 2026-08-23  
Revize: P5-R9-SECURITY-SENTENCE-START-GATE

## Oprava

- `computeSuggestionData()` rozlišuje volbu `includeSentenceStart`.
- Našeptávač používá `includeSentenceStart: false`, takže se uživatelské rozhraní nezaplaví běžnými slovy na začátku vět.
- `strongPersonalNameCandidates()`, `untrustedPersonalNameCandidates()` a přesný preflight používají `includeReviewed: true` a `includeSentenceStart: true`.
- Cache klíč obsahuje oba režimy analýzy; UI a přísná větev nemohou převzít výsledek druhé cesty.
- Při tvorbě odpovědi se jako přísně nedůvěryhodná jmenná data kontroluje původní anonymizovaný text, poznámka uživatele a osobní styl. Body vytvořené předchozí AI analýzou zůstávají v celkovém preflightu, ale znovu se na ně neuplatňuje přísnější jednoslovná heuristika.

## Přejímací testy

- T1: `Nguyen`, `Halama`, `Svobodou` a `Nováková` na začátku věty vyvolají `PREFLIGHT_BLOCKED`.
- T2: stejné příklady zůstanou blokované i se stavem `keep-bulk`.
- T3: `Prosím` a `Zítra` se nezačnou zobrazovat jako nové návrhy v panelu.
- Celkem 158 interních testů a 17 testů GHRAB AI Core conformance.
- Nová logika a testy zvětšily vstupní sestavené HTML o 4 468 B. Dotčené blokující performance limity byly zvýšeny o 5 kB, nejvýše o 0,83 %.

## Odložené body

- Jméno napsané celé malými písmeny zůstává samostatnou heuristickou třídou a v tomto vydání se nemění.
- XSS ratchet zůstává na 99 použitích `innerHTML` a 2 použitích `insertAdjacentHTML`. Jejich snižování a následné odstranění `unsafe-inline` vyžaduje samostatnou architektonickou změnu.

## Release podmínka

Lokální runner nemá Chromium. Produkční nasazení proto vyžaduje zelený repozitářový `qa:p5:ci` s browser, runtime, UI a axe reporty a následný live Pages/PWA smoke test.
