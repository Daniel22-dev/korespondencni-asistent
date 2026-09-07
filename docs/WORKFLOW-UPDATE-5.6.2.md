# Korespondenční asistent 5.6.2 — Přirozený styl

Datum: 2. 8. 2026

## 1. Cíl změny

Aplikace už před touto verzí dobře pracovala s adresátem, účelem, tónem, délkou, rolí pisatele a školním scénářem. Chyběla však explicitní kontrola toho, zda výsledný text nepůsobí jako univerzální šablona.

Verze 5.6.2 proto nepřidává povinný druhý AI průchod. Přirozenost se zlepšuje přímo v prvním generování a uživatel má navíc k dispozici lokální kontrolu a volitelné cílené nástroje.

## 2. Vrstva Přirozený styl v promptech

Nové pravidlo se používá při:

- generování tří variant odpovědi;
- přepisu e-mailu do jiného tónu;
- sestavení e-mailu z bodů;
- následné AI úpravě konceptu.

Model má:

- používat konkrétní informace, které skutečně jsou ve vstupu;
- ponechat pouze věty s informační, vztahovou nebo organizační funkcí;
- omezit prázdné úvody, opakování, úřednický jazyk a automatická klišé;
- nevymýšlet fakta ani osobní okolnosti;
- při nedostatku informací raději vytvořit kratší neutrální text;
- nerozvíjet citlivé školní údaje jen kvůli vyšší konkrétnosti.

Režim prosté pravopisné a gramatické korektury pravidlo záměrně nepoužívá, protože má zachovat původní styl autora.

## 3. Rychlá úprava Přirozeněji

V editoru přibylo tlačítko **Přirozeněji** vedle úprav Zkrátit, Zmírnit a Zpřesnit.

Úprava:

- odstraní prázdné zdvořilostní obraty, opakování a nadměrně uhlazené formulace;
- zachová fakta, termíny, význam, tón, anonymizační značky a uzamčené části;
- nesmí doplnit nové okolnosti, které uživatel neuvedl.

Akce je volitelná a používá jeden API požadavek stejně jako ostatní rychlé AI úpravy.

## 4. Bezplatná kontrola šablonovitosti

Kontrola před odesláním nově lokálně hledá pouze nápadné vysoce rizikové obraty, například:

- „touto cestou“;
- „dovolte mi, abych“;
- „je důležité zdůraznit“;
- „věřím, že společně“;
- „neváhejte mě kontaktovat“.

Doplněny jsou také vybrané anglické a španělské ekvivalenty. Nález je oranžové neblokující upozornění. Samotné běžné oslovení, podpis nebo funkční věta „Děkuji za zprávu“ se za šablonovitost nepovažují.

## 5. Jak text působí?

Původní funkce **Jak vyzní?** byla rozšířena a přejmenována na **Jak text působí?**. V jediném levném API požadavku nyní vrací:

- celkové naladění;
- míru přirozenosti;
- komunikační rizika;
- konkrétní šablonovité obraty;
- stručný návrh možné úpravy.

## 6. Regresní kontrola

Interní sada má **92/92 úspěšných testů**. Nové testy ověřují:

- zapojení pravidla Přirozený styl do správných promptů;
- zachování původního stylu při prosté korektuře;
- lokální rozpoznání nápadně šablonovitého obratu;
- toleranci běžného funkčního poděkování;
- přítomnost bezpečného tlačítka Přirozeněji;
- vykreslení přirozenosti a šablonovitých obratů v hodnocení textu.
