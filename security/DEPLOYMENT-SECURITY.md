# KS 5.10.25 – požadavky na school-server deployment

Tento dokument je **PREP design**, nikoli důkaz živého serveru.

## Proces a soubory
- aplikaci servírovat z dedikovaného read-only deployment adresáře;
- proces/gateway provozovat pod neprivilegovanou service identity, bez shellu a bez write oprávnění do web rootu;
- private signing key nesmí být na web serveru ani v aplikačním ZIPu;
- trust root a Release Registry spravovat odděleně od běžného buildu;
- deploy přijmout jen po `release-gate.mjs`, RI verifikaci, anti-rollback a mixed-version kontrole.

## Síť a TLS
- pouze HTTPS; HSTS ověřit na served response;
- aplikace smí volat same-origin school gateway; provider egress povolit jen gateway službě;
- gateway provider/model allowlist je serverová politika, ne klientský parametr;
- CORS/default-deny pro cizí originy.

## Auth / session
- school profil: `server-session`;
- server musí vynutit revokaci/expiry nezávisle na klientovi;
- odebrání přístupu musí být behaviorálně ověřeno na již otevřené kartě;
- appId/audience se nesmí zaměnit mezi child aplikacemi.

## Secrets
- OpenAI/provider credentials pouze v serverovém secret store / environmentu s minimálním scope;
- nikdy do HTML, runtime configu, localStorage, logů, evidence ani error reporteru;
- rotace a incidentní revokace musí být popsány v provozním runbooku.

## Server hardening
- read-only filesystem pro aplikaci, dočasný zápis jen do explicitního temp prostoru;
- non-root, minimální OS capabilities;
- rozumné memory/CPU/request limity;
- rate-limit per user/session + globální circuit breaker;
- request-size a output/token stropy z AI resource budgetu;
- timeout/cancel; retry pouze omezeně a idempotentně;
- structured logging bez promptu/odpovědi/student PII;
- záloha Release Registry/trust root a kontrolovaný recovery postup.

## HTTP security headers
Před LIVE ověřit skutečnou odpověď: CSP bez `unsafe-inline` nebo schválená nonce/hash migrace, HSTS, `X-Content-Type-Options: nosniff`, frame policy odpovídající řízenému Studio embeddingu, Referrer-Policy a vhodné Cache-Control pro security-critical soubory.

## Fail-closed
Nedostupný trust root, neplatný podpis, rollback, mixed release, neznámý keyId, revoked key, neplatná session nebo nesoulad appId => aplikace nesmí pokračovat v privilegovaném school režimu.

## LIVE status
Server enforcement: **NOT TESTED**.  
SHIELD-LIVE: **DEFERRED** do skutečného školního serveru.

## Deployment handoff pro školní IT – tooling R3
Pro nezávislé spuštění GARP release gate nestačí samotný webový deployment ZIP. Spolu s deploymentem se jako **verifikační metadata mimo web root** předává také přesný `security/security-critical-assets.json` příslušný k danému release.

Doporučené spuštění na straně příjemce používá explicitní cestu:

```text
node release-gate.mjs ... --deploy <rozbaleny-deployment> --critical-list <verification-metadata>/security-critical-assets.json
```

Pokud seznam není dostupný nebo čitelný, gate musí skončit **RED / critical-asset-list-missing**. Fallback odvozený z repo layoutu je pouze pohodlí při kontrole uvnitř zdrojového stromu; při předání samostatného deploymentu se na něj nesmí spoléhat. `security-critical-assets.json` neobsahuje secret ani private signing key.


## Tooling R4 – assurance-link gate inputs
Pokud `release-integrity.json` obsahuje nenulove `sourcePackageSha256`, `deploymentPackageSha256`, `buildProvenanceSha256`, `sbomSha256` nebo `evidenceManifestSha256`, release gate je fail-closed a musi dostat odpovidajici soubory (`--source-package`, `--deployment-package`, `--provenance`, `--sbom`, `--evidence-manifest`). Chybejici `verify-assurance-links.mjs` nebo chybejici deklarovany vstup znamena RED.

Reproducibility tvrzeni se vztahuje na frozen `dist-school-server`. Obecny `dist/` obsahuje quality metadata s wall-clock `metrics.measuredAt` a neni deklarovan jako byte-reproducible napric rebuildy.
