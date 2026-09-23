# Korespondenční asistent — GARP 2.7 migration assessment

Datum: 2026-09-23  
Aplikace: `correspondence` / Korespondenční asistent 5.10.28  
Vstupní aplikace SHA-256: `d11923e625e989aed6079b446beffa446618078cf70ff80afebd7a0cf81fdb8f`  
GARP 2.7 balík SHA-256: `f54e5b5c271ff05c5a4d4cf85882ba972b9a78945724bb60a369432e984803d4`

## A-01 až A-07

| Nález | Stav pro konsolidovaný master | Ověření v KS |
|---|---|---|
| A-01 ASSURANCE nesmí přijmout PASS s chybějící/selhanou povinnou komponentou | ACCEPT | master contract selftest + app-specific `qa:garp27:foundation`; assurance admission PASS pouze z trusted evidence |
| A-02 AUTO-PATCH nesmí přijmout COMMITTED bez bran | ACCEPT | `qa:garp27:auto-patch`; negativní empty-gates scénář správně odmítnut |
| A-03 AUTO-PATCH musí ověřovat pravdivost PASS/evidence/zdroje/cíle | ACCEPT | master contract selftest + app auto-patch trust/evidence kontrakt |
| A-04 schémata a validátory musí být konzistentní | ACCEPT | canonical package selftest 15/15 + contract selftest 20/20 + app policy validation |
| A-05 aktivní master musí být skutečně 2.7 | ACCEPT | `garpVersion=2.7`, single-authority check; 2.5.1 je pouze legacy regression baseline |
| A-06 podmínky produkčních testů musí být strojově vyjádřené | ACCEPT | LIVE validator vrací při odloženém serveru očekávané `NOT_TESTED` a blokuje false PASS |
| A-07 selftest nesmí vydávat užší kontrolu za širší důkaz | ACCEPT | canonical selftest classification + app gate odděluje PACKAGE/CONTRACT/FOUNDATION/LIVE |

## G27-AR01 až G27-AR05

- **G27-AR01 — dependency integrity:** kontrola relativních importů, unresolved importů a forbidden edges. Implementace ignoruje import-like text uvnitř string literalů, aby nevznikal falešný nález z testovacích needle řetězců.
- **G27-AR02 — production artifact integrity:** kontrola zakázaných produkčních cest, test bypassů, private-key markerů a explicitní důkaz, že produkční build kompiluje `TEST_HOOKS_BUILD_ENABLED` do vypnutého stavu.
- **G27-AR03 — capability delta:** přesná shoda osmi AI operací, žádné agentic/tool capabilities, explicitní standalone/school egress a zákaz local provider key ve school profilu.
- **G27-AR04 — trusted gate:** policy, inventory, GARP policy, vendored master i pět app-specific GARP 2.7 toolů jsou svázány SHA-256 trust anchorem; CI vyžaduje externí pin trust anchoru.
- **G27-AR05 — single authority:** aktivní `security/garp27` nesmí obsahovat konkurenční GARP 2.5/2.6 autoritu; drift vendored masteru je fail.

## Mutation evidence

10/10 syntetických mutací dopadlo očekávaně: positive baseline PASS a devět bezpečnostních mutací FAIL. Pokryty jsou forbidden dependency, production test bypass, nepovolená AI operace, vypnutá LIVE validace, school local-key bypass, policy self-edit, checker self-edit, master drift a konkurenční 2.6 autorita.

## Serverová fáze

Server se v tomto kole nepřipravuje. `liveServerValidationRequired=true`; school session/gateway, provider egress za serverovou hranicí, upload quarantine, watchdog, recovery a live runtime evidence zůstávají `DEFERRED_BY_OWNER_DECISION` / `NOT_TESTED`. To neblokuje FOUNDATION PASS, ale blokuje tvrzení o school LIVE PASS.
