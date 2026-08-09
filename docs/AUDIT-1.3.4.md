# Audit a implementace 1.3.4

## Implementační komentář

Verze 1.3.4 opravuje kritické chyby regenerace, náhledu a tisku PDF, nedestruktivní ruční editaci, vykreslení kontroly kvality, konzistenci celé tříúrovňové sady, práci s Gemini API, CEFR ovládání, zásobník dialogů, přístupnost nápověd, návrat z manuálu a související provozní detaily. Změny byly provedeny ve zdrojích; `dist/` vznikl pouze buildem.

Aktuální ověřená minimální verze AI Studia je `0.18.7`, proto bylo pole `studioMinVersion` aktualizováno na tuto hodnotu.

## Zpřesnění proti doslovnému zadání

- **A6 — `thinkingLevel: low`:** audit uváděl, že hodnota `low` není pro aktuální modely doložená. Aktuální oficiální dokumentace ji již uvádí u obou použitých modelů. Přesto byla implementována požadovaná diferenciace `minimal` pro levné operace a `medium` pro tvorbu, protože lépe odpovídá náročnosti úloh. Záchranný pokus bez `thinkingConfig` zůstal jako obrana proti budoucí změně API.
- **B1 — pravidlo celé sady:** kromě požadované změny `variantModePromptLine` se podmíněně mění také základní instrukce Normální verze. Bez toho by prompt současně požadoval zachovat i změnit obsah.
- **C6 — počet tiskových bloků:** zadání uvádí, že vstup s úvodem a dvěma úlohami má vytvořit dva bloky. To je v rozporu s popisem chyby i dosavadním významem bloků. Implementace proto správně nevytvoří blok z řádku „12 hodin práce“, ale zachová tři logické bloky: úvod a dvě úlohy.
- **D6 — `#batchErr`:** zvolena jednodušší varianta: mrtvý prvek i jeho čištění byly odstraněny. Dílčí chyby zůstávají v existujícím souhrnu výsledku a vstupní chyby v `#configErr`.

## Verifikace

- `npm test`: OK
- build: Diferenciátor 1.3.4, 7 JS modulů, `dist/` připraven
- release gate: `CELKEM: vše zelené — release gate OK.`
- interní testy v headless Chromiu: 87/87
- HTML ID: bez duplicity
- manuál: chráněný přístup a návrat do aplikace ověřeny
