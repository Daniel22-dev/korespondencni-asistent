# Korespondenční asistent 5.9.4 – anonymizace a workflow odpovědi

## Opravené regresní chyby

1. `wordObjs()` nyní uchovává hranici řádku. `mayJoinNameWords()` odmítne spojení, pokud další část začíná po zalomení řádku. Podpis `Pavla Tlolková` se proto nespojí s následujícím nadpisem `Důležité`.
2. Strukturované řádky se štítky `School name`, `Název školy`, `Název instituce`, `Škola`, `Instituce` a `Organizace` vytvoří jeden návrh nad celou hodnotou. Zachovají se čárky, pomlčky i právní forma, například `Gymnázium, Ostrava-Hrabůvka, p.o.`.
3. CSS výslovně respektuje atribut `hidden` u školního a přímého AI režimu. Popis školního režimu neoznamuje spojení bez skutečné health kontroly.
4. Direct Gemini režim nabízí tři modelové volby: economy, balanced a quality. School Gateway nadále používá abstraktní profily a konkrétní provider/model určuje serverová politika.

## Nové pořadí po rozboru

- AI vrací každý požadavek jako samostatný, konkrétní bod, který dává smysl bez znovuotevření původního e-mailu.
- Všechny body jsou automaticky zaškrtnuté a jsou součástí karty Nastavení odpovědi.
- Uživatel nic povinně nevybírá; mění pouze body, které záměrně nechce v odpovědi řešit.
- Volitelná poznámka je hned pod body a je dostupná v jednoduchém i pokročilém režimu.
- Teprve poté následuje adresát, záměr, tón, délka, styl, oslovení a jazyk.

## Testy

Release gate vyžaduje nejméně **139 interních testů** a následně spouští **17 testů GHRAB AI Core 1.0.0**. Nové regresní případy pokrývají hranici řádku, celý název instituce, režimové skrývání, tři modelové volby a nové pořadí workflow.
