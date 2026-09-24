# Korespondenční asistent — GARP 2.7

Tato složka je aplikační adaptér pro konsolidovaný **GARP 2.7 r2 / G-02 FIX** z 23. 9. 2026.
Jedinou aktuální bezpečnostní autoritou je GARP 2.7. GARP 2.5.1 zůstává v repozitáři jako povinný regresní základ; historické důkazy se nepřepisují ani nepřejmenovávají.

Normativní konsolidovaný balík je bitově převzatý ve `vendor/garp-2.7-consolidated-r2/` a jeho strom je připnut v `trust-anchor.json`. Aplikační kód tento balík neimportuje do produkčního runtime; používají jej pouze build/verification nástroje.

R2 uzavírá technický nález G-02 v policy admission: `appId` musí být v důvěryhodném inventáři, produkční `0.0.0` a neplatný semver jsou odmítnuty, povinné sekce musejí obsahovat rozpoznanou sémantiku a placeholdery včetně `explicit-app-policy` nesmějí projít.

## Lokální a CI brány

- `npm run qa:garp27:contracts` — r2 package/contract selftest, kontrola trusted `checkDigest`, G-02 reference selftest, policy admission a deferred LIVE status;
- `npm run qa:garp27:architecture` — dependency/artifact/capability/trust/single-authority integrita včetně r2 core + ecosystem inventory;
- `npm run qa:garp27:policy-mutations` — aplikační pozitivní a negativní G-02 mutation scénáře;
- `npm run qa:garp27:mutations` — architektonické mutation scénáře G27-AR;
- `npm run qa:garp27:auto-patch` — GARP 2.7 state/gate admission test nad syntetickou exact-release identitou;
- `npm run qa:garp27:foundation` — kumulativní FOUNDATION gate včetně legacy GARP 2.5.1 regresí.

V chráněném CI musí architecture gate navíc dostat přesný SHA-256 `security/garp27/trust-anchor.json` v `GARP27_EXTERNAL_TRUST_SHA256`. Změna trust anchoru proto nemůže sama sebe schválit bez současné explicitní změny chráněného CI pinu.

## Serverová hranice

Příprava školního serveru je stále `DEFERRED_BY_OWNER_DECISION`. Tato re-baseline nevytváří nové endpointy, Docker/Fortinet konfiguraci ani LIVE tvrzení. `security/garp27/live-status.json` proto zůstává `NOT_TESTED`.
