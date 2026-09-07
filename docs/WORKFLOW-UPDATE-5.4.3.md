# Korespondenční asistent 5.4.3

## Cíl aktualizace

Zrychlit ruční anonymizaci dlouhých e-mailů a jednoznačně ukázat, proč aplikace ještě nepovolí odeslání textu do Gemini.

## Změny

### Přímý výběr v textu

Kliknutí na slovo nebo označení víceslovného úseku otevře pevný panel napravo. Panel zůstává při posouvání dlouhého e-mailu viditelný. Na úzkém displeji se změní na spodní plovoucí nabídku.

Dostupné kategorie:

- Osoba
- Instituce / organizace
- Místo
- Název / dílo
- Kontakt
- Jiný citlivý údaj
- Ponechat

Nové náhrady používají značky `[název N]`, `[kontakt N]` a `[citlivý údaj N]`.

### Finální kontrola

Kontrola je rozdělena na tři kroky:

1. citlivé údaje skryty,
2. návrhy k posouzení,
3. potvrzení uživatele.

Přímo u druhého kroku jsou akce **Projít jednotlivě** a **Ponechat všech N**. Pod potvrzením se zobrazuje jediná konkrétní informace, která vysvětluje, co ještě blokuje pokračování.

### Jiný adresát

V pokročilém režimu je možné zvolit adresáta **Jiný** a doplnit vlastní popis, například nakladatelství, knihovna nebo externí partner. Prázdný popis je před generováním zachycen a uživatel je vyzván k doplnění.

## Testy

Interní sada ověřuje:

- otevření kategorií po výběru výrazu,
- nové typy anonymizačních značek,
- jasný stav finální kontrolní brány,
- vlastní popis adresáta Jiný.
