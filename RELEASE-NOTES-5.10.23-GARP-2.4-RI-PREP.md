# Korespondenční asistent 5.10.23 — GARP 2.4 RI-PREP migrace

Datum: 2026-09-06  
Platforma: GHRAB Platform 1.1.2 (beze změny)  
GARP: 2.4 · Signed Release + Server Integrity

## Účel

Tato verze zavádí pouze release-integrity a source/deployment separation vrstvu GARP 2.4 pro již GARP 2.3 auditovanou aplikaci. Produkční aplikační runtime, AI prompt assembly, auth logika, storage a datové toky nejsou touto migrací záměrně měněny.

## Přidaná RI-PREP vrstva

- `dist-school-server/` zůstává jediným school-server deployment rootem odděleným od source tree.
- Přidán deterministický inventář distribuovaných souborů s velikostí a SHA-256 a `artifactDigest` v `release-integrity.json`.
- Přidán detached Ed25519 signing hook; soukromý signing key není součástí repozitáře, deploymentu ani audit evidence.
- Přidán nezávislý verifier inventory/artifactDigest a detached signature s explicitním `keyId`.
- Přidán deployment leak scan proti `.git`, `.github`, audit/test artefaktům, source mapám, privátním klíčům a základním secret patternům.
- Přidán GARP 2.4 RI-PREP harness s bezpečnými lokálními simulacemi RISIM-01, 02, 04, 05, 06 a 10 v disposable kopiích.
- Testovací Ed25519 klíč je generován pouze do dočasného adresáře; do evidence se ukládá jen veřejná část a explicitní informace, že nejde o produkční trust root.

## RI-LIVE

School-server RI-LIVE není touto verzí deklarován jako PASS. Release Registry, serverová Integrity Service, AI Studio app-guard enforcement, staging rollback/outage testy a externí watchdog zůstávají do existence/napojení školního serveru NOT TESTED podle relevance.

## Key custody

Produkční release signing key není v tomto kandidátu provisionován ani vyžadován. Před skutečným production signed releasem musí být samostatně doložena custody/backup/rotation/revocation attestation bez zveřejnění secretu.

## Bezpečnostní význam

Migrace nepřidává síťový egress, telemetrii ani runtime backdoor. Veškeré nové skripty pracují lokálně nad build artefaktem.
