# Korespondenční asistent 5.5.4 — bezpečná práce s údaji v manuálu

## Důvod změny

Ve zdrojovém kódu zůstávala nepřístupná funkce `openSchoolGuide()`. Z uživatelského rozhraní ji nebylo možné otevřít, takže představovala mrtvý kód a její obsah nebyl pro běžného učitele dostupný.

## Provedené změny

- funkce `openSchoolGuide()` byla odstraněna;
- obsah nebyl přidán jako další položka do Nástrojů, aby se neduplikoval hlavní manuál;
- interaktivní manuál obsahuje rozšířenou kapitolu **Bezpečná práce s údaji**;
- kapitola pokrývá anonymizaci, údaje nevhodné pro AI, bezpečný pracovní tok, sdílené počítače a situace, které je vhodné řešit bez AI;
- přidány byly konkrétní příklady nevhodného a bezpečně zobecněného zadání;
- manuál byl povýšen na 1.1.3 a aplikace na 5.5.4;
- release test kontroluje, že stará funkce v kódu nezůstala a že nová kapitola v manuálu existuje.

## Architektonické rozhodnutí

Bezpečnostní příručka patří do interaktivního manuálu, protože jde o trvalé metodické vysvětlení, nikoli o pracovní nástroj nebo samostatnou funkci aplikace. Kontextové bezpečnostní pokyny a blokace zůstávají přímo v pracovním toku.
