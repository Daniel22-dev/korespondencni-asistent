# Korespondenční asistent 5.10.24 – GARP 2.5.1 SHIELD-PREP

Datum: 2026-09-06

Tento release je kumulativní migrace z poslední autoritativní GARP 2.3 baseline přes mezistav GARP 2.4 RI-PREP na GARP 2.5.1 SHIELD-PREP kandidáta.

## Funkční dopad

Uživatelské AI workflow, prompt assembly, anonymizační pravidla a storage ownership nejsou v této verzi funkčně měněny. Jediná distribuovaná bezpečnostní změna je hardening service workeru: runtime/deployment konfigurace, GHRAB platform runtime a release-integrity artefakty jsou obsluhovány network-only s `cache: no-store`, aby cache nemohla zmrazit revokaci nebo integrity stav.

## Supply chain / evidence

- GARP 2.5.1 RI schema v2 a trust-root/registry verifier;
- SHIELD threat model, attack surface, exception register, deployment security a AI resource budget;
- CycloneDX 1.7 SBOM z exact package-lock;
- reproducibilní auditní build metadata přes `GHRAB_BUILD_TIME`;
- build provenance, evidence manifest, SW/vendored consistency a negative controls;
- disposable Ed25519 PREP keypair: soukromý klíč se do kandidáta nedostává.

## Důležitá omezení

SHIELD-PREP není SHIELD-LIVE. Skutečný school server, served headers/HSTS, behaviorální revocation, production key custody, serverové rate/token/cost limity, provider retention governance a live-model AI-RED musí být ověřeny až v odpovídající LIVE fázi.
