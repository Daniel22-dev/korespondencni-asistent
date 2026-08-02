# Korespondenční asistent 5.9.0 — referenční integrace GHRAB AI Core 1.0.0

## Stav

KS 5.9.0 je první aplikace, která nepoužívá vlastní implementaci společného AI klienta. Integruje přesný vydaný artefakt GHRAB AI Core 1.0.0 a doplňuje pouze aplikační manifest operací, lokální schémata, credential hook a kompatibilní wrapper původní funkce `callGemini()`.

Výchozí produkční režim zůstává `direct-gemini` s osobním Gemini API klíčem. School Gateway není nasazením této verze automaticky aktivována.

## Co vlastní Core

- validaci runtime konfigurace;
- `defaultMode`, `allowedModes` a vědomou volbu režimu;
- Direct Gemini a School Gateway transport;
- normalizaci requestů, odpovědí a chyb;
- `clientRequestId` a nový `attemptId`;
- textové i multimodální `input.parts`;
- lokální kontrolu registru operací a `schemaId`;
- timeout, zrušení a idempotentně bezpečný gateway retry;
- health/capability handshake;
- streamovací rozhraní pro budoucí aplikace;
- jednotné české uživatelské texty chyb;
- usage události a společnou konformitní sadu.

## Co vlastní KS

- prompty a pracovní workflow;
- lokální anonymizaci a bezpečnostní preflight;
- sémantickou validaci výstupů;
- ochranu proti návratu skutečných jmen;
- UI a ukládání osobního Gemini klíče;
- mapu osmi AI operací na lokální schémata;
- stávající `callGemini()` jako kompatibilní aplikační wrapper.

## Dnešní tok

```text
uživatel
→ lokální anonymizace
→ ruční potvrzení a preflight
→ callGemini() compatibility wrapper
→ GHRAB_AI.generate()
→ Direct Gemini transport
→ Gemini API
→ lokální validace a bezpečné vrácení anonymizovaných údajů
```

## Budoucí tok

```text
uživatel
→ stejná lokální anonymizace a preflight
→ stejný aplikační wrapper
→ GHRAB_AI.generate()
→ School Gateway transport
→ školní gateway
→ serverem zvolený provider
→ lokální validace a bezpečné vrácení anonymizovaných údajů
```

## Gateway request

KS odesílá pouze registrovaný kontrakt:

```json
{
  "schema": "ghrab-ai-request-v1",
  "clientRequestId": "logical-request-id",
  "attemptId": "network-attempt-id",
  "appId": "correspondence",
  "appVersion": "5.9.0",
  "operation": "reply-draft",
  "modelProfile": "balanced",
  "input": {
    "parts": [
      { "type": "text", "text": "anonymizovaný a zkontrolovaný obsah" }
    ]
  },
  "output": {
    "schemaId": "correspondence.reply.v1"
  },
  "options": {
    "stream": false,
    "reasoningHint": "medium",
    "maxOutputTokensHint": 32768
  },
  "privacy": {
    "clientAnonymized": true,
    "preflightPassed": true
  },
  "client": {
    "locale": "cs-CZ",
    "coreVersion": "1.0.0"
  }
}
```

Osobní Gemini API klíč, lokální validační callback, anonymizační mapa ani skutečná jména nejsou součástí gateway payloadu.

## Chyby

Gateway používá HTTP status a strojový `error.code`. Serverový text se nikdy nezobrazuje přímo v UI. KS používá `GHRAB_AI.formatUserError()` a pouze u lokálních preflight chyb zachovává vlastní konkrétní vysvětlení nálezu.

## Usage autorita

V Direct Gemini režimu počítá provider requesty a tokeny Core z odpovědi Gemini. V School Gateway režimu je pro provider requesty, retry, tokeny, cenu a serverové limity autoritativní gateway. KS zůstává autoritativní pro uživatelskou akci a počet skutečně zobrazených výstupů.

## Kontrola integrity

`scripts/build.mjs` načte `ghrab-ai-core-manifest-1.0.0.json`, vypočítá SHA-256 těchto souborů a při rozdílu zastaví release:

```text
ghrab-ai-core-1.0.0.js
ghrab-ai-conformance-1.0.0.js
```

Aplikační JavaScript současně nesmí obsahovat vlastní přiřazení `window.GHRAB_AI` ani registraci vlastního síťového adaptéru.

## Testy

Release gate musí projít:

- 118 interních regresních testů KS;
- 17 testů společné Core conformance suite;
- statickou kontrolou service workeru, runtime konfigurace, PWA identity, přístupové brány a dokumentace;
- buildem s ověřenými SHA-256.

## Co zůstává na skutečný školní server

1. školní autentizace a serverová relace;
2. implementace `/api/v1/ai/generate` a `/api/v1/ai/health`;
3. serverový registr schválených operací a schémat;
4. mapování profilů na konkrétní modely;
5. serverové limity, rozpočty a idempotentní úložiště;
6. provider adapter, zpočátku pravděpodobně OpenAI;
7. serverová telemetrie bez ukládání obsahu;
8. DPA, záznam o činnostech zpracování a organizační pravidla školy;
9. integrační a zátěžové testy na reálném serveru.

## Řízené přepnutí

1. nasadit gateway a health endpoint;
2. zaregistrovat osm operací KS a jejich schémata;
3. otestovat autentizaci a limity;
4. nastavit `allowedModes` na oba režimy;
5. vědomě otestovat `school-gateway` na pilotní skupině;
6. po ověření nastavit gateway jako výchozí;
7. přímý Gemini režim ponechat po přechodnou dobu jako vědomý rollback;
8. po stabilizaci jej lze odebrat z `allowedModes`.

Automatický fallback mezi režimy zůstává zakázán.
