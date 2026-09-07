# Korespondenční asistent 5.10.5 — bezpečnostní GARP

Datum: 2026-08-23  
Revize: P5-R7-SECURITY-GARP

## Co je opraveno

- Poslední odesílací brána nově blokuje silné kandidáty osobních jmen i tehdy, když byly v anonymizačním UI vědomě ponechány.
- Příchozí e-mail se posílá modelu jako JSON kódovaná nedůvěryhodná datová zóna s explicitním zákazem vykonávat instrukce uvnitř.
- Privacy příznaky v Core requestu se odvozují z úspěšného výsledku preflightu.
- Interní promptové příklady nepoužívají skutečná lidská jména, aby přísná kontrola celého promptu nevytvářela falešné blokace.
- XSS baseline byla snížena z 100 na 99 použití `innerHTML`; nárůst zůstává blokující.
- Celkový `dist` rozpočet byl kvůli nové bezpečnostní bráně zvýšen o 2 kB (0,16 %); všechny ostatní dílčí limity zůstaly stejné.

## Testy

- 154 interních testů včetně nových K1/K2/K4 regresí;
- 17 testů vydané GHRAB AI Core conformance sady;
- 124/124 platformních, 15/15 profilových a 31/31 quality/performance kontrol;
- lockfile audit a XSS baseline bez regrese;
- standardní i school-server build.

Lokální runner bez nainstalované Chromium binárky nemůže provést fyzické UI, axe a reflow kroky. Ty zůstávají povinné v GitHub Actions před produkčním nasazením; nejde o prominutí release brány.

## Kompatibilita

- GHRAB Platform 1.1.0 a GHRAB AI Core 1.0.0 beze změny.
- Direct Gemini i School Gateway používají stejné provider-neutrální profily.
- Formát uložených uživatelských dat se nemění.
- Nová PWA cache: `ghrab-correspondence-v5.10.5`.

## Známý bezpečnostní dluh

CSP stále vyžaduje `unsafe-inline`. Audit neprokázal nový exploitovatelný XSS tok, ale odstranění této výjimky zůstává prioritní samostatnou migrací. Do té doby release gate blokuje nárůst rizikových HTML sinků.
