# Korespondenční asistent 5.10.6 — druhé ověření bezpečnostních oprav

Datum: 2026-08-23  
Revize: P5-R8-SECURITY-GARP-SECOND-PASS

## Opravy

- Opraveno rozpoznání českých příjmení na `-ová`, `-ové`, `-ovi` a `-ovou`.
- Neznámá jednoslovná příjmení po hromadném ponechání znovu zastaví odeslání.
- Konkrétní bezpečný jednoslovný výraz lze ponechat pouze jednotlivě; tato volba je oddělena od hromadného stavu.
- Příchozí e-mail používá stejný JSON kódovaný nedůvěryhodný obal při analýze i tvorbě tří odpovědí.
- Hostile corpus se spouští nad oběma promptovými cestami.
- XSS baseline se nezvýšila: 99 `innerHTML`, 2 `insertAdjacentHTML`, ostatní sledované sinky 0.
- Dotčené blokující performance limity byly kvůli nové bezpečnostní logice a testům zvýšeny pouze o 2–4 kB (nejvýše 0,5 %).

## Testy

- 155 interních aplikačních testů;
- 17 testů GHRAB AI Core conformance;
- provider-neutrální profily, platformní kontrakt, performance budget a XSS ratchet;
- standardní a school-server build.

Lokální runner nemá Chromium a jeho síťová politika nedovoluje stažení binárky. Fyzické UI, axe a runtime/reflow testy proto zůstávají povinnou blokující součástí `qa:p5:ci` v GitHub Actions.

## Kompatibilita

- GHRAB Platform 1.1.0 a GHRAB AI Core 1.0.0 beze změny;
- formát uživatelských dat zůstává kompatibilní;
- starý stav návrhu `keep` se bezpečnostně interpretuje jako hromadné ponechání;
- nová PWA cache: `ghrab-correspondence-v5.10.6`.
