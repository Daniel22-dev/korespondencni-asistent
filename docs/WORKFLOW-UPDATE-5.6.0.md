# Korespondenční asistent 5.6.0 — bezpečnost poznámek a zachování práce

## Opravené problémy

### Návrat z bezpečnostních pravidel

Kontextový odkaz již neopouští aplikaci. Pravidla se otevřou v modálním okně a úplný manuál v nové kartě. Rozpracovaný stav se navíc dočasně ukládá do `sessionStorage`, takže obnovení stejné karty zachová zdrojový text, klíč náhrad, anonymizovaný obsah, potvrzení i pracovní krok. Po dokončení nebo zahájení nové práce se dočasný stav smaže.

### Poznámka pro odpověď

Poznámka prochází přísnou kontrolou. Známé pádové tvary anonymizovaných osob se nahradí bezpečnou značkou. Výraz vypadající jako nevyřešené jméno nebo jiný identifikátor zastaví odeslání. Pod polem jsou lokální štítky typu `osoba B · Cecilia`; skutečné jméno se používá jen v rozhraní prohlížeče.

### Celý prompt

Bezpečnostní preflight se spouští až nad přesným promptem připraveným pro API. Kontroluje hlavní text, poznámku, zvolené parametry i doplňující kontext. Nestačí tedy, aby byla bezpečná pouze velká náhledová plocha.

### Strojové značky a pády

Do Gemini se osoby převádějí na značky typu `[[PERSON_B]]`. Model má při použití osoby vrátit také požadovaný gramatický pád, například `[[PERSON_B|4]]`. Aplikace značku převede na bezpečný tvar `osobu B`; skutečné jméno se dosadí až lokálně po vědomém odanonymizování.

Klíč náhrad umožňuje u osoby otevřít editor sedmi pádových tvarů. Automatika obsahuje obecná pravidla a zvláštní zacházení s běžnými cizími typy jmen, ale uživatel může neobvyklé tvary lokálně opravit bez odeslání jména modelu.

### Kontrola odpovědi

Každý text vrácený Gemini se před zobrazením znovu prověřuje. Strojové značky se převádějí na bezpečné obecné tvary a známé skutečné údaje se znovu anonymizují. Pokud aplikace narazí na únik, který neumí bezpečně vyřešit, výstup zablokuje místo jeho zobrazení.

## Ověření

Interní sada obsahuje 85 testů. Přibyly scénáře pro:

- Cecilia → Cecilii / Cecilií;
- Julie → Julii / Julií;
- jméno použité pouze v poznámce;
- strojovou značku s gramatickým pádem;
- kontrolu hotové odpovědi;
- úplný sestavený prompt;
- lokální štítky osob;
- obnovu rozpracované práce pouze v rámci relace.

Release gate zároveň kontroluje sestavenou aplikaci, manuál, PWA verzi, duplicity ID, bezpečnostní prvky a strukturu nasazovaného balíčku.
