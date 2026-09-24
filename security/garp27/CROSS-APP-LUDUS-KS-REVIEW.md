# GARP 2.7 — cross-app review: LUDUS × Korespondenční asistent

Datum: 2026-09-23

## Společné invarianty po druhé migraci

- GARP 2.7 je jediná aktivní bezpečnostní autorita; starší GARP vrstvy zůstávají regresními důkazy.
- Serverová fáze je odložena a nesmí být převáděna na LIVE PASS.
- `liveServerValidationRequired=true` je fail-closed podmínka pro budoucí serverovou validaci.
- Architecture-integrity je samostatná admission brána a používá capability inventory, policy binding, production artifact inspection a single-authority kontrolu.
- CI/release cesta je nastavena na Node 24.
- Mutation testy musí prokazovat, že změna pravidel, checkeru nebo capability není silent PASS.

## Rozdíly, které musí zůstat aplikační

Korespondenční asistent je PWA s D2 školní korespondencí, osmi textovými AI operacemi, standalone `direct-gemini` profilem, budoucím `school-gateway` profilem, service workerem, lokálními importy a Safe Promotion / exact-release-identity cestou. Tyto vlastnosti nejsou přenášeny do sdíleného GARP masteru jako univerzální předpoklady.

LUDUS a KS proto sdílejí **kontrakt a typy bran**, nikoli identické capability inventory nebo stejné production-artifact heuristiky.

## Nález druhé aplikace

KS odhalil dvě důležité vlastnosti app-specific architecture gate:

1. prostý regex importů může falešně označit import-like text uvnitř testovacího string literal; checker byl zpřesněn tak, aby posuzoval pouze import v kódové pozici;
2. samotná přítomnost test-hook symbolu v produkčním bundle není automaticky bypass, pokud build prokazatelně kompiluje test hooks do disabled stavu; gate proto kontroluje skutečné povolení/bypass a zároveň explicitně vyžaduje produkční disabled marker.

Tyto změny **nemění canonical GARP 2.7 master**. Zpřesňují pouze adaptér KS a potvrzují, že G27-AR implementace musí respektovat architekturu konkrétní aplikace.

## Výsledek druhé migrace

Na úrovni dostupné FOUNDATION evidence nebyl nalezen důvod měnit společný GARP 2.7 kontrakt. KS může sloužit jako druhý referenční migrační vzor vedle LUDUS, ale school-server/LIVE tvrzení zůstává samostatně neověřené.

## Dodatek 2026-09-24 — r2 / G-02

GARP 2.7 r2 zpřísňuje policy admission, nikoli cross-app runtime rozhraní. Tento dokument proto zůstává použitelný pro architektonické porovnání LUDUS × Korespondenční asistent, ale každý z obou repozitářů musí samostatně projít r2 inventory/semver/semantic/placeholder admission a mít vlastní aktualizovaný trust anchor.
