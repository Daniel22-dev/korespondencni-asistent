# Audit reportéru chyb – Diferenciátor 1.3.7

Etapa P1 zachovává kanonický GHRAB Error Reporter 1.1.0 z P0. Adaptér je nadále načítán best-effort mimo kritickou cestu startu, používá deployment-aware centrální návod a ve stránce může existovat právě jedna instance reportéru.

Statická regresní sada pro verzi 1.3.7 ověřuje zejména limit pěti snímků, bezpečné zkrácení finální Gmail URL, focus trap, obnovu fokusu, regeneraci reportId, sanitizaci citlivých údajů a cache pravidla service workeru. Browserovou část je nutné dokončit v CI bez spravované politiky Chromium `URLBlocklist`.
