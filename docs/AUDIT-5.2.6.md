# Korespondenční asistent 5.2.6 — vyhodnocení auditu a provedené změny

**Datum:** 26. 7. 2026  
**Výchozí verze:** 5.2.5  
**Výsledná verze:** 5.2.6

## Závěr

Audit je velmi kvalitní a většina nálezů byla potvrzena přímo ve zdrojích. Za kritické považuji zejména dvě chyby: skloňované tvary označeného jména mohly zůstat v požadavku pro Gemini a spuštění interních testů mohlo smazat uživatelská data aplikace. Souhlasím také s nálezy v testovacím mocku, kontrole tónu, importu nastavení, manuálu, metadatech, CSS, závislostech a workflow.

Změny nebyly převzaty mechanicky. U anonymizace jsem návrh zpřesnil, aby skutečně prošla celá akceptační tabulka a současně se nevrátila nebezpečná prefixová shoda typu `Jan → Janák`.

## Provedené změny

### A. Anonymizace a bezpečnost

- Prefixové porovnávání jmen bylo nahrazeno generováním konkrétních českých pádových tvarů.
- Podporovány jsou mimo jiné tvary Petr/Petrovi/Petra/Petrem, Eva/Evě/Evu/Evou, Hana/Haně/Hanu, Adam/Adamovi/Adama, Olga/Olze/Olgu, Tomáš/Tomášovi/Tomáše, Novák/Novákovi/Nováka a Anna/Anně/Annu.
- Krátké jméno `Jan` neskrývá `Jana Nováková`, `Janák` ani `Janoušek`.
- Ručně doťuknuté tvary již skryté osoby dostanou stejnou značku, například `Petr`, `Petrovi` a `Petrem` zůstanou `osoba A`.
- Preflight zná aktivní anonymizační klíč konkrétní záložky. Pokud v náhledu zůstane jiný pád již skrytého jména, jde o tvrdou stopku a tlačítko generování zůstane zakázané.
- Kontext záložky se předává také do ukládání historie, pracovního konceptu, ukazatele postupu a centrální kontroly před voláním Gemini.

### B. Interní testy a lokální data

- Testovací sada před spuštěním zálohuje všechny klíče `rozbor_*` a `ks5_*` v `localStorage` i `sessionStorage`.
- Obnova úložiště proběhne jako první krok, teprve potom se obnoví pracovní stav, textová pole, API klíč, model a UI.
- Testovací mock má samostatný příznak běhu a funguje i při spuštění z běžného UI bez `?test=1`.
- Kontrola prázdného profilu je izolována také od vlastních podpisů.
- Text modalu testů nyní přesně vysvětluje, že se pracovní vstupy i lokální data dočasně mění a následně obnoví.
- Testovací sada byla rozšířena z 36 na 44 testů.
- `scripts/test.mjs` dál primárně používá `jsdom`; pro prostředí, kde npm registr není dostupný a `jsdom` není lokálně nainstalován, má hermetický fallback přes lokální headless Chromium. Obě cesty spouštějí stejnou interní sadu.

### C. Gemini API

- Testovací dostupnost je sjednocena přes `testMockAvailable()` ve všech hlavních akcích i v kontrole tónu.
- Synonyma a kontrola tónu používají `thinkingLevel: "minimal"`; rozbor, návrhy odpovědí a tvorba e-mailu používají `"medium"`.
- `maxOutputTokens` byl zvýšen na 32 768.
- Pokud API vrátí chybu 400 související s `thinking`, provede se nejvýše jeden opakovaný pokus na stejném modelu bez `thinkingConfig`.
- Obecná chyba 400 nezískala fallback na jiný model a zůstává tvrdou chybou.

### D. Manuál, import a metadata

- Manuál při zamítnutém přístupu už nezůstane skrytý na bílé stránce; rozlišuje zamítnutí a technické selhání ověření.
- Do hlavičky manuálu bylo doplněno tlačítko „Zpět do aplikace“.
- Import odmítá soubor s cizím `_app`; starší soubor bez `_app` zůstává podporovaný, ale před přepsáním profilu nebo slovníku vyžaduje potvrzení.
- `studioBridge` byl sjednocen na 1.3 a hlavička adaptéru na verzi 5.2.6.
- Dokumentace PWA už netvrdí, že samostatný repozitář obsahuje neexistující přesměrovací soubory.

