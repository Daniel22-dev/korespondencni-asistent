# Korespondenční asistent 5.7.1 — auditní oprava jazykové a bezpečnostní vrstvy

**Datum:** 2. 8. 2026  
**Výchozí verze:** 5.7.0  
**Výsledná verze:** 5.7.1

## Verdikt k auditu

Audit Claude Opus byl technicky kvalitní a hlavní reprodukovatelné nálezy byly významné. Nešlo o kosmetické připomínky, ale o kombinaci chybných českých pádů, falešných bezpečnostních blokací a pravidel, která kvůli ASCII hranici `\b` nefungovala s českou diakritikou.

Nálezy nebyly převzaty mechanicky. Každý byl ověřen proti zdrojům a opatřen regresním testem. Zachovány zůstaly stávající silné vrstvy: povinný preflight celého promptu, lokální návrat anonymizačních značek, tvrdá kontrola nezakrytého tvaru již skrytého jména, CSP, service worker a oddělení osobního způsobu psaní od tónu konkrétní zprávy.

## Provedené změny

### 1. České pády osob

- Kontext předložky nyní vrací více možných pádů, například `za` může znamenat 4. i 7. pád.
- Zpětná kanonizace byla rozšířena o mužský dativ a vokativ, pohyblivé `-e-`, příjmení typu **Krejčí** a adjektivní příjmení typu **Malý / Malá**.
- Základní tvar se už neskládá slepě slovo po slovu. Celá kandidátní fráze musí po opětovném skloňování odpovídat označenému tvaru.
- Nerozpoznaný případ se neuloží tiše jako domnělý 1. pád. Dostane oranžové označení **Zkontroluj skloňování**, automaticky se otevře editor pádů a odeslání zůstane zablokované do ručního potvrzení.
- Překrývající se varianty téže osoby se slučují, aby jedna osoba nevznikla jako `osoba A` a `osoba B`.

### 2. Telefon versus číslo dokladu

- Automatická detekce a bezpečnostní preflight používají jeden společný regulární výraz.
- Telefon se nehledá uvnitř delšího číselného řetězce.
- Před detekcí se maskují čísla uvedená jako variabilní symbol, číslo objednávky, faktury, jednací číslo, ISBN, IČO nebo DIČ.
- U nejednoznačného devítimístného čísla je k dispozici bezpečná akce **Není to telefon, je to číslo dokladu**. Číslo se nepropustí v otevřené podobě, ale anonymizuje jako `[číslo dokladu N]`.

### 3. Citlivá školní témata

- Holé kmeny jako `rozvod`, `závislost` a `poradna` byly nahrazeny kontextovými pravidly.
- Provozní věty typu **rozvod vody**, **v závislosti na počasí** nebo **zpráva z poradny k objednávce učebnic** už nespouštějí přísný režim.
- Skutečně citlivé kontexty, například podpůrná opatření, zdravotní stav, šikana, OSPOD nebo závislost na návykových látkách, zůstávají blokované.
- Obecná anglická a španělská slovní zásoba k tématu zdraví už sama o sobě neznamená citlivý osobní údaj.

### 4. Kontrola před exportem

Tvrdá stopka (`danger`) zůstává jen pro dvě nevratné chyby:

1. prázdný výsledný text;
2. nevyplněná anonymizační značka.

Krátký text, neznámý nebo nesouhlasný gramatický rod, množné číslo, chybějící zopakování termínu, příloha, tón či šablonovitá formulace jsou neblokující upozornění. U množného čísla se sledují jen skutečné akce pisatele, například **děkujeme**, **potvrzujeme** nebo **ozveme se**; věty **máme ve škole pravidlo** a **jsme domluveni** nejsou chybně vyhodnoceny jako psaní za tým. Výraz **technické selhání** není považován za osobní útok.

### 5. Unicode bezpečné hranice slov a termíny

- Česká pravidla nepoužívají ASCII hranici `\b` tam, kde by selhala na diakritice.
- Funguje detekce frází **věřím, že společně** a **v dnešní době**.
- Adresní heuristika rozpozná také **náměstí**, **nábřeží**, `čp.` a ulice začínající písmeny Č, Š, Ř, Ž a dalšími českými znaky.
- Rozpoznání dnů podporuje základní i přídavné tvary: **úterý / úterní**, **čtvrtek / čtvrteční**, **pondělí / pondělní** a analogicky ostatní dny.

### 6. Jednotný seznam možných jmen

Bezpečnostní souhrn už nepoužívá druhý, hrubší seznam velkých slov. Čerpá ze stejného našeptávače jako panel návrhů. Přesná kontrola uloženého jména a jeho nezakrytých pádů zůstává zachována.

### 7. Přísný režim a pracovní relace

Aktivace citlivého scénáře nyní:

- vypne historii a debug prompt;
- smaže rozpracovanou pracovní relaci;
- potlačí další automatické ukládání původního textu se skutečnými údaji.

Ukládání se obnoví až po opuštění přísného scénáře nebo po vymazání vstupu.

### 8. Lokální data a import profilu

- **Smazat všechna lokální data** odstraňuje také `ghrab.handoff.v1` a `ghrab.pilot.events.v2` z lokálního i relačního úložiště.
- Importovaný profil prochází whitelistem polí, délkovými limity a kontrolou enumů.
- Stejná sanitizace se používá také při běžném načítání profilu, takže ji nelze obejít přímým zápisem do `localStorage`.
- Obnova relace už neoznačí poslední krok jako hotový bez obnoveného výsledku.

## Regresní testy

Interní sada byla rozšířena z **94 na 104 testů**. Nové tabulkové testy pokrývají:

- 16 reálných českých pádových situací a očekávaný 1. a 5. pád;
- sloučení více pádů téže osoby do jedné značky;
- 12 případů telefonů, dokladových čísel, ISBN, IČO, účtu a variabilního symbolu;
- 20 nezávadných a 10 skutečně citlivých školních vět;
- falešné blokace kontroly před odesláním;
- Unicode hranice u českých frází, adres a dnů v týdnu;
- shodu návrhů jmen mezi panelem a preflightem;
- potlačení pracovní relace v přísném režimu;
- smazání lokální předávky a telemetrie AI Studia;
- whitelist importovaného i přímo uloženého profilu.

Release gate navíc hlídá, že počet interních testů neklesne pod 104.

## Ověření vydání

Před vytvořením balíčku musí projít:

```bash
npm test
```

Tento příkaz znovu sestaví aplikaci, ověří verzi 5.7.1, PWA a bezpečnostní brány a spustí celou interní sadu. Generovaná složka `dist/` se do GitHub balíčku nevkládá; vytváří ji GitHub Actions.
