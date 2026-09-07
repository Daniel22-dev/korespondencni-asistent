# Korespondenční asistent 5.3.0 — zjednodušení workflow

**Datum:** 26. 7. 2026  
**Stav:** návrh k uživatelskému ověření

## Cíl aktualizace

Zachovat funkční bezpečnostní a analytické jádro aplikace, ale odstranit duplicity, vizuální zahlcení a nejasné přechody mezi lokální přípravou, odesláním do Gemini, rozborem a tvorbou odpovědi.

## Provedené změny

### 1. Jedna úvodní volba

Po otevření aplikace se zobrazí tři rovnocenné cesty:

- Analýza příchozího e-mailu
- Sestavení vlastního e-mailu
- Rychlá školní situace

Původní horní přepínač „Příchozí / Můj e-mail“ byl odstraněn, aby nebyla hlavní volba na dvou místech.

### 2. Společný bezpečnostní blok

Anonymizace a náhled přesného obsahu pro Gemini jsou součástí jednoho výrazného bloku. Lokální část a část určená k odeslání jsou oddělené silnou vizuální hranicí.

Zachované chování:

- e-maily a telefony se maskují automaticky,
- jména potvrzuje člověk,
- sousední jméno a příjmení se mohou spojit do jedné osoby,
- odeslání se odemkne až po ruční kontrole náhledu.

### 3. Oddělené fáze po odeslání

Výsledek rozboru z Gemini má vlastní jasně označený blok. Až pod ním následuje samostatné nastavení odpovědi včetně poznámky a výběru bodů, které má odpověď skutečně řešit.

### 4. Čistý výběr odpovědi

Aplikace nejprve ukáže tři varianty vedle sebe: stručnou, standardní a diplomatickou. Byly odstraněny duplicitní přepínače, porovnávání rozdílů a ovladače verzí či bloků z úvodního porovnání.

Po výběru jedné varianty:

- ostatní dvě se skryjí,
- vybraná varianta se rozšíří,
- teprve potom se zobrazí její úpravy, kontrola a finální akce,
- uživatel se může vrátit ke všem třem variantám.

### 5. Pracovní přehled

Dlouhá pravá lišta není otevřená trvale. Je přesunuta do volitelného sbaleného panelu, takže nepřekáží při čtení a výběru odpovědi.

### 6. Finální akce a návrat jmen

Akce jako ukázat se jmény, kopírovat, Gmail, textový dokument, uložit nebo navázat jsou po výběru varianty výraznější.

Lokální rekompozice jmen nyní zohledňuje běžné české oslovení, například „Ahoj Dane“ nebo „Milá Šárko“. Zástupný podpis se doplňuje z profilu odesílatele; nevyplněný profil zůstává upozorněním, nikoli bezpečnostní stopkou.

## Kontrola kvality

K aktualizaci byly přidány regresní testy pro:

- tři úvodní pracovní cesty,
- automatické maskování kontaktů bez automatického schovávání jmen,
- český vokativ při vrácení jmen,
- výběr jedné ze tří variant a skrytí ostatních.

Před předáním musí projít sestavení a úplná interní testovací sada.
