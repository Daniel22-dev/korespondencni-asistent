# Korespondenční asistent — GARP 2.7 migration report

**Datum uzavření:** 2026-09-23  
**Aplikace:** `ghrab-korespondencni-asistent` / `correspondence`  
**Výchozí verze aplikace:** 5.10.27  
**Výsledná verze aplikace:** 5.10.28  
**Aktivní bezpečnostní autorita:** GARP 2.7  
**Legacy regresní baseline:** GARP 2.5.1  
**GHRAB Platform:** 1.1.2  
**AI Core:** 1.0.0

## Výsledek

Migrace aplikační vrstvy na GARP 2.7 je dokončena. Aplikace má jedinou aktivní GARP 2.7 autoritu, lokální capability inventory, architecture policy, trust anchor, kontraktní gate, architektonický gate, mutační testy a foundation gate. GARP 2.5.1 zůstává zachován jako regresní/historická kontrolní vrstva; není druhou aktivní autoritou.

Finální GARP foundation stav je:

- `FOUNDATION_PASS_LIVE_NOT_TESTED`
- serverová fáze: `DEFERRED_BY_OWNER_DECISION`
- LIVE stav: `NOT_TESTED`

Tento stav je záměrný a fail-closed. Serverová implementace, nové endpointy, Docker/Fortinet konfigurace ani školní LIVE validace nebyly v tomto kole prováděny.

## Co bylo integrováno

- konsolidovaný GARP 2.7 r1 je vendored v `vendor/garp-2.7-consolidated-r1/`;
- aktivní aplikační GARP 2.7 konfigurace je v `security/garp27/`;
- explicitní capability inventory eviduje 8 AI operací a odděluje standalone a school-server hranice;
- architecture-integrity gate kontroluje závislosti, produkční artefakt, capability drift, konkurenční GARP autoritu a důvěryhodnost vlastních checkerů;
- trust anchor váže policy, inventory, GARP policy, vendored master i pět aplikačních GARP 2.7 checkerů;
- CI workflow je přepnuto na Node 24 a obsahuje externě připnutý hash GARP 2.7 trust anchoru;
- `liveServerValidationRequired=true` blokuje budoucí falešné LIVE tvrzení bez skutečné serverové validace;
- release metadata identifikují nový release jako GARP 2.7 / `P5-R2+GARP27-FOUNDATION`;
- původní `dist-school-server/` byl po QA obnoven **byte-for-byte z původního uživatelského ZIPu** a zůstává historickým artefaktem verze 5.10.25.

## Finální ověřené testy

| Kontrola | Výsledek |
|---|---:|
| GARP 2.7 package selftest | 15/15 PASS |
| GARP 2.7 contract selftest | 20/20 PASS |
| GARP 2.7 architecture-integrity | 41/41 PASS |
| GARP 2.7 mutation suite | 10/10 PASS |
| GARP 2.7 auto-patch contract | 6/6 PASS |
| GARP 2.7 foundation | 9/9 PASS |
| Legacy GARP 2.5.1 static/regression gate | PASS |
| GHRAB Platform conformance | 139/139 PASS |
| P3 quality gate | 31/31 PASS |
| Browser QA | 19/19 PASS |
| UI interaction regression | 48/48 PASS |
| Secret scan | PASS — 179 souborů, 0 nálezů |
| Canary scan | PASS — 179 souborů, 0 neočekávaných zásahů |
| XSS sink regression inventory | PASS proti stávajícímu baseline |
| `dist-school-server/` vs. původní ZIP | EXACT MATCH |

## Mutační scénáře GARP 2.7

Gate prokazatelně odmítl všech deset připravených negativních scénářů, mimo jiné zakázanou zdrojovou závislost, produkční test bypass, nepovolenou AI operaci, vypnutí povinné LIVE validace, lokální provider key ve školním profilu, self-edit policy/checkeru, drift vendored masteru a konkurenční GARP 2.6 autoritu.

## Důležité limity tohoto lokálního ověření

**Celý `qa:p5` není v tomto sandboxu prohlášen za PASS.** `suite-session` / runtime větev narazila na omezení lokálního Chromium pro navigaci na loopback HTTP server; jde proto o environmentální blokaci, nikoli o úspěšný ani neúspěšný aplikační výsledek.

`npm ci` se v původním lokálním pracovním prostředí nedokončilo v dostupném limitu, takže v tomto lokálním běhu nebyl proveden strict `qa:axe` s repozitářem připnutými npm závislostmi. Následné GitHub CI dne 23. 9. 2026 však na Node 24 úspěšně dokončilo P5 release gate, GARP 2.7 foundation, explicitní legacy GARP 2.5.1/N5 regresi i blocking axe audit. Tento odstavec proto popisuje pouze limit původního lokálního běhu, nikoli současný stav CI.

XSS kontrola je regresní inventář, nikoli důkaz úplné absence XSS. Současný baseline stále obsahuje 99 použití `innerHTML`, 2 použití `insertAdjacentHTML` a CSP architektura stále pracuje s `unsafe-inline`. Migrace GARP 2.7 tento stav nezhoršila, ale samostatný CSP/XSS refactoring by byl další hardening krok.

## Assurance / LIVE význam

Foundation PASS znamená, že lokálně ověřitelné GARP 2.7 kontrakty, architektonické invarianty, capability inventory, mutační odolnost, produkční build a zachované legacy bezpečnostní kontroly prošly. **Neznamená to**, že je ověřen školní server, skutečný school gateway/egress, LIVE watchdog, recovery nebo produkční auto-patch.

Jakmile bude serverová fáze schválena, naváže se na tuto verzi bez přepisování současného foundation výsledku a server-dependent komponenty se ověří samostatně.
