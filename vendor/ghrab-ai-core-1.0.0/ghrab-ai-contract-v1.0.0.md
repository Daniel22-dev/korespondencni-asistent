# GHRAB AI Core Contract v1.0.0

**Stav:** vydaný a zmrazený veřejný kontrakt pro aplikace ekosystému AI Studio Gymnázia Ostrava-Hrabůvka  
**Vydání:** 2026-08-02 · Core 1.0.0
**Účel:** umožnit dnešní serverless provoz přes osobní Gemini API klíče a pozdější přechod na školní AI Gateway bez přepisování aplikační logiky  
**Zásada:** aplikace integrují vydaný Core; samy Core klienta ani jeho adaptéry neimplementují.

---

## 1. Architektonické pravidlo

Všechny aplikace, které používají AI, komunikují pouze přes vydaný artefakt **GHRAB AI Core**. Aplikační logika nesmí přímo volat Gemini, OpenAI, Anthropic ani jiného poskytovatele.

```text
aplikační workflow, prompty a lokální ochrana dat
                    ↓
             GHRAB AI Core
          ↙                     ↘
Direct Gemini transport     School Gateway transport
          ↓                     ↓
osobní klíč uživatele       školní server → serverem zvolený provider
```

Konkrétní serverový poskytovatel není součástí klientského kontraktu. Aktuálně preferovaným prvním serverovým providerem může být OpenAI, ale změna providera nesmí vyžadovat úpravu jednotlivých aplikací.

---

## 2. Fáze 0: jediný společný Core

Před migrací druhé aplikace musí vzniknout samostatně verzovaný GHRAB AI Core. Jeho veřejné API, request/response kontrakt, chybové kódy a konformitní testy se pro řadu 1.x zmrazí.

### Povinné release artefakty

```text
ghrab-ai-core-1.0.0.js
ghrab-ai-conformance-1.0.0.js
ghrab-ai-contract-v1.0.0.md
ghrab-ai-core-manifest-1.0.0.json
```

Manifest obsahuje minimálně:

```json
{
  "schema": "ghrab-ai-core-release-v1",
  "coreVersion": "1.0.0",
  "contractVersion": "1",
  "buildId": "git-commit-or-release-id",
  "artifacts": {
    "ghrab-ai-core-1.0.0.js": { "sha256": "..." },
    "ghrab-ai-conformance-1.0.0.js": { "sha256": "..." }
  }
}
```

Core za běhu vystavuje:

```javascript
GHRAB_AI.coreVersion      // "1.0.0"
GHRAB_AI.contractVersion  // "1"
GHRAB_AI.buildId          // identifikátor vydání
```

### Distribuce

- Core se vydává pouze jako otagovaná verze.
- Do aplikací se distribuuje automatizovaně přes `repository_dispatch` a Studio sync.
- Kopie v aplikaci musí být bitově shodná s release artefaktem.
- Build nebo release test aplikace vypočítá SHA-256 a porovná jej s Core manifestem.
- Lokální ruční úprava Core souboru v repozitáři aplikace je zakázána.
- Aplikační odlišnosti patří do samostatného integračního souboru a manifestu operací, nikoli do Core.

---

## 3. Rozsah Core

Core 1.x vlastní:

- validaci runtime konfigurace;
- výběr aktivního transportu;
- Direct Gemini transport;
- School Gateway transport;
- mock transport;
- normalizaci requestů a odpovědí;
- idempotenci na klientské straně;
- timeout a `AbortSignal`;
- blokující i streamovací rozhraní;
- normalizované chybové kódy;
- jednotné české uživatelské texty chyb;
- usage události;
- health/capability handshake;
- konformitní testovací sadu.

Aplikace vlastní:

- prompty a doménovou logiku;
- lokální anonymizaci a preflight;
- formuláře a uživatelské rozhraní;
- seznam vlastních AI operací;
- lokální JSON schémata výstupů;
- sémantickou validaci výsledku;
- kompatibilní wrappery starých funkcí;
- získání osobního Gemini klíče ze stávajícího UI;
- bezpečné zobrazení výsledku.

Aplikace nesmí registrovat vlastní síťový adaptér ani měnit význam veřejných metod Core.

---

