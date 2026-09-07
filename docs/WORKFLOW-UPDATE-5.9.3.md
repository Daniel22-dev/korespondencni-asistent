# Korespondenční asistent 5.9.3 – systémové skloňování osobních jmen

## Cíl změny

Verze 5.9.3 řeší skloňování osobních jmen jako samostatnou bezpečnostní vrstvu. Cílem není „uhodnout co nejvíce tvarů“, ale:

1. správně a automaticky zpracovat běžná česká jména;
2. používat stejná pravidla ve všech částech aplikace;
3. u nejednoznačných jmen raději zastavit odeslání než potichu vložit chybný tvar;
4. ponechat skutečná jména a jejich pády pouze v prohlížeči.

## Původní příčina chyby

Předchozí implementace měla dvě oddělené cesty pro 5. pád:

```text
běžné vrácení anonymizované osoby
recompose()
→ personFormsForEntry()
→ generatedPersonForms()
→ declineNameWord()
```

A vedle toho samostatnou pomocnou větev pro oslovení s přesnými výjimkami. Správná výjimka `Daniel → Danieli` se nacházela ve druhé větvi, zatímco běžné vrácení jména vždy použilo první větev a obecné pravidlo vytvořilo `Daniele`. Proto pouhé doplnění další výjimky nemohlo systémově vyřešit ostatní jména.

## Nová architektura

### Jeden zdroj pravdy

Soubor `src/js/35-czech-person-grammar.js` poskytuje jediný lokální engine `CZ_PERSON_GRAMMAR`:

- `declineWord()` – skloňování jedné části jména;
- `declinePerson()` – skloňování celého jména v kontextu;
- `inferGender()` – konzervativní určení gramatického rodu;
- `knownGivenNames()` a `knownSurnames()` – pomocné lexikální seznamy pro rozpoznání a zpětnou kanonizaci.

`src/js/40-anonymizace.js` už nevytváří vlastní pádové tvary. Stejný engine používá:

- vrácení anonymizovaných osob do výsledku;
- tvorba oslovení;
- skloňování osoby vložené lokálním štítkem;
- následné AI úpravy vybraného návrhu;
- zpětné rozpoznání skloňovaného vstupu;
- editor všech sedmi pádů.

### Kontext celého jména

Engine rozlišuje křestní jméno, příjmení, titul, iniciálu a nesklonné částice. Rod zjišťuje z celého spojení, nikoli pouze z posledního písmene jednoho slova.

Příklady automatického výsledku:

| Základní tvar | 5. pád |
|---|---|
| Daniel | Danieli |
| Viktor | Viktore |
| Igor | Igore |
| Alois | Aloisi |
| Klaus | Klausi |
| Asterix | Asterixi |
| Karin | Karin |
| Ingrid | Ingrid |
| Dagmar | Dagmar |
| Petr Svoboda | Petře Svobodo |
| Daniel Baláž | Danieli Baláži |
| Viktor Novák | Viktore Nováku |

## Bezpečnostní model nejistoty

Výsledek enginu obsahuje kromě sedmi pádů také:

- `confidence`;
- `requiresReview`;
- konkrétní `reviewReasons`;
- určený rod a roli jednotlivých částí jména.

Ruční kontrolu vyžadují zejména:

- rodově nejednoznačná jména;
- jména závislá na výslovnosti, například Michael;
- cizí, složená, apostrofovaná nebo vnitřně verzálková jména;
- pravopisně a výslovnostně citlivé zápisy, například Mia nebo Maya;
- typy s možným pohyblivým `e`;
- příjmení s rodinně proměnlivým užíváním, například Švec nebo Němec;
- vstup, u kterého nelze bezpečně potvrdit základní tvar.

V takovém případě aplikace nevloží tichý odhad do ostrého výstupu. Položka v klíči náhrad dostane stav `caseUnresolved` a preflight odeslání zablokuje.

## Editor 1.–7. pádu

Uživatel otevře u osoby editor a zkontroluje všech sedm tvarů. Akce **Potvrdit tvary**:

- vyžaduje vyplnění všech sedmi polí;
- použije tvary pro aktuální práci;
- odstraní blokaci preflightu;
- nepřenáší skutečné jméno ani tvary do AI;
- sama o sobě nic trvale neukládá.

Trvalý lokální slovník se změní až samostatnou výslovnou akcí **Uložit jména**. Slovník ukládá pouze základní tvar a sedm potvrzených pádů; neukládá anonymní token, stav kontroly ani data AI operace.

## Zpětná kanonizace

Při označení pádového tvaru, například `Petrovi Svobodovi`, aplikace hledá pravděpodobný nominativ a ověřuje jej přes stejný gramatický engine. Kandidáti se hodnotí podle:

- shody vytvořeného pádu se skutečně označeným textem;
- známého křestního jména nebo častého příjmení;
- kontextu rodu a role části jména;
- pravděpodobnosti, že kandidát je skutečně nominativ;
- případné nejednoznačnosti více stejně silných řešení.

Pokud bezpečný nominativ nelze určit, aplikace původní zápis zachová a vyžádá lidskou kontrolu. Nevytváří domnělý tvar jen proto, aby workflow pokračovalo.

## Soukromí

Tok skutečných údajů zůstává lokální:

```text
skutečné jméno + potvrzené pády
→ pouze prohlížeč / lokální pracovní stav

AI model
← značka osoby + číslo požadovaného pádu

návrat modelu
→ lokální nahrazení značky potvrzeným tvarem
```

Model tedy neobdrží jméno, jeho pádové paradigma ani obsah lokálního slovníku.

## Kompatibilita a obnova relace

Starší pracovní relace se při načtení znovu vyhodnotí aktuálním enginem. Existující vlastní tvary zůstávají zachovány. U starších nejistých položek se zachová důvod kontroly a uživatel je musí potvrdit před dalším odesláním.

## Regresní sada

Verze 5.9.3 přidává mimo jiné testy pro:

- matici běžných vokativů;
- shodu všech cest se společným enginem;
- nesklonná ženská jména zakončená souhláskou;
- celé jméno a kontext příjmení;
- úplné paradigma Daniela a Petra Svobody;
- zpětnou kanonizaci dativu;
- blokaci nejistých, cizích a rodinně proměnlivých jmen;
- zákaz vymyšleného nominativu cizího jména;
- přenos stavu kontroly do nových položek klíče;
- blokaci preflightu a odblokování po potvrzení;
- prioritu vlastních tvarů před automatickými;
- oddělení pracovního potvrzení a trvalého slovníku;
- mužská jména na `-a` a `-o`;
- rodově nejednoznačná křestní jména vyřešená příjmením;
- složené zápisy, různé apostrofy a vnitřní verzály;
- výslovnostně citlivá jména bez tichého odhadu;
- kanonizaci celého jména a bezpečnou stopku při více možných nominativech.

Release gate pro 5.9.3 vyžaduje nejméně **135 interních testů** a následně spouští **17 testů GHRAB AI Core 1.0.0**.
