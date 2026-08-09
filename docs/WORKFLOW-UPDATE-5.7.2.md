# WORKFLOW UPDATE 5.7.2

**Datum:** 2. 8. 2026  
**Výchozí verze:** 5.7.1  
**Cílová verze:** 5.7.2  
**Důvod vydání:** zapracování nezávislého hloubkového auditu jazykové, anonymizační a bezpečnostní vrstvy.

## Verdikt k auditu

Audit byl věcně správný a odhalil reálné chyby mimo původních 104 interních testů. Všechny funkční nálezy A1–A5, B1–B5, C1–C3 a doporučení D1–D2 byly zapracovány. D3 (duplicitní položky ve `STOP`) zůstává záměrně beze změny, protože nemá funkční dopad.

Jediné technické zpřesnění se týká výběru kandidáta při zpětné kanonizaci. Nelze globálně upřednostnit nejvyšší morfologickou jistotu napříč všemi pády: například výraz „Petra Nováka“ by se mohl mylně přijmout jako dva ženské nominativy a „Pavlu“ jako tvar jména Pavla. Implementace proto zachovává pořadí pádových hypotéz a cíleně odkládá jen podezřelé holé kmeny typu `Šárc`, `Monic`, `Lenc` nebo `Olz`, pokud existuje známý český základ s vyšší jistotou.

## A. Jazyková vrstva jmen

### A1 — ženský dativ a lokál

`femaleDative` nyní rozlišuje:

- `r → ře` (`Petra → Petře`, `Barbora → Barboře`),
- `d/t/n/b/p/v/f/m + ě` (`Jana → Janě`, `Eva → Evě`),
- `k/h/g/ch` se stávající palatalizací (`Šárka → Šárce`, `Olga → Olze`),
- ostatní souhlásky + `e` (`Tereza → Tereze`, `Pavla → Pavle`, `Denisa → Denise`).

### A2 — zpětná palatalizace

`reverseNameCandidates` doplňuje kandidáty:

- `c + e/i → ka` (`Šárce → Šárka`, `Monice → Monika`, `Lence → Lenka`),
- `z + e/i → ga/ha` (`Olze → Olga`).

Podezřelé strojové kmeny jako `Šárc` se nepřijmou před známým českým základem.

### A3 — pohyblivé -e- u jmen na -el

Doplněny zpětné tvary pro `Pavel`, `Karel` a `Havel` ve větvích `-ovi`, `-em`, `-u` a `-a`. Alternativní dativ/lokál `Pavlu`, `Karlu`, `Havlu` je zahrnut do variant. Pravidlo se aktivuje jen tehdy, když před `-el` stojí souhláska, takže `Daniel → Danielovi` zůstává beze změny.

### A4 — oddělení mužského a ženského nominativu

Přidána pojistka proti slučování přímých protějšků:

- `Petr ≠ Petra`,
- `Jan ≠ Jana`,
- `Novák ≠ Nováková`.

Skutečné pádové tvary se slučují dál: `Petr`, `Petrovi`, `Petrem` zůstávají jednou osobou. Zároveň se varianty spolehlivého ženského nominativu už nerozšiřují na mužské paradigma a pozorovaný alias se používá pouze přesně; `Petra` proto automaticky nepohltí `Petrovi`. Jednoslovná dvojznačnost typu `Petra` bez pádové nápovědy se konzervativně předá editoru pádů.

### A5 — samostatná část víceslovného jména

`buildMatchers` vytváří vedle celého jména také bezpečné jednoslovné matchery jednotlivých částí. Klíč `Petr Novák` proto skryje i samostatné `Nováku` v oslovení. Dvouslovná shoda má nadále přednost a nové matchery respektují pojistku mužského/ženského protějšku.

## B. Přísný režim

### B1 — školní zkratky

`PPP`, `SPU`, `IVP`, `SVP` a `OSPOD` používají samostatný case-sensitive regulární výraz s oboustrannou Unicode hranicí. Slova `spustíme`, `Spuštění` a `spusťte` již přísný režim neaktivují.

### B2 — drogerie

Kořen `drog` používá negativní podmínku pro `drogeri-`. Tvary `drogy`, `drogami` a `drogové` zůstávají citlivé.

