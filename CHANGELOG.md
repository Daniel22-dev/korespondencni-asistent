## 5.9.20 — UI hotfix + CI stabilizace (2026-08-09)

- odstraněno automatické onboarding překrytí, které mohlo zachytit první kliknutí nad aplikací;
- kritické shell ovládání se váže v rané vrstvě a bootstrap ověřuje plný ready stav;
- přidán regresní Chromium test se skutečným GHRAB Platform unlockem a fyzickými kliknutími;
- CI test nyní odolně čeká na CDP `page` target a v případě potřeby jej vytvoří přes `Target.createTarget`;
- sjednocena release metadata 5.9.20 v README a changelogu.

## 5.9.19 — P5 (2026-08-05)


## 5.9.19 — P5 R2

- P5 R2 runtime audit se skripty a odemčeným UI.
- Reprodukovatelné deklarované QA závislosti a blokující exact axe v CI.


- Předprodukční akceptace bez povinného školního serveru.
- Nulové otevřené automatické a11y nálezy jsou podmínkou P5 brány.
- Přidán aktualizovaný release-acceptance kontrakt a odložený GitHub upload.

# Changelog

## 5.9.17 — P4 FINAL (2026-08-04)

- Finální certifikace, čisté buildy, přístupnost, výkon, bezpečnost a release evidence.
- Přidána povinná `qa:p4:ci` brána.

## 5.9.16 - 2026-08-04 (P3)

- Platforma 1.1.0, pristupnost, performance budgety a modularizace P3.

## 5.9.15 — P2: sjednocení platformy GHRAB (2026-08-04)

- jeden kanonický školní logotyp a jednotná autorská patička;
- GHRAB Platform 1.0.0: motiv, storage namespace s vratnou migrací, Studio Bridge 2.0 a artifact envelope v1;
- jednotný název PWA cache `ghrab-correspondence-v5.9.15` a řízená aktualizace;
- platformní konformitní test je součástí buildu a CI.


## 5.9.14 — P1 (2026-08-04)

- Produkční bezpečnost, serverový profil, datové manifesty a jednotná observability vrstva.
- GHRAB AI Core 1.0.0 a přepínání direct-gemini / school-gateway.

# Changelog

## 5.9.13 — 2026-08-04

- Etapa P0: referenční serverová implementace zůstává zachována; aktualizován kanonický reportér 1.1.0 s bezpečnou délkou Gmail URL, focus trapem a správnou identitou nového hlášení.
## 5.9.12 — 2026-08-03

- sjednocen technický reportér s kanonickou implementací AI Studio GHRAB;
- odstraněna paralelní KS implementace a kompatibilitní vrstva;
- doplněny dynamické motivy, řízený koncept, až pět screenshotů, ZIP a nativní Gmail workflow;
- reportér, CSS a aplikační adaptér jsou verzované a cachované service workerem;
- lokální manuál odkazuje na centrální návod a nevytváří druhou instanci.

Podrobnosti starších verzí jsou v `docs/WORKFLOW-UPDATE-*.md`.
