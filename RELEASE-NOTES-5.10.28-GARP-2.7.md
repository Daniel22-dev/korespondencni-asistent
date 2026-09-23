# Korespondenční asistent 5.10.28 — GARP 2.7

Datum migrace: 2026-09-23

## Rozsah

Tento release migruje aplikaci z aktivní GARP 2.5.1 autority na konsolidovaný **GARP 2.7**. GARP 2.5.1/N5/P5/Safe Promotion zůstávají jako regresní ochrany. Uživatelská AI logika, anonymizace a prompt assembly se nemění.

## Nové GARP 2.7 vrstvy

- kanonický vendored GARP 2.7 master a jeho selftesty/contract testy,
- `security/garp27/garp-policy.json`, capability inventory a architecture policy,
- architecture-integrity gate: dependency boundaries, production artifact inspection, capability delta, trust binding a single-authority kontrola,
- mutation tests pro G27-AR01 až AR05 třídu selhání,
- GARP 2.7 auto-patch state-machine kontrakt s negativními scénáři,
- fail-closed LIVE status a foundation assurance evidence.

## Serverová fáze

Serverová implementace není součástí tohoto releasu. `liveServerValidationRequired=true` znamená, že odloženou školní-server fázi nelze vydávat za LIVE PASS. School session/gateway, server egress, upload quarantine, watchdog a live recovery zůstávají `DEFERRED_BY_OWNER_DECISION` / `NOT_TESTED`.

## Historický school-server artefakt

`dist-school-server/` zůstává frozen na 5.10.25 a nesmí být při této migraci mechanicky přepsán.
