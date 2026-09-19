# Korespondenční asistent 5.10.27 — Safe Promotion + exact release identity

Datum: 2026-09-18

## Rozsah

Tento patch mění release/governance vrstvu, nikoli uživatelskou AI logiku, anonymizaci, prompt assembly nebo UI/UX aplikace.

## Co se mění

- dlouhodobá vstupní větev `candidate`;
- P5 release gate běží na `candidate`, na PR do `main` i na výsledném `main`;
- kumulativní GARP 2.5.1 a N5 kontroly jsou povinnou součástí P5 release cesty;
- automatizovaný `candidate -> main` PR a merge až po GREEN required checks;
- deploy pouze z úspěšného P5 běhu konkrétního commitu v chráněném `main`;
- deploy fail-closed ověřuje původ z merged `candidate -> main` PR a aktivní GitHub governance;
- veřejný Pages artefakt nese `release-integrity.json`, CycloneDX SBOM, build provenance a security evidence manifest;
- release identity svazuje `appId + version + source commit SHA + artifact digest` a SHA-256 manifestu, SBOM, provenance a evidence;
- assurance zůstává přesně označena `TRANSITIONAL`; veřejný Pages release není vydáván za produkčně podepsaný artefakt;
- po deployi proběhne bounded live ověření publikovaného `release-integrity.json` a `studio-manifest.json`;
- `app-updated` se odešle až po úspěšném live ověření a nese release identity metadata pro centrální AI Studio gate.

## N5

Permanentní negativní regrese musí blokovat:

- privátní JWK s parametrem `d`;
- encrypted private-key PEM;
- private PGP key block.

## Stav

Lokální strukturální/GARP/release-chain ověření používá pouze syntetická data. Finální LIVE status vzniká až nad konkrétním GitHub commitem a konkrétními GREEN workflow runy; historické GREEN reporty se za aktuální důkaz nepovažují.

## Závěrečný clean-up / audit — 2026-09-19

- odstraněny duplicitní legacy workflow `p3-quality.yml` a `p4-release.yml`; autoritativní release gate zůstává `p5-release-gate.yml`;
- generovaný `test-results/` byl vyřazen z verzování a přidán do `.gitignore`;
- README a CHANGELOG byly srovnány s reálnou verzí 5.10.27 a LIVE Safe Promotion stavem;
- `dist-school-server/` je výslovně veden jako frozen 5.10.25 school-server artefakt, nikoli jako aktuální Pages build;
- E2E nalezená race condition Pages deploy concurrency byla opravena branch-isolated group;
- žádná z těchto clean-up změn nemění uživatelskou AI logiku, anonymizaci, prompt assembly ani UI/UX.

Aktuální empirický stav se dokládá konkrétními GitHub Actions runy a LIVE release identity; historické GREEN soubory v repozitáři se za současný důkaz nepovažují.
