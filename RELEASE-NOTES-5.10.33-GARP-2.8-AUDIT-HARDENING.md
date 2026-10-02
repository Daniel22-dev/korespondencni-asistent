# Korespondenční asistent 5.10.33 — GARP 2.8 audit hardening

Datum: 2026-10-02

## Změny

- přidán `src/frame-guard.js` přesně podle auditu S-BRW-12;
- `index.html` i `manual/index.html` načítají frame guard jako první klasický skript hned za CSP, s verzovaným query parametrem `?v=5.10.33`;
- service worker předukládá verzovanou kopii frame guardu;
- `sanitizeTechnicalText()` nově odstraňuje holé klíče Google ve tvaru `AIza…` a hodnoty URL parametrů `key`, `api_key` a `apikey`;
- regresní test ověřuje, že testovací klíč sestavený až za běhu a hodnota `?key=XYZ` se neobjeví ve výsledné diagnostice ani Gmail odkazu;
- regresní test zároveň ověřuje, že Gmail koncept automaticky nepřebírá text zpracovávaného e-mailu ani anonymizační mapu.
- GARP 2.7 trust anchor a externí CI trust pin jsou re-baselined na 5.10.33; připnuté SHA GitHub Actions zůstávají beze změny.

## Záměrně beze změny

- vzhled, texty a běžné uživatelské workflow;
- `ghrab/ghrab-platform.js` a přístupová brána AI Studia;
- prompty, provider/model, AI operace a anonymizační logika;
- připnuté SHA GitHub Actions a závislosti.

## Bezpečnostní dopad

Patch doplňuje klientskou ochranu proti clickjackingu pro statický GitHub Pages profil a rozšiřuje redakci technické diagnostiky. Same-origin vložení z AI Studia zůstává povoleno. Aktivní bezpečnostní autorita repozitáře zůstává GARP 2.7; změny jsou implementací zjištění auditu GARP 2.8, nikoli migrací celého repozitáře na GARP 2.8.
