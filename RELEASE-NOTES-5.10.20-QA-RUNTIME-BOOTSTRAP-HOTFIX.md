# Korespondenční asistent 5.10.20 — QA runtime bootstrap hotfix

## Kontext

GitHub Actions běhy `91911707721`, `91911707726`, `91911707763` a `91911707866` nad 5.10.19 shodně ukázaly, že suite-session Browser Back/Forward oprava už prochází. Release gate se následně dostal až k `qa:runtime`, kde skončil `status: failed` s `initFailures: 3`, bez accessibility nálezů, overflow, browser exceptions nebo QA errors.

## Root cause

`qa-p5-runtime.mjs` při transformaci auditovaného HTML měnil `type="application/ghrab-protected"` na `text/javascript` a odstranil `data-ghrab-protected`. Na hlavní stránce tak celý aplikační bundle včetně `78-suite-session.js` běžel během parsování dokumentu, zatímco `ghrab-platform.js` je načítán `defer`. Suite-session modul proto právem nenalezl Platform 1.1.2, aktivoval fail-closed stav `blocked` a body zůstalo skryté. Tři init failures odpovídají hlavní stránce ve třech auditovaných šířkách 1280/390/320 px. Manuál nebyl tímto platformním lifecycle závislý stejným způsobem.

Nejde o důvod oslabit fail-closed chování aplikace. Chybný byl auditní bootstrap, který nereprezentoval produkční pořadí.

## Oprava

- `qa-p5-runtime.mjs` ponechává `application/ghrab-protected` inertní.
- Po dokončení navigace čeká na `GHRAB_PLATFORM.unlockProtectedScripts`.
- Chráněný aplikační kód odemyká výhradně skutečnou Platformou a ověřuje počet skriptů před/po unlocku.
- Report ukládá informace o platformní verzi a počtu odemčených protected skriptů.
- Stejný bootstrap model používá `qa-p5-axe-runtime.mjs`.
- Oba harnessy mají sentinel, který odmítne budoucí regresi zpět k eager execution.

## Bezpečnostní dopad

Produkční `78-suite-session.js`, cleanup, ACK pořadí, storage ownership ani Platforma 1.1.2 nebyly změněny. Fail-closed chování zůstává zachováno. Změna odstraňuje falešný QA bootstrap a současně zvyšuje věrnost runtime/Axe auditu vůči produkčnímu lifecycle.

## Release status

Kandidát není automaticky GREEN. Navigované HTTP testy je nutné znovu potvrdit v GitHub Actions. E-01/F-02/F-03 zůstávají řízeny původní ecosystem release policy.
