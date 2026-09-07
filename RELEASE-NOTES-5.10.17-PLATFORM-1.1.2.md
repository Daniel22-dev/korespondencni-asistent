# Korespondenční asistent 5.10.17 – GHRAB Platform 1.1.2

Datum kandidáta: 2026-09-04

## Změny

- přesná vendor vrstva GHRAB Platform 1.1.2 z referenčního AI Studia 0.21.40;
- consumer range `>=1.1.2 <2.0.0` a aktualizované platform/build/QA metadata;
- integrace `ghrab-suite-session-v1` přes `GHRAB_PLATFORM.session.onEnd(...)`;
- ownership-aware cleanup vlastních `localStorage`/`sessionStorage` dat, credentials, prompt/debug, recovery backupů a vlastních položek sdíleného Studio handoff/event storage;
- zachování suite/migration tombstones, statických PWA cache a neosobních manuálových preferencí;
- acknowledgement až po ověřeném cleanupu, samostatné received/cleanup/tab-seen markery;
- per-tab guards pro replay, multi-tab a návrat stránky a write lock proti stale autosave;
- fail-closed při chybě storage;
- PC-01 revize a oprava `src/config/data-manifest.json`;
- bridge preflight, aby child aplikace nesmazala cizí shared handoff;
- nové suite-session QA: browserový harness pro CI a deterministická multi-context simulace s povinným negative control.

## Stav release

Toto je kandidát pro koordinovanou Platform 1.1.2 ecosystem release wave. Není tím uzavřen ekosystémový nález E-01. F-02 (app-wide ACK versus všechny taby) a F-03 (same-origin trust boundary) zůstávají ekosystémovými follow-upy.
