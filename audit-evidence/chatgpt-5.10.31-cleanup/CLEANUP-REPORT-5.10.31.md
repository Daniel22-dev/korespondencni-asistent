# Korespondenční asistent 5.10.31 — konzervativní cleanup

Datum: 2026-09-27
Vstup: uživatelem dodaný balíček 5.10.30
SHA-256 vstupního ZIP: `9fa3ead22a4168e6853f28c38784c857356e9365e257fcada9d4b4f36a96e3c4`

## Rozsah změn

- Rozdělen monolitický `src/js/70-nastroje-testy-data.js` do `70-nastroje.js`, `71-test-runner.js` a `72-sprava-dat.js` při zachování pořadí a logiky.
- Produkční build nyní před strippingem test runneru fail-closed ověřuje právě jednu START a jednu END značku.
- Odstraněny pouze osiřelé CSS bloky bez aktivního HTML/JS protějšku; dynamicky generované a platformní selektory byly zachovány.
- Přidáno explicitní `clearAnonymizationCaches()`. Cache se čistí po změně uloženého slovníku a při volbě „Smazat všechna lokální data“.
- Stávající regresní test správy lokálních dat rozšířen o ověření vyčištění anonymizačních cache.
- Verze a releasové/GARP vazby převedeny na 5.10.31, dotčené assurance hashe a CI trust-anchor pin byly přepočítány.
- `dist-school-server/` zůstal záměrně frozen; tento cleanup nemění odloženou school-server fázi.

## Velikost zdrojů

| Metrika | 5.10.30 | 5.10.31 | Rozdíl |
|---|---:|---:|---:|
| `src/` celkem | 1 194 810 B | 1 189 778 B | -5 032 B |
| `src/js/` | 618 958 B | 620 069 B | +1 111 B |
| `src/styles.css` | 108 726 B | 102 583 B | -6 143 B |

Nárůst JS je záměrný: explicitní invalidace cache, regresní assertion a čitelnější rozdělení test runneru. Celkový `src/` je přesto menší.

## Ověření

Lokálně PASS:

- `npm run build`
- `npm test`: 171/171 interních testů, 17/17 Core conformance; UI/Platform regresní kontroly PASS
- `npm run qa:ui`: 48/48
- `npm run qa:quality`: 31/31
- `npm run test:reporter`: 52 PASS / 0 FAIL (browser část NOT_READY z důvodu spravované politiky prostředí)
- `npm run qa:garp25:static`: PASS
- `npm run qa:garp27:static`: PASS s novým externím trust pinem
- `npm run qa:garp27:foundation`: 10/10 PASS
- `npm run qa:xss`: PASS
- `npm run qa:garp:secret-scan`: PASS
- `npm run qa:garp:canary-scan`: PASS

Lokálně nešlo plnohodnotně dokončit browserovou P5 runtime session: spravované Chromium má `URLBlocklist: ["*"]` a blokuje `127.0.0.1`. `qa:p5` proto skončí na `qa:suite-session` před vlastní aplikací; jde o omezení testovacího prostředí, nikoli o zaznamenaný aplikační regresní FAIL. `qa:axe` je zde navíc bez lokálně instalovaného přesného `axe-core 4.12.1`. Repozitář deklaruje Node >=24, zatímco lokální runtime je Node 22.16.0. Finální promotion proto musí standardně projít GitHub CI na deklarovaném Node 24 a chráněné P5/Safe Promotion cestě.

## Funkční hranice

Cleanup nemění AI operace, texty promptů, provider/model routing, AI Core 1.0.0, formát lokálních dat ani uživatelské workflow. Záměrně nebyl proveden široký refaktor globálních vazeb `window.*`, protože by zvýšil regresní riziko bez přímého přínosu pro tento cleanup.