### B3 — psychologie jako předmět

Osoby a odborné úkony (`psycholog`, `psycholožka`, `psychologický`) blokují přímo. Samotná `psychologie` se vyhodnocuje po větách a blokuje pouze s kontextem žáka, dítěte, vyšetření, zprávy, doporučení, poradny, diagnózy nebo podpůrných zkratek.

### B4 — technické rozvody

Spojení `po rozvodu` neblokuje při bezprostředním pokračování `vody`, `topení`, `tepla`, `plynu`, `elektřiny`, `elektroinstalace`, `vzduchotechniky`, `sítě` nebo `internetu`.

### B5 — závislost po větách

Detekce závislosti se provádí v jednotlivých větách. Obecná věta `V závislosti na počasí…` už nevypne citlivý nález `závislost na hazardu` v další větě.

## C. Další opravy

### C1 — cizí jména

Pokud kanonizace neznámého tvaru změní základ bez pádové nápovědy a výsledný základ není ve známých jménech ani lokálním slovníku, záznam dostane `caseUnresolved`. Uživatel musí potvrdit nebo upravit všech sedm pádů. Příklad: `Xiu → Xia` se nepřijme tiše. `Bez Marka → Marek` zůstává automatické díky pádové nápovědě.

### C2 — telefon, rodné číslo a číslo dokladu

Telefonní shody se odečtou od kandidátů rodného čísla podle normalizovaných číslic. Devítimístný mobil proto nevytváří dvojí hlášku. Ústupová akce `Není to telefon, je to číslo dokladu` je dostupná také u číselného nálezu klasifikovaného jen jako rodné číslo / datumový identifikátor, například u neoznačeného desetimístného kódu. Výslovně označené rodné číslo ani tvar s lomítkem tuto ústupovou akci nenabízí.

### C3 — text hlášky

`Zobečni situaci` bylo opraveno na `Zobecni situaci`.

## D. Soukromí a dokumentace

### D1 — známé omezení odvozených příjmení

Manuál 1.3.1 nově výslovně uvádí, že výstupní pojistka nemusí zachytit všechny odvozené rodinné tvary příjmení, například `Novákovic` nebo `Novákových`. Release gate ověřuje přítomnost tohoto upozornění.

### D2 — rozepsaný citlivý text

`scheduleWorkingSessionSave` i `saveWorkingSessionNow` kontrolují surový obsah obou pracovních polí. Pokud obsahuje citlivé školní téma, pracovní relace se smaže a nic se do `sessionStorage` neuloží. Tato kontrola sama neaktivuje celý přísný režim.

## Testy a release gate

Interní sada byla rozšířena z 104 na **113 testů**. Nové regresní testy pokrývají:

- ženský dativ a lokál,
- zpětnou palatalizaci,
- pohyblivé `-e-` u `-el`,
- oddělení mužských a ženských nominativů,
- samostatné příjmení/vokativ víceslovné osoby,
- falešné poplachy přísného režimu,
- cizí jméno vyžadující ruční kontrolu,
- deduplikaci telefonu a rodného čísla,
- ústupovou akci čísla dokladu,
- zákaz uložení citlivého rozepsaného textu.

`scripts/test.mjs` má `MIN_INTERNAL_TESTS = 113` a navíc staticky ověřuje dokumentaci omezení odvozených příjmení.

## Verze

- aplikace: **5.7.2**,
- `package.json` / `package-lock.json`: **5.7.2**,
- `RELEASE.version`: **5.7.2**,
- service worker `APP_VERSION`: **5.7.2**,
- interaktivní manuál: **1.3.1** pro aplikaci **5.7.2**.

## Zachované bezpečnostní vrstvy

Beze změny zůstaly:

- povinný preflight celého skutečně sestaveného promptu,
- tvrdá stopka na nezakrytý tvar již skrytého jména,
- jednotný zdroj návrhů jmen pro panel a bezpečnostní souhrn,
- lokální návrat skutečných jmen až po odpovědi modelu,
- čištění výstupu modelu,
- mazání dat podle jmenného prostoru,
- potlačení historie, debug promptu a pracovní relace v přísném režimu.