### E. Provozní a vizuální opravy

- Opraven selektor vzhledu tlačítek „Přejít na náhled“.
- Z `devDependencies` byly odstraněny nepoužívané balíky `playwright` a `pngjs`; zůstal pouze `jsdom`.
- `package-lock.json` obsahuje jen kořenovou závislost `jsdom` a její úplný strom bez chybějících odkazů.
- GitHub Actions používá samostatnou concurrency skupinu pro jednotlivé pull requesty a hlavní větev.
- Verze aplikace, service workeru, balíčku, README, manuálu a changelogu byla sjednocena na 5.2.6.

## Zpřesnění proti doslovnému zadání

1. **Generátor pádů nebyl převzat doslova.** Navržená funkce by pro zakončení na `a` nevytvořila správně `Evě`, `Haně` ani `Anně`; obecná palatalizace by v těchto případech vracela chybné tvary. Doplnil jsem samostatnou tvorbu ženského dativu a úzká pravidla podle zakončení.
2. **Tvrdá stopka nepoužívá neomezené porovnání prefixů.** Kontroluje konkrétní vygenerované tvary a omezený seznam pádových koncovek. Tím zachovává bezpečnostní pojistku, ale neskrývá cizí jména se stejným začátkem.
3. **Jméno `Jan` záměrně negeneruje nejednoznačné tvary `Jana` a `Janu`.** Mohlo by jít o samostatné ženské jméno; tvrdá stopka a ruční označení zůstávají k dispozici. Akceptační test výslovně ověřuje `Jana Nováková`, `Janák` a `Janoušek`.
4. **`package-lock.json` nebyl přegenerován příkazem `npm install`.** Interní npm mirror v pracovním prostředí vracel HTTP 503. Lockfile byl proto deterministicky odvozen z původního lockfilu odstraněním stromů `playwright`, `playwright-core`, `pngjs` a jejich výhradní volitelné závislosti; následná kontrola našla 64 záznamů a 0 chybějících odkazů.
5. **`studioMinVersion` zůstala 0.5.1.** Správná ověřená verze AI Studia nebyla v auditu ani repozitáři doložena, proto jsem ji nehádal.

## Ověření

Příkaz `npm test` byl skutečně spuštěn po dokončení změn a skončil hláškou:

> CELKEM: vše zelené — release gate OK.

Výsledek:

- build a shoda release/service workeru: **prošlo**,
- runtime start: **bez chyb**,
- duplicitní ID: **žádná**,
- interní sada: **44/44 testů prošlo**,
- kontrola `thinkingLevel: "low"`: **řetězec ve výsledné aplikaci není**,
- `maxOutputTokens`: **32 768**,
- PWA identita a vlastní cache prefix: **prošlo**,
- oprávnění manuálu a návrat do aplikace: **prošlo**.

### Tabulka skloňování

| Základní jméno | Ověřené tvary | Výsledek |
|---|---|---|
| Petr | Petrovi, Petra, Petrem | prošlo |
| Eva | Evě, Evu, Evou | prošlo |
| Hana | Haně, Hanu | prošlo |
| Adam | Adamovi, Adama | prošlo |
| Olga | Olze, Olgu | prošlo |
| Tomáš | Tomášovi, Tomáše | prošlo |
| Novák | Novákovi, Nováka | prošlo |
| Anna | Anně, Annu | prošlo |

## Neimplementované body

- **Aktualizace `studioMinVersion`:** neprovedena, protože správná hodnota nebyla doložena. Ostatní body auditu byly implementovány.

## Místa s nejistotou

- Přesná minimální kompatibilní verze AI Studia GHRAB.
- Česká jména mají mnoho nepravidelných a cizojazyčných tvarů. Nová vrstva pokrývá auditní tabulku a běžné vzory, ale záměrně neslibuje úplný morfologický slovník; proto zůstává druhá blokující kontrola i ruční označení.
