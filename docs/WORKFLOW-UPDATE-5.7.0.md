# Korespondenční asistent 5.7.0 — Můj způsob psaní

## Cíl změny

Verze 5.7.0 přidává dlouhodobou preferenci formulací, aniž by duplikovala nebo oslabovala nastavení konkrétního e-mailu. Profil říká **jak uživatel obvykle píše**; pracovní krok nad e-mailem dál určuje **jak má vyznít tato konkrétní zpráva**.

## Umístění v rozhraní

V modálním okně Profil odesílatele jsou tři oddělené části:

1. **Identita a pracovní kontext** — jméno, role, rod, předměty a škola.
2. **Můj způsob psaní** — dlouhodobý základ formulací, nežádoucí obraty a vlastní preference.
3. **Podpis** — způsob lokálního doplnění podpisu.

V pracovním toku se stejné volby neopakují. V pokročilém režimu je pouze přepínač, zda se má uložený osobní styl pro daný e-mail použít.

## Dostupné dlouhodobé profily

- **Civilní profesionální** — přirozený, věcný a neúřednický text.
- **Úsporný a přímý** — krátké odstavce a rychlý přechod k věci.
- **Vysvětlující a přehledný** — srozumitelné souvislosti a jasné kroky.
- **Formální a přesný** — zdrženlivé, přesné a profesionální formulace.

Uživatel může navíc uložit obraty, kterým se má model vyhýbat, a krátkou vlastní preferenci formulace. Rozhraní výslovně upozorňuje, že do těchto polí nepatří jména, třídy, diagnózy ani konkrétní případy.

## Pravidla priority

Aplikace předává modelu jednoznačné pořadí:

1. bezpečnost a ochrana údajů;
2. fakta a závazné informace ze zadání;
3. adresát, účel a komunikační situace;
4. tón, délka a jednorázová úprava konkrétní zprávy;
5. dlouhodobý způsob psaní z profilu;
6. obecné výchozí formulace aplikace.

Osobní styl tedy může ovlivnit slovník, rytmus a míru přímosti, ale nesmí změnit fakta, doplnit neexistující okolnosti ani přebít konkrétní volbu tónu.

## Kdy se styl používá

Použije se při:

- odpovědi na příchozí e-mail;
- přeformulování vlastního textu;
- sestavení e-mailu z bodů;
- korektuře se zapnutou úpravou slohu a formulací;
- navazujících AI úpravách vybrané varianty.

Nepoužije se při prosté pravopisné a gramatické opravě, aby aplikace zachovala původní osobní vyjadřování uživatele.

## Kompatibilita a import

Starší profil bez položky `writingStyle` zůstává funkční a osobní styl se automaticky neaktivuje. Po otevření a uložení profilu si uživatel dlouhodobý způsob psaní vědomě zvolí. Export nastavení jej obsahuje automaticky a import nyní okamžitě obnoví údaje i přepínače v otevřeném rozhraní.

## Ověření

Interní sada má **94/94 úspěšných testů**. Nové testy ověřují zejména:

- oddělení dlouhodobého způsobu psaní od tónu zprávy;
- prioritu konkrétního e-mailu před profilem;
- zapnutí a vypnutí profilu pro jednotlivou zprávu;
- vypnutí stylu při prosté pravopisné korektuře;
- ukládání dlouhodobého profilu a vlastních preferencí;
- bezpečné přidání profilu do promptu.