## 4. Veřejné API Core 1.x

```javascript
GHRAB_AI.configure(appConfiguration)
GHRAB_AI.setMode(mode)              // pouze vědomá volba v allowedModes
GHRAB_AI.generate(request)       // Promise<GhrabAiResponse>
GHRAB_AI.stream(request)         // AsyncIterable<GhrabAiStreamEvent>
GHRAB_AI.health(options?)        // Promise<GhrabAiHealth>
GHRAB_AI.getState()
GHRAB_AI.getLastUsage()
GHRAB_AI.formatUserError(error, locale?)
```

### `configure()`

Volá se jednou při startu aplikace:

```javascript
GHRAB_AI.configure({
  app: {
    id: "correspondence",
    version: "5.9.0"
  },
  runtimeConfig: window.__GHRAB_RUNTIME_CONFIG__,
  operations: APP_AI_OPERATIONS,
  outputSchemas: APP_AI_OUTPUT_SCHEMAS,
  credentialProvider: async ({ mode }) => {
    if (mode === "direct-gemini") {
      return { apiKey: getCurrentGeminiApiKey() };
    }
    return null;
  },
  authProvider: async () => {
    // Preferována je serverová HttpOnly relace; token je pouze volitelná varianta.
    return null;
  },
  telemetrySink: event => {
    window.GHRABTelemetry?.recordAiUsage?.(event);
  }
});
```

Konfigurace aplikace nesmí měnit Core adaptéry, chybové kódy ani transportní sémantiku.

### `setMode()`

`setMode(mode)` mění pouze aktivní klientský transport a smí zvolit jen hodnotu uvedenou v `allowedModes`. Pokud `allowUserModeSelection` není povoleno, lze aktivovat pouze `defaultMode`. Metoda nikdy neprovádí automatický fallback a nemění serverová oprávnění. Při změně vysílá událost `ghrab:runtime-config-changed`.


---

## 5. Runtime režimy a přechod

Runtime konfigurace odděluje výchozí režim od povolených režimů:

```javascript
window.__GHRAB_RUNTIME_CONFIG__ = {
  schema: "ghrab-runtime-config-v1",
  ai: {
    defaultMode: "direct-gemini",
    allowedModes: ["direct-gemini"],
    allowUserModeSelection: false,
    automaticFallback: false,
    gatewayUrl: "/api/v1/ai/generate",
    healthUrl: "/api/v1/ai/health",
    requestTimeoutMs: 45000
  }
};
```

### Migrační režim

```javascript
ai: {
  defaultMode: "school-gateway",
  allowedModes: ["school-gateway", "direct-gemini"],
  allowUserModeSelection: true,
  automaticFallback: false
}
```

Pravidla:

- Automatický fallback mezi providery je zakázán.
- Pokud je povoleno více režimů, změna je vědomá uživatelská volba nebo administrátorská konfigurace.
- Při rollbacku se změní runtime konfigurace, nikoli aplikační kód.
- Pokud `allowedModes` obsahuje jednu hodnotu, uživatelský přepínač se nezobrazuje.
- Uložená uživatelská volba je platná pouze tehdy, pokud je stále v `allowedModes`.
- Runtime konfigurace nesmí obsahovat žádné tajné údaje.

---

## 6. Registr operací

Každá operace je jednoznačná dvojicí:

```text
appId + operation
```

Samotný název `test-generation` není globálně jedinečný.

Každá aplikace dodá verzovaný manifest:

```javascript
const APP_AI_OPERATIONS = {
  schema: "ghrab-ai-operations-v1",
  appId: "correspondence",
  operations: {
    "reply-draft": {
      outputSchemaId: "correspondence.reply.v1",
      defaultModelProfile: "balanced",
      allowedModelProfiles: ["balanced"],
      inputTypes: ["text"],
      streaming: false,
      requiredCapabilities: [],
      expectedOutputs: 3
    }
  }
};
```

Pravidla:

- Core odmítne lokálně neregistrovanou operaci.
- Gateway odmítne operaci, která není v autoritativním serverovém registru.
- Serverový registr vzniká ze schválených aplikačních manifestů a může obsahovat přísnější limity.
- Testovací operace smějí existovat pouze v testovacím registru.
- Aplikace nesmí použít vágní fallback typu `text-generation`, pokud nejde o řádně registrovanou operaci.

