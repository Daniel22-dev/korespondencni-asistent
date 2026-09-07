# Korespondenční asistent 5.9.9 — definitivní otevření Gmailu

## Příčina chyby

Verze 5.9.8 stále spoléhala na `window.open()`. Chrome může JavaScriptové otevření nového okna zablokovat v PWA, v chráněném aplikačním kontextu nebo při kombinaci s asynchronní tvorbou ZIP. Statický test pouze kontroloval přítomnost volání, nikoli skutečné chování prohlížeče.

## Oprava

- hlavní akce je skutečný HTML odkaz s `target="_blank"`;
- odkaz dostane před kliknutím kompletní Gmail compose URL;
- stejné kliknutí spustí na původní kartě tvorbu a stažení ZIP;
- `window.open()` se v reportéru nepoužívá;
- nejasné přímé sdílení ZIP bylo odstraněno;
- záložní odkazy na Gmail a poštovní aplikaci zůstávají.

## Regresní test

Nový test spustí skutečné Chromium, otevře reportér, vyplní popis, provede fyzické kliknutí pomocí CDP a ověří vznik nové karty `mail.google.com` s příjemcem `balaz@ghrabuvka.cz`.
