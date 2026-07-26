# Korespondenční asistent 5.3.1 — změny po uživatelském testu

## Provedené změny

1. Odstraněn duplicitní blok „Bezpečný postup“ v záhlaví. Čtyřkrokový průběh zůstává pouze v hlavním workflow.
2. Anonymizace a finální náhled jsou vizuálně jeden souvislý pracovní blok. Klíč náhrad je po anonymizaci standardně sbalený.
3. Kontrolní upozornění mají klidnější formulaci a méně dominantní vzhled. Červené blokace zůstávají beze změny.
4. Poznámka pro odpověď se přidává do promptu. Před odesláním prochází `safeAuxiliaryText()`, která použije anonymizační klíč, spustí preflight a při citlivém údaji odeslání zastaví.
5. Doplněn regresní test „Vyřiď Karlovi…“ → `osoba B`.
6. Po výběru jedné ze tří variant se další dvě skrývají i na desktopu; test ověřuje skutečný `display: none`.
7. Patička již neukazuje build ani tip na synonyma. Nabídka má viditelné popisy jednotlivých pracovních nástrojů.
8. Bezpečný začátek, krátká prohlídka a školní návod byly odstraněny z nabídky nástrojů. První spuštění dál používá onboarding a úplná nápověda je v interaktivním manuálu.
9. Vývojářské nástroje jsou skryté v běžném režimu a dostupné jen přes `?dev=1` nebo `?test`.
10. Interaktivní manuál v `src/manual/` byl aktualizován. Manifest AI Studia odkazuje na stejný manuál, takže aplikace i AI Studio používají totožný obsah.