---

## 7. Vstupní části a multimodalita

Veřejné API nepoužívá jediný řetězec `input`. Používá pole částí:

```javascript
inputParts: [
  { type: "text", text: "Anonymizovaný obsah" },
  {
    type: "image",
    mimeType: "image/jpeg",
    source: { kind: "inline-base64", data: "..." }
  },
  {
    type: "document",
    mimeType: "application/pdf",
    name: "pracovni-list.pdf",
    source: { kind: "inline-base64", data: "..." }
  }
]
```

Volitelně může budoucí gateway podporovat:

```javascript
source: { kind: "gateway-asset", assetId: "..." }
```

Pravidla:

- Povolené typy vstupu určuje manifest operace.
- Klient před odesláním kontroluje velikost.
- Gateway vždy vynucuje vlastní tvrdý limit velikosti.
- Klientský limit je UX kontrola, nikoli bezpečnostní hranice.
- Aplikace, která používá pouze text, posílá jedno pole `{ type: "text" }`.

---

## 8. Logický request, pokus a idempotence

`clientRequestId` identifikuje jednu logickou uživatelskou AI akci. Při retry po nejistém síťovém výsledku se nemění.

`attemptId` identifikuje jeden konkrétní síťový pokus a při každém retry je nový.

```json
{
  "schema": "ghrab-ai-request-v1",
  "clientRequestId": "logical-request-uuid",
  "attemptId": "network-attempt-uuid",
  "workflowId": "optional-workflow-uuid",
  "appId": "correspondence",
  "appVersion": "5.9.0",
  "operation": "reply-draft",
  "modelProfile": "balanced",
  "input": {
    "parts": [
      { "type": "text", "text": "Anonymizovaný obsah" }
    ]
  },
  "output": {
    "schemaId": "correspondence.reply.v1"
  },
  "options": {
    "stream": false,
    "reasoningHint": "medium",
    "maxOutputTokensHint": 8192
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

Gateway deduplikuje podle minimálně:

```text
autentizovaný uživatel + appId + clientRequestId
```

Doporučené idempotentní okno je nejméně 10 minut.

- Duplicitní dokončený request vrátí stejný výsledek a usage metadata.
- Duplicitní právě běžící request vrátí stav `REQUEST_IN_PROGRESS` nebo se připojí k existujícímu výsledku.
- Ruční „Zkusit znovu“ po timeoutu stejné akce zachovává `clientRequestId`.
- Nově spuštěná akce nebo změněný vstup dostává nové `clientRequestId`.
- Serverové provider retry jsou autoritativně započítány serverem.

---

## 9. Výstupní schémata

Klient neposílá gateway libovolné JSON Schema. Posílá pouze registrované `schemaId`.

```json
"output": {
  "schemaId": "correspondence.reply.v1"
}
```

- Aplikace má lokální kopii schématu pro Direct Gemini režim a klientskou validaci.
- Gateway používá vlastní schválenou kopii schématu ze serverového registru.
- Upravený klient nemůže pomocí vlastního schématu vynutit neomezený výstup.
- Pro Core 1.x se používá bezpečný průnik funkcí JSON Schema podporovaný cílovými providery: jednoduché objekty, pole, primitivní typy, `required`, `enum` a jednoduché vnoření.
- Složitá `oneOf`, `anyOf`, rekurzivní `$ref` a podmíněná schémata se používají pouze po konformitním ověření.

`maxOutputTokensHint` je pouze návrh. Server jej smí snížit a nikdy jím nesmí být zvýšen limit dané operace.

---

## 10. Modelové profily a provider capabilities

Aplikace používají pouze profily:

```text
economy
balanced
quality
```

Případné další profily musí být přidány novou verzí Core kontraktu.

Konkrétní model určuje transport nebo serverová politika. Aplikace nesmí být závislá na názvu modelu.

Audit každé aplikace povinně zjistí použití provider-specifických funkcí:

- web/search grounding;
- code execution;
- file API;
- multimodální vstup;
- streaming;
- context caching;
- thinking/reasoning budget nebo level;
- function calling/tools;
- response schema/JSON mode;
- safety settings;
- model fallback;
- poskytovatelské limity délky kontextu.

Pro každou použitou funkci audit uvede:

1. zda ji Core 1.x podporuje;
2. zda má ekvivalent na plánovaném serverovém provideru;
3. jaký bude fallback;
4. jaké je riziko poklesu kvality nebo změny ceny.

---

## 11. Streaming

Core 1.x obsahuje streamovací rozhraní, ale aplikace jej používá pouze tehdy, pokud má operace `streaming: true`.

```javascript
for await (const event of GHRAB_AI.stream(request)) {
  if (event.type === "delta") appendText(event.text);
  if (event.type === "result") renderFinal(event.result);
}
```

School Gateway používá `text/event-stream` a tyto události:

```text
start
delta
result
usage
error
done
```

Každá SSE událost je JSON a obsahuje `clientRequestId` a `requestId`, pokud je známé.

- Ne-streamující operace používají `generate()`.
- Gateway nesmí bufferovat operaci, která je v registru označena jako streamovací.
- Audit musí výslovně uvést, zda současná aplikace streaming používá.
- Aplikace bez streamingu nemusí měnit své UX.

---

## 12. Úspěšná odpověď

```json
{
  "schema": "ghrab-ai-response-v1",
  "requestId": "server-request-id",
  "clientRequestId": "logical-request-uuid",
  "result": {},
  "usage": {
    "providerRequests": 1,
    "retryRequests": 0,
    "inputTokens": 2500,
    "outputTokens": 900,
    "totalTokens": 3400,
    "generatedOutputs": 3
  },
  "meta": {
    "modelProfile": "balanced",
    "latencyMs": 4200,
    "cached": false
  }
}
```

Klient:

- ignoruje neznámá nepovinná pole;
- ověří podporovanou hlavní verzi schématu;
- validuje `result` proti lokálnímu registrovanému schématu;
- provede aplikační sémantickou a bezpečnostní kontrolu;
- nesmí stavět aplikační logiku na konkrétním provideru nebo modelu.

---

## 13. Chybový kontrakt a HTTP

Chyby používají odpovídající HTTP status. Chyba se neposílá jako úspěšná odpověď s HTTP 200.

```json
{
  "schema": "ghrab-ai-error-v1",
  "requestId": "server-request-id",
  "clientRequestId": "logical-request-uuid",
  "error": {
    "code": "RATE_LIMITED",
    "retryable": true,
    "retryAfterMs": 30000,
    "budgetResetAt": null,
    "diagnosticId": "diag-uuid",
    "details": {
      "limitScope": "user"
    }
  }
}
```

Server neposílá text určený k přímému zobrazení uživateli. Pole `details` je strojově čitelné, bezpečné a omezené podle kódu chyby.

Jednotné české uživatelské texty vlastní `GHRAB_AI.formatUserError()`. Aplikace nesmí zobrazit `error.message` ze serveru ani libovolný serverový text přímo v UI.

### Minimální kódy Core 1.x

```text
AUTH_REQUIRED
AUTH_EXPIRED
ACCESS_DENIED
API_KEY_MISSING
API_KEY_INVALID
RATE_LIMITED
BUDGET_EXCEEDED
QUOTA_EXCEEDED
PAYLOAD_TOO_LARGE
UNREGISTERED_OPERATION
UNSUPPORTED_SCHEMA
FEATURE_UNSUPPORTED
REQUEST_IN_PROGRESS
IDEMPOTENCY_CONFLICT
SERVER_UNAVAILABLE
PROVIDER_UNAVAILABLE
NETWORK_ERROR
TIMEOUT
REQUEST_CANCELLED
INVALID_REQUEST
INVALID_OUTPUT
CONTENT_BLOCKED
CONFIGURATION_ERROR
PREFLIGHT_REQUIRED
PREFLIGHT_BLOCKED
OUTPUT_PRIVACY_BLOCKED
UNKNOWN_ERROR
```

Doporučené mapování:

- 400: `INVALID_REQUEST`, `UNREGISTERED_OPERATION`, `UNSUPPORTED_SCHEMA`, `FEATURE_UNSUPPORTED`
- 401: `AUTH_REQUIRED`, `AUTH_EXPIRED`
- 403: `ACCESS_DENIED`
- 409: `REQUEST_IN_PROGRESS`, `IDEMPOTENCY_CONFLICT`
- 413: `PAYLOAD_TOO_LARGE`
- 422: `INVALID_OUTPUT`
- 429: `RATE_LIMITED`, `BUDGET_EXCEEDED`, `QUOTA_EXCEEDED`
- 502: `PROVIDER_UNAVAILABLE`
- 503: `SERVER_UNAVAILABLE`
- 504: `TIMEOUT`

`retryAfterMs` se používá, pokud má klient čekání zobrazit nebo dočasně deaktivovat retry. `budgetResetAt` je ISO 8601 čas dalšího obnovení limitu, pokud je známý.

---

## 14. Retry a fallback

- Retry se provádí pouze u přechodných a idempotentně bezpečných chyb.
- Každý síťový pokus má nový `attemptId`.
- Retry stejné logické akce zachová `clientRequestId`.
- Automatický retry má omezený počet pokusů a backoff.
- Chyby autentizace, rozpočtu, neplatného vstupu a nepodporované funkce se automaticky neopakují.
- Provider fallback je interní rozhodnutí transportu nebo gateway a musí být započítán do `providerRequests`.
- Přechod `school-gateway` → `direct-gemini` nikdy není automatický provider fallback. Je to pouze vědomá změna režimu.

---

## 15. Telemetrie a autorita dat

Klientská a serverová telemetrie mají rozdílnou autoritu.

### Klient je autoritativní pro

- `userActions`;
- `generatedOutputs` skutečně zobrazené uživateli;
- vnímanou latenci UX;
- klientské validační a privacy chyby;
- zvolený režim.

### Gateway je v režimu `school-gateway` autoritativní pro

- `providerRequests`;
- `retryRequests`;
- provider fallback;
- vstupní a výstupní tokeny;
- účtovanou cenu;
- serverové limity a rozpočty;
- cache hit;
- skutečně použitou serverovou politiku.

Klient nesmí cenu nebo limity dopočítávat jako závaznou hodnotu. Události se propojují pomocí `clientRequestId`, `requestId` a `workflowId`.

Pole `privacy.clientAnonymized` a `privacy.preflightPassed` jsou pouze klientská tvrzení pro audit a diagnostiku. Server z nich nesmí odvozovat vyšší oprávnění, větší limit ani uvolnění bezpečnostní politiky.

Telemetrie standardně neobsahuje prompt, odpověď, osobní údaje, API klíč ani anonymizační mapu.

---

## 16. Autentizace

Aplikace neimplementují konkrétní OAuth tok. Autentizace je odpovědností AI Studia a School Gateway.

Preferovaný model:

```text
školní identita / Google Workspace OAuth nebo jiný schválený IdP
→ serverová relace
→ HttpOnly + Secure + SameSite cookie
→ kontrola oprávnění na gateway
```

Pokud frontend zůstane na jiné doméně, může Core získat krátkodobý podepsaný token přes `authProvider`. Dlouhodobý token se neukládá do `localStorage`.

Klientská role, e-mail, `privacy` flag ani jiný údaj z JavaScriptu nejsou serverovým oprávněním.

---

## 17. Health a dopředná kompatibilita

`GET /api/v1/ai/health` vrací například:

```json
{
  "schema": "ghrab-ai-health-v1",
  "status": "ok",
  "serverVersion": "1.0.0",
  "supportedRequestSchemas": ["ghrab-ai-request-v1"],
  "supportedResponseSchemas": ["ghrab-ai-response-v1"],
  "supportedCoreVersions": [">=1.0.0 <2.0.0"],
  "recommendedCoreVersion": "1.0.0",
  "modelProfiles": ["economy", "balanced", "quality"],
  "capabilities": {
    "streaming": true,
    "inputTypes": ["text", "image", "document"]
  },
  "limits": {
    "maxRequestBytes": 10485760
  }
}
```

Pravidla:

- Gateway při vydání nové hlavní verze podporuje aktuální a předchozí hlavní request kontrakt, tedy N a N-1, po stanovené migrační období.
- Klient ignoruje neznámá nepovinná pole.
- Klient bezpečně odmítne nepodporovanou hlavní verzi.
- Health nesmí odhalovat tajné údaje, klíče ani interní konfiguraci providerů.
- Nedostupný health endpoint nesmí sám o sobě rozbít funkční Direct Gemini režim.

---

## 18. Konformitní testy

Každá aplikace používající Core musí spustit stejnou vydanou testovací sadu. Aplikace nesmí přepisovat fixtures, aby testy prošly.

Povinné oblasti:

- ověření Core verze a SHA-256;
- výchozí režim a `allowedModes`;
- zákaz automatického fallbacku;
- registrace a odmítnutí operací;
- textový a multimodální request fixture;
- stabilní `clientRequestId` a nový `attemptId` při retry;
- timeout a zrušení;
- úspěšná gateway odpověď;
- všechny normalizované HTTP chyby;
- `retryAfterMs` a `budgetResetAt`;
- ignorování neznámých polí;
- nepodporovaná verze schématu;
- serverová autorita usage metadat;
- zákaz přenosu osobního Gemini klíče do gateway;
- zákaz zobrazení serverového textu chyby;
- streamovací SSE fixtures;
- health/capability handshake;
- lokální validace `schemaId`;
- žádné cachování API, auth a health odpovědí service workerem.

Aplikační regresní testy se přidávají nad tuto sadu; nenahrazují ji.

---

## 19. Filtr použitelnosti

Audit nejprve určí kategorii aplikace:

### A. Bez AI operací

- Core se nepřidává.
- Audit pouze zaznamená, že server-ready AI integrace není relevantní.

### B. Jedna až dvě jednoduché AI operace

- Použije se stejný vydaný Core.
- Vznikne pouze tenký aplikační wrapper, manifest operací a schémata.
- Nevytváří se vlastní adaptérová nebo klientská vrstva.

### C. Tři a více operací nebo složité workflow

- Použije se stejný vydaný Core.
- Doplní se aplikační orchestrace, `workflowId`, registry operací a podrobnější usage propojení.
- Ani zde se nesmí vytvořit vlastní kopie logiky Core.

---

## 20. Povinný audit rozsahu

Audit každé aplikace uvede:

- počet AI operací;
- počet běžných a maximálních provider requestů na jednu akci;
- počet dotčených souborů;
- orientační rozsah změn;
- riziko `nízké / střední / vysoké`;
- provider-specifické funkce;
- streaming a multimodalitu;
- stav anonymizace;
- stav testů;
- zda je bezpečné provést integraci v jednom průchodu, nebo ji rozdělit;
- pořadí migrace vůči ostatním aplikacím.

---

## 21. Kritéria hotové integrace

Integrace aplikace je hotová pouze tehdy, pokud:

1. používá přesně vydaný Core a jeho hash souhlasí;
2. nemá vlastní implementaci `GHRAB_AI` ani síťového gateway adaptéru;
3. serverless Direct Gemini režim zůstává funkční, pokud je povolen;
4. School Gateway režim lze zapnout konfigurací;
5. `defaultMode`, `allowedModes` a vědomý rollback fungují;
6. neexistuje automatický přechod mezi providery;
7. všechny operace jsou registrované dvojicí `appId + operation`;
8. request používá `input.parts`, `schemaId`, `clientRequestId` a `attemptId`;
9. klientský output token limit je jen hint;
10. serverové chyby se řídí HTTP statusem a strojovým kódem;
11. uživatelský text chyby pochází z Core;
12. usage a náklady jsou v gateway režimu autoritativně převzaty ze serveru;
13. aplikace nepoužívá klientské privacy tvrzení jako oprávnění;
14. provider-specifické funkce mají zdokumentovaný ekvivalent nebo fallback;
15. konformitní testy i aplikační regresní testy procházejí;
16. build a nasaditelný balíček jsou úspěšné;
17. přechod na jiného serverového providera nevyžaduje změnu aplikační logiky.

---

## 22. Produkční správa a ochrana dat

Před zapnutím School Gateway v produkci musí škola samostatně vyřešit smluvní, bezpečnostní a organizační podmínky zvoleného providera a zpracování školních dat. Toto je úkol serverového projektu a školní správy, nikoli individuální implementace každé aplikace.
