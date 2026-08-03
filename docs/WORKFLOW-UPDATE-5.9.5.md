# Korespondenční asistent 5.9.5 – adresát a hlášení chyby

## Přímý adresát odpovědi

Generativní prompt nyní výslovně rozlišuje přímého adresáta od třetích osob. Osoba, která napsala poslední relevantní zprávu, je v odpovědi oslovována ve 2. osobě. Lokální pojistka navíc opravuje časté konstrukce typu `dám osobě A vědět` na `dám ti vědět` nebo `dám Vám vědět` podle nastaveného tykání či vykání.

## Česká oslovení

- kolega a tykání: `Ahoj Pavlo,` – pouze křestní jméno;
- formální vykání: `Vážená paní Navrátilová,`, `Vážený pane Baláži,`, vhodný titul nebo `Dobrý den,`;
- nepovolené jsou kombinace křestního jména a příjmení po `Ahoj`, `pane` nebo `paní`.

Lokální rekompozice anonymizačních značek používá v neformálním oslovení první jméno a po `pane/paní` příjmení.

## Hlášení technické chyby

Centrální reportér z AI Studia zůstává jediným zdrojem sběru diagnostiky a tvorby ZIP balíčku. KS 5.9.5 nad jeho DOM vrstvou doplňuje testovací kompatibilní UX:

1. vzhled reportéru přebírá světlý nebo tmavý režim aplikace;
2. po povolení sdílení se dialog skryje, ale stream ani rozpracovaný formulář se nezruší;
3. nad aplikací zůstane plovoucí panel `Pořídit snímek`, `Zpět k hlášení`, `Ukončit snímání`;
4. počet snímků se průběžně zobrazuje a limit zůstává pět;
5. při pořizování snímku je i plovoucí panel dočasně skryt, takže se do obrázku nezachytí;
6. ukončení sdílení nebo návrat otevře původní formulář se zachovanými snímky a textem.

Tato implementace je záměrně izolovaná v modulu `src/js/26-error-reporter-compat.js`, aby ji bylo po praktickém ověření možné převést do centrálního reportéru AI Studia a následně zpřístupnit všem aplikacím.
