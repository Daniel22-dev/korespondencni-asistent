# Korespondenční asistent 5.9.20 — UI hotfix

Datum: 9. 8. 2026

## Opravený problém

Po velké platformní aktualizaci mohla aplikace při prvním startu vytvořit automatickou onboarding vrstvu `.guide-overlay` přes celý viewport. Vrstva měla vyšší `z-index` než aplikace a zachytávala kliknutí dříve než tlačítka pod ní. Uživatelsky to vypadalo jako nefunkční denní/noční režim, fullscreen a hlavní volby pracovního postupu.

Současně release testy tento typ regresu nedokázaly spolehlivě zachytit: hlavní projektový test měnil chráněný skript na běžný JavaScript a runtime audit odstraňoval přístupový bootstrap. Kontrolovaly se funkce a DOM, ne skutečný hit target fyzického kliknutí po produkčním odemčení.

## Oprava

- automatická onboarding prohlídka byla odstraněna ze startovací kritické cesty;
- prohlídka zůstává dostupná ručně v nabídce Další možnosti;
- zavření prohlídky přes Escape nebo kliknutí na pozadí se považuje za vědomé zavření a uloží stav „viděno“;
- základní shell ovládání se váže idempotentně už v rané UI vrstvě;
- produkční bootstrap ověřuje, že skutečně odemkl alespoň jeden chráněný skript a že aplikace dosáhla plného ready stavu;
- přidán samostatný regresní Chromium test se skutečným GHRAB Platform unlockem a fyzickými kliknutími.

## Regresní pokrytí

Nový test ověřuje:

1. přítomnost chráněného skriptu před odemčením;
2. skutečný `GHRAB_PLATFORM.unlockProtectedScripts()`;
3. plný `ksShellReady` + `ksAppReady` start;
4. nepřítomnost automatické blokující onboarding vrstvy;
5. kliknutí na denní/noční režim a skutečnou změnu motivu;
6. kliknutí na fullscreen a vyvolání fullscreen API;
7. kliknutí na Analýzu příchozího e-mailu;
8. návrat na úvodní obrazovku;
9. kliknutí na Sestavení vlastního e-mailu;
10. dostupnost prohlídky jako ručně vyvolané pomoci;
11. nulové runtime chyby.

## Rozsah

AI Core 1.0.0, modelové prompty, anonymizace, Gemini transporty a serverová architektura nebyly změněny. Jde o UI/bootstrap hotfix a zpřísnění regresního testování.
