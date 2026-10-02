# Korespondenční asistent 5.10.34 — GARP 2.8 workflow hardening

Datum: 2026-10-02

## Důvod vydání

Audit GARP 2.8 zjistil, že původní `sync-ghrab-ai-core.yml` držel `contents: write` a `pull-requests: write` po celou dobu jediného jobu. Ve stejném jobu probíhal checkout s uloženými credentials, `npm ci`, synchronizace Core a `npm test`. Tím byl instalační a testovaný kód zbytečně vystaven write tokenu.

## Změna architektury workflow

- top-level oprávnění jsou pouze `contents: read`;
- `verify-core` má pouze `contents: read`, checkout používá `persist-credentials: false`;
- dispatch payload zůstává validován přes hodnoty předané do `env`;
- instalace používá `npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org`;
- Chromium pro testy se instaluje až v read-only jobu;
- synchronizace a `npm test` běží pouze v `verify-core`;
- ověřený diff povolených Core souborů se nahraje jako artifact přes akci připnutou na celé SHA;
- `publish` je jediný job s `contents: write` a `pull-requests: write`; stáhne artifact, provede `git apply --check`, aplikuje patch, vytvoří novou větev a draft PR;
- `publish` neprovádí `npm ci`, nespouští testy ani synchronizační skript a nepushuje přímo do `main`.

## Pinning a závislosti

Existující SHA piny `actions/checkout`, `actions/setup-node` a `actions/upload-artifact` nebyly změněny. Pro nový krok stažení artefaktu je použito `actions/download-artifact` připnuté na celé SHA podle již ověřeného vzoru v LUDUS. Nebyla přidána žádná npm závislost.

## GARP 2.7 trust anchor

`security/garp27/trust-anchor.json` neobsahoval samostatný SHA-256 otisk `sync-ghrab-ai-core.yml`. Kvůli PATCH zvýšení release identity na 5.10.34 se však mění `appVersion` a hashe verzovaných GARP policy/inventory souborů; proto je trust anchor rebasován standardním postupem a CI external-trust pin musí odpovídat jeho novému SHA-256.

## Nezměněné části

Funkční runtime Korespondenčního asistenta, UI/UX, GHRAB Platform 1.1.2, AI prompty, AI operace, anonymizace a provider/model logika nejsou tímto patchem měněny. Změny ve zdrojových souborech aplikace se týkají pouze konzistentní release identity 5.10.34 a changelogu.
