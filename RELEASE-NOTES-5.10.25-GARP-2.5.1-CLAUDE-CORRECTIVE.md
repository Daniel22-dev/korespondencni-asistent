# Korespondenční asistent 5.10.25 — GARP 2.5.1 Claude corrective round

Datum: 2026-09-06

## Proč release vznikl

Nezávislá role B nad 5.10.24 potvrdila kryptografickou/inventární vrstvu, ale našla HIGH assurance false negative v GH-02 checkeru a HIGH mezeru v AI assurance baseline. 5.10.25 je cílené opravné kolo Prompt C; nemění uživatelskou AI funkcionalitu ani zamýšlené privacy chování.

## Opravené nálezy

- **N1 / GH-02:** `ghrab/ghrab-platform.js` už není v P3 precache. Jediný source of truth je `security/security-critical-assets.json`; P3 build z něj kritické assety automaticky vylučuje. Checker už není závislý na názvu array proměnné.
- **N2 / AI baseline:** baseline nově zahrnuje `src/js/40-anonymizace.js` a `src/js/50-koncept-a-prompty.js`; obě samostatné mutace zneplatní evidence.
- **N3 / chain of custody:** podepsaný manifest váže provenance, evidence manifest, SBOM a deterministický pre-sign deployment payload ZIP. Release gate tyto vazby ověřuje. Final signed ZIP má externí SHA-256, aby nevznikla hashová sebereference.
- **N4:** reporter shoda je deklarována pouze v rozsahu KS; cross-repo GH-01 zůstává NOT TESTED.
- **N5:** app-guard mimo deployment KS je explicitní externí trust boundary.

## Důležitá korekce evidence

PASS GH-02/GHNC-12 ve verzi 5.10.24 byl **false negative**. Nový checker na nezměněném 5.10.24 vrací FAIL/CRITICAL; čistý 5.10.25 vrací PASS.

## Stav

SHIELD-PREP opravné kolo. SHIELD-LIVE, RI-LIVE, produkční key custody a behaviorální school-server kontroly zůstávají NOT TESTED / AMBER do samostatné serverové fáze. Reálná studentská data se v auditu nepoužívají.
