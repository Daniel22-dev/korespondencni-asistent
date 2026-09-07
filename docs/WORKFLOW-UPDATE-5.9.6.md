# Korespondenční asistent 5.9.6 – dokončení hlášení technické chyby

## Důvod změny

Při spuštění KS uvnitř interního pracovního prostoru AI Studia se příkaz `mailto:` původně provedl ve vloženém `iframe`. Chrome proto místo e-mailového klienta zobrazil blokovanou stránku. Současně se spodní aplikační panel snímání překrýval se systémovým oznámením Chromu o sdílení obrazovky.

## Otevření e-mailu

- Centrální reportér AI Studia je pro KS při startu výslovně vypnut pomocí `errorReporter: false`.
- KS načte lokální, verzovanou kopii reportéru `src/access/error-reporter-ks.js`.
- Vložená aplikace otevírá odkaz `mailto:` přes horní dokument AI Studia, nikoli ve vlastním rámci.
- Příjemce se načítá z `AI-Studio-GHRAB/config/support.json`; bezpečný fallback je `balaz@ghrabuvka.cz`.
- Po stažení ZIP zůstane v dialogu možnost **Otevřít e-mail znovu** a **Zkopírovat údaje e-mailu**.
- Konkrétní screenshoty se nepřipojují automaticky. První snímek lze vložit ze schránky a ZIP je nutné přiložit podle pokynu v e-mailu.

## Panel snímání

Plovoucí panel je nově:

- kompaktní dvousloupcový blok;
- ukotvený vpravo;
- odsazený od horní hrany, aby byl pod systémovým oznámením Chromu;
- na úzké obrazovce roztažený mezi levý a pravý okraj se zachovaným horním odstupem.

Panel stále poskytuje akce **Pořídit snímek**, **Zpět k hlášení** a **Ukončit snímání** a uchovává až pět snímků bez ztráty rozepsaného formuláře.

## Distribuce

Lokální reportér je součástí zdrojového i sestaveného balíčku a service worker jej zahrnuje mezi aplikační soubory. Po praktickém ověření v KS lze stejnou změnu převést do centrálního reportéru AI Studia a následně odstranit app-specifickou kopii.
