# Korespondenční asistent – GARP 2.5.1 threat model

Datum: 2026-09-06  
Verze aplikace: 5.10.25  
appId: `correspondence`  
Třída dat: **D2** – aplikace může zpracovávat text školní korespondence obsahující údaje o žácích. Reálná studentská data nejsou v tomto PREP auditu použita.

## Chráněná aktiva

1. obsah příchozí a odchozí školní korespondence;
2. anonymizovaný prompt a odpověď AI;
3. lokální pracovní koncept, profil odesílatele a dočasná session data;
4. přístupový permit/session z AI Studia;
5. školní AI gateway a její serverové credentials (v klientu nesmí být);
6. release-integrity manifest, podpis, trust root a Release Registry;
7. GHRAB Platform 1.1.2, app-guard kontrakt a revokační stav;
8. auditní/evidence artefakty a build provenance.

## Útočníci / schopnosti

Model používá třídy A1–A10 GARP 2.5.1: běžný neoprávněný uživatel; uživatel s přístupem k DevTools; škodlivý obsah importovaného e-mailu; škodlivá/kompromitovaná odpověď modelu; jiná aplikace ve stejném originu; síťový útočník mimo TLS; kompromitovaný build/dependency vstup; útočník se starším platně podepsaným releasem; kompromitovaný účet/release workflow; interní provozní chyba.

## Trust boundaries

| TB | Hranice | Hlavní riziko | Kontroly |
|---|---|---|---|
| TB-01 | Uživatel → import / formulář | PII, malicious HTML, prompt injection | limity importu, sanitizace, preflight, untrusted-data delimitery |
| TB-02 | KS → GHRAB AI Core | neautorizovaná operace/model/mód | registry 8 operací, schema IDs, allowed modes, output schema |
| TB-03 | Prohlížeč → direct provider (standalone) | egress D2 dat / lokální credential | anonymizace, preflight, vědomý API key, direct-only profil |
| TB-04 | Prohlížeč → school gateway | local-key bypass / provider leak | `school-gateway` only, same-origin API, `allowLocalProviderKeys=false` |
| TB-05 | AI odpověď → DOM / další prompt | XSS, second-order injection | schema validation, text-safe rendering, model-derived data zůstávají untrusted |
| TB-06 | KS ↔ AI Studio / app-guard | token confusion, revocation, session cleanup; app-guard je načítán z cizí Studio cesty mimo RI obálku KS | appId binding, protected bootstrap, suite-session ownership; integrita app-guardu patří do Studio/RI-LIVE trust boundary |
| TB-07 | Browser storage | cross-student leakage / stale restore | namespace/ownership manifest, cleanup, BFCache/history guards, write lock |
| TB-08 | Service Worker ↔ security-critical assets | stale revocation / stale integrity | 5.10.25: security-critical assety jsou vyloučeny z precache podle jediného seznamu pravdy a obsluhovány network-only `cache:no-store` |
| TB-09 | Source → build → deployment | tamper / mixed version / unpinned build | exact lock, pinned Actions SHAs, reproducible build time, provenance, RI v2 |
| TB-10 | Release signer → trust root/registry | key theft / rollback | detached Ed25519, keyId, revoked-key denial, anti-rollback; production custody LIVE |
| TB-11 | Error reporter → support workflow | exfiltrace obsahu | allowlist diagnostiky, safe URL, canary tests, ZIP až po uživatelské akci |

## Nejkritičtější zneužití

- obcházení anonymizace nebo odeslání identity žáka do AI;
- prompt injection z importované zprávy nebo modelového mezivýstupu;
- obnova starých dat přes BFCache/multi-tab po ukončení relace;
- aktivace direct-provider módu v school build;
- service worker držící starý app-guard/platform/integrity artefakt;
- platně podepsaný, ale starší rollback release;
- mixed-version deployment;
- soukromý signing key nebo serverové secret v artefaktu/logu.

## Residual / LIVE rizika

SHIELD-LIVE, RI-LIVE, skutečný serverový auth/revocation, HSTS/served CSP, produkční signing-key custody, provider retention policy a behaviorální live-model AIR nejsou v lokálním PREP prostředí uzavírány. Tyto body zůstávají explicitně NOT TESTED/DEFERRED.

## Explicitní hranice integrity app-guardu

KS načítá `app-guard.js` z AI Studia (`/ai-studio/access/app-guard.js`, resp. standalone Studio cesta). Tento soubor neleží v deploymentu KS, není v `files[]` manifestu KS a service worker KS jej nekryje. Podepsaná integrita KS proto **neprokazuje integritu app-guardu**; tu musí uzavřít AI Studio / school-server RI-LIVE. V PREP kole KS je tato závislost deklarovaná trust boundary, nikoli PASS.

## TB-12 – Platform manifest v P3 cache (N9, Claude round 2)

`ghrab/ghrab-platform-manifest-1.1.2.json` je v release 5.10.25 distribuovaný jako
**neautoritativní build/conformance artefakt**. Runtime KS ani GHRAB Platform 1.1.2 jej
nepoužívají jako trust root ani jako referenční hodnotu pro runtime integrity check.
Proto může zůstat v P3 offline cache pouze za této podmínky: **nesmí být použit pro
bezpečnostní/integritní rozhodnutí**. Jakmile by jej budoucí Integrity Service nebo
klientský verifier začal číst jako autoritativní hash manifest, musí být před takovou
změnou přidán do `security/security-critical-assets.json`, automaticky vyřazen z P3
precache a routován network-only/no-store. Tento bod je explicitní future-change gate.
