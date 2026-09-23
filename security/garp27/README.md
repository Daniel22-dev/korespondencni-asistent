# Korespondenční asistent — GARP 2.7

Tato složka je aplikační adaptér pro konsolidovaný GARP 2.7 r1 z 23. 9. 2026.
Jedinou aktuální bezpečnostní autoritou je GARP 2.7. GARP 2.5.1 zůstává v repozitáři jako povinný regresní základ; historické důkazy se nepřepisují ani nepřejmenovávají.

Aktivní příprava školního serveru je rozhodnutím vlastníka odložena. Proto lokální a CI kontroly zůstávají aktivní, ale `live-status.json` je `NOT_TESTED` a žádný lokální výsledek nesmí být vydáván za SHIELD-LIVE/RI-LIVE nebo školní produkční certifikaci.

Normativní konsolidovaný balík je bitově převzatý ve `vendor/garp-2.7-consolidated-r1/` a jeho strom je připnut v `trust-anchor.json`. Aplikační kód tento balík neimportuje do produkčního runtime; používají jej pouze build/verification nástroje.

Hlavní brány:
- `npm run qa:garp27:contracts` — konsolidovaný package/contract selftest, policy a pravdivý LIVE=NOT_TESTED;
- `npm run qa:garp27:architecture` — G27-AR01..AR05 implementační brána nad skutečným zdrojem a produkčním `dist/`;
- `npm run qa:garp27:mutations` — disposable negativní mutation kontroly;
- `npm run qa:garp27:auto-patch` — GARP 2.7 state/gate admission test nad syntetickou exact-release identitou;
- `npm run qa:garp27:foundation` — kumulativní evidence včetně legacy GARP 2.5.1 regresí a assurance agregace.

Bez reálných studentských dat. Auditní vstupy a mutace jsou syntetické.
