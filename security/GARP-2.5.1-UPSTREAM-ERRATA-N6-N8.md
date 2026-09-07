# GARP 2.5.1 upstream tooling errata – Claude round 2

Datum: 2026-09-06
Aplikace: KS 5.10.25 (runtime beze změny)

Nezávislé kolo 2 potvrdilo, že všech pět aplikačních nálezů z kola 1 je opraveno.
Nové N6–N8 se týkají kontrolních nástrojů GARP 2.5.1:

- N6 HIGH: release gate nepředával autoritativní critical-asset list SW checkeru.
- N7 MEDIUM: checker nepokrýval několik Cache API write forem a neznámou cestu mohl
  tiše považovat za PASS.
- N8 MEDIUM: textová blízkost mohla vytvořit falešnou cache-first výjimku.

Lokální kopie nástrojů v tomto pracovním stromu je synchronizována s ekosystémovým
GARP 2.5.1 tooling hotfix R2. Distribuovaný `dist/` a `dist-school-server/` nebyl kvůli
těmto opravám změněn; app runtime zůstává frozen 5.10.25.

Důkazní požadavky R2:
- checker FAIL na vadném 5.10.24 a PASS na 5.10.25;
- release gate RED na vadném 5.10.24 a PREP GREEN na 5.10.25;
- šest obcházejících Cache API variant nesmí skončit PASS;
- comment-only exemption musí zůstat FAIL;
- chybějící critical-assets list v release gate = RED.
