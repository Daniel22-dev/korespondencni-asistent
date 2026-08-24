# Korespondenční asistent 5.10.8 — oprava po reálném testování

Datum: 2026-08-24  
Revize: P5-R10-USER-TESTING-HOTFIX

## Opravené chování

- Anonymizovaný e-mail s větou začínající slovem `Částka` už není zastaven jako možný únik osobního jména.
- Skutečná jména na začátku věty, například `Nguyen`, `Halama`, `Svobodou` a `Nováková`, zůstávají nadále blokovaná.
- Interní test úvodní obrazovky je nezávislý na tom, zda jej správce spustí z úvodu nebo z otevřené pracovní plochy.
- Interní test rozpracované relace je nezávislý na dříve aktivovaném přísném režimu a při chybě vrací srozumitelný výsledek místo pádu na `undefined.real`.
- Stav potlačení dočasného ukládání se po testech vrátí do původní podoby.

## Regrese

Přibyl test s anonymizovaným pracovním e-mailem o odměnách. Ověřuje, že slovo `Částka` není jmenný kandidát a že stejný text projde finální odesílací kontrolou. Interní sada má 159 testů.
