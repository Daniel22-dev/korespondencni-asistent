# KS 5.10.25 – attack surface inventory

## Vstupy
- ručně vložený text a formulářové hodnoty;
- import `.eml`, textových/školních JSON artefaktů a lokální knihovny;
- URL/navigation/BFCache/history lifecycle;
- AI Studio handoff a suite-session události;
- odpověď GHRAB AI Core/modelu;
- runtime/deployment konfigurace;
- service-worker lifecycle a cache;
- error events, rejected promises a HTTP/network diagnostika.

## Výstupy
- text konceptu do DOM;
- kopírování/export uživatelem;
- lokální JSON/export školní knihovny;
- ZIP diagnostika error reporteru;
- AI request přes direct Gemini ve standalone profilu nebo same-origin school gateway ve školním profilu.

## Síť
- standalone: Gemini endpoint povolen jen v obecném CSP a runtime profilu;
- school build: `connect-src 'self'`, gateway `/api/v1/ai/*`, provider-neutrální klient;
- app-guard/AI Studio cesty jsou same-origin;
- žádný autonomní modelový tool/MCP/action egress.

## Storage
- localStorage/sessionStorage podle `src/config/data-manifest.json`;
- PWA Cache Storage;
- pracovní data se účastní suite-session cleanupu;
- některé neobsahové preference/tombstones zůstávají záměrně.

## Privilegované / security-critical komponenty
- `/ai-studio/access/app-guard.js` nebo standalone Studio ekvivalent;
- `ghrab/ghrab-platform.js`;
- runtime/deployment config;
- `release-integrity.json` + `.sig`;
- budoucí Release Registry / Integrity Service na serveru.

## Agentic surface
`AGENTIC=NO`. Model vrací pouze strukturovaný/textový obsah osmi registrovaných AI operací. Nemá tool registry, MCP, shell, file write, síťový nástroj, autonomní loop ani oprávnění provést akci jménem uživatele.
