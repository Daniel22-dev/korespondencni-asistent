# Korespondenční asistent 5.8.0 — server-ready architektura

## 1. Účel změny

Verze 5.8.0 připravuje Korespondenčního asistenta na budoucí školní server, aniž by nyní rušila serverless provoz. Aplikace stále standardně používá osobní Gemini API klíč uživatele. Současně je oddělena doménová logika aplikace od konkrétního poskytovatele modelu.

Cílový princip:

```text
Aplikační workflow a prompty
        ↓
GHRAB AI Client
        ↓
aktivní transport podle runtime konfigurace
```

## 2. Současný a budoucí tok

### `direct-gemini` — výchozí provoz

```text
prohlížeč
→ lokální anonymizace a preflight
→ GHRAB AI Client
→ Direct Gemini Adapter
→ Google Gemini API
```

- používá osobní Gemini API klíč;
- zachovává stávající uložená nastavení a ruční volbu Gemini modelu;
- nepoužívá školní server;
- `useResponseSchema` je výchozí `false`, aby se nezměnil dosavadní Gemini payload;
- Gemini fallback na úsporný model zůstává součástí Direct Gemini Adapteru a je měřen jako další provider request.

### `school-gateway` — připravený budoucí provoz

```text
prohlížeč
→ lokální anonymizace a preflight
→ GHRAB AI Client
→ School Gateway Adapter
→ školní AI Gateway
→ OpenAI API nebo jiný serverem zvolený provider
```

- osobní Gemini pole se v rozhraní skryje;
- klient neposílá osobní Gemini klíč ani školní OpenAI klíč;
- autentizace je připravena na serverovou cookie nebo krátkodobý token;
- konkrétní OpenAI model bude vybírat server podle obecného profilu;
- při nedostupnosti serveru se aplikace skrytě nepřepne na Gemini.

## 3. Soubory server-ready vrstvy

| Soubor | Odpovědnost |
|---|---|
| `src/runtime-config.js` | Veřejná konfigurace režimu. Nesmí obsahovat tajné údaje. |
| `src/js/26-runtime-config.js` | Validace, bezpečné výchozí hodnoty a neměnná runtime konfigurace. |
| `src/js/28-ai-client.js` | Jednotný request/response kontrakt, výběr adaptéru, chyby a usage telemetrie. |
| `src/js/29-ai-school-gateway.js` | Budoucí HTTP transport ke školnímu serveru a testovací mock. |
| `src/js/30-api-gemini.js` | Direct Gemini Adapter, osobní klíč, modely a kompatibilní wrapper `callGemini()`. |

`callGemini()` zůstává dočasně zachován kvůli kompatibilitě současných modulů, ale vlastní síťovou komunikaci již neprovádí. Všechny požadavky předává `GHRAB_AI.generate()`.

## 4. Runtime konfigurace

Výchozí nastavení:

```javascript
window.__GHRAB_RUNTIME_CONFIG__ = {
  schema: "ghrab-runtime-config-v1",
  app: { id: "correspondence" },
  ai: {
    mode: "direct-gemini",
    gatewayUrl: "/api/v1/ai/generate",
    healthUrl: "/api/v1/ai/health",
    allowDirectMode: true,
    allowDirectFallback: false,
    defaultModelProfile: "balanced",
    requestTimeoutMs: 45000,
    directGemini: {
      useModelProfiles: false,
      useResponseSchema: false
    }
  }
};
```

Budoucí přepnutí:

```javascript
ai: {
  mode: "school-gateway",
  gatewayUrl: "/api/v1/ai/generate",
  allowDirectFallback: false
}
```

Konfigurace je veřejná. Nesmí obsahovat API klíč, heslo, dlouhodobý bearer token ani jiný tajný údaj.

## 5. Jednotný požadavek

Schéma: `ghrab-ai-request-v1`

```json
{
  "schema": "ghrab-ai-request-v1",
  "clientRequestId": "uuid",
  "workflowId": "optional-uuid",
  "appId": "correspondence",
  "appVersion": "5.8.0",
  "operation": "reply-draft",
  "modelProfile": "balanced",
  "instructions": "systémové instrukce",
  "input": "anonymizovaný vstup",
  "responseSchema": "reply",
  "outputSchema": { "type": "object" },
  "options": {
    "reasoning": "medium",
    "maxOutputTokens": 32768
  },
  "privacy": {
    "clientAnonymized": true,
    "preflightPassed": true,
    "containsSensitiveData": "unknown"
  },
  "usageContext": {
    "userActions": 1,
    "expectedOutputs": 3
  },
  "client": {
    "locale": "cs-CZ"
  }
}
```

Do School Gateway požadavku se záměrně nepřenáší:

- `localContext`;
- validační funkce klienta;
- osobní Gemini API klíč;
- zvolený konkrétní Gemini model;
- anonymizační mapa skutečných jmen.

## 6. Jednotná odpověď

Schéma: `ghrab-ai-response-v1`

```json
{
  "schema": "ghrab-ai-response-v1",
  "requestId": "server-request-id",
  "clientRequestId": "uuid",
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
    "provider": "openai",
    "modelProfile": "balanced",
    "latencyMs": 4200,
    "attempts": 1
  }
}
```

Klient po návratu stále provede svou stávající validaci výstupního schématu a kontrolu, zda odpověď neobsahuje skutečný známý údaj.

## 7. Stabilní AI operace KS

| Operace | Typický účel | Profil | Běžné provider requests | Očekávané výstupy |
|---|---|---|---:|---:|
| `incoming-analysis` | rozbor přijaté zprávy | `balanced` | 1 | 1 |
| `reply-draft` | stručná, standardní a diplomatická odpověď | `balanced` | 1 | 3 |
| `outgoing-proofread` | pravopisná a gramatická oprava | `balanced` | 1 | 1 |
| `outgoing-rewrite` | přeformulování vlastního e-mailu | `balanced` | 1 | 1 |
| `outgoing-compose` | sestavení e-mailu z bodů | `balanced` | 1 | 1 |
| `draft-refinement` | následná cílená úprava konceptu | `balanced` | 1 | 1 |
| `tone-check` | kontrola tónu a přirozenosti | `economy` | 1 | 1 |
| `synonym-suggestions` | návrh synonym | `economy` | 1 | 1 |

Thinking retry nebo modelový fallback může zvýšit počet skutečných provider requests. Proto se nesmí spotřeba počítat podle kliknutí ani podle počtu výsledných variant.

## 8. Modelové profily

Aplikační workflow používá pouze:

- `economy`;
- `balanced`;
- `quality`.

V současném Direct Gemini režimu zůstává kvůli zpětné kompatibilitě aktivní ručně zvolený Gemini model. Budoucí server si profily přeloží na aktuálně povolené GPT modely. Tím lze změnit konkrétní model bez vydání nové verze KS.

## 9. Usage telemetrie

Schéma: `ghrab-ai-usage-v1`

Odděleně se eviduje:

- `userActions`;
- `generatedOutputs`;
- `providerRequests`;
- `retryRequests`;
- `inputTokens`;
- `outputTokens`;
- `totalTokens`;
- `latencyMs`;
- `success` a normalizovaný `errorCode`.

Událost se publikuje jako `ghrab:ai-usage`. Pokud AI Studio poskytne `GHRABTelemetry.recordAiUsage`, klient jí předá stejnou anonymní provozní událost.

Prompty, texty e-mailů a odpovědi modelu nejsou součástí této události.

## 10. Normalizované chyby

Klient a gateway používají zejména:

```text
AUTH_REQUIRED
AUTH_EXPIRED
API_KEY_MISSING
API_KEY_INVALID
RATE_LIMITED
BUDGET_EXCEEDED
QUOTA_EXCEEDED
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

Rozhraní zobrazuje poskytovatelsky neutrální české zprávy. Technický detail zůstává v diagnostice správce.

## 11. Ochrana dat

Zachovaný bezpečnostní tok:

```text
skutečný text
→ lokální anonymizace
→ ruční kontrola učitelem
→ kontrola celého sestaveného promptu
→ GHRAB AI Client
→ aktivní transport
→ lokální validace odpovědi
→ lokální vrácení skutečných jmen
```

Školní server nesmí standardně logovat obsah promptu ani odpovědi. Pro audit a rozpočet postačují provozní metadata, pseudonymní uživatelské ID, operace, tokeny, počet požadavků, latence a chybový kód.

## 12. Budoucí autentizace

Preferovaný stav na stejné školní doméně:

- školní přihlášení;
- serverová relace;
- `HttpOnly`, `Secure`, `SameSite` cookie;
- kontrola oprávnění na každém serverovém požadavku.

Pokud zůstane frontend na jiné doméně, bude nutný krátkodobý podepsaný token a přesně omezený CORS origin. Klientská role `admin` není důvěryhodným serverovým oprávněním.

## 13. Co bude nutné doplnit po získání serveru

1. Implementovat `POST /api/v1/ai/generate`.
2. Implementovat přihlášení a serverovou kontrolu oprávnění.
3. Založit samostatný školní projekt OpenAI API.
4. Vytvořit serverový service account nebo projektově omezený klíč.
5. Uložit klíč do serverového secret manageru nebo proměnné prostředí.
6. Přeložit modelové profily na povolené GPT modely.
7. Implementovat tvrdé denní a měsíční limity podle uživatele, aplikace a operace.
8. Ukládat anonymní provozní statistiky do databáze.
9. Implementovat serverové timeouty, retry a idempotenci.
10. Ověřit stejný JSON kontrakt integračními testy.
11. Změnit `ai.mode` na `school-gateway`.
12. Projít produkční bezpečnostní a zátěžový test.

OpenAI API implementace bude pouze na serveru. ChatGPT Business účty učitelů jsou oddělené od API provozu a aplikace se přes ně nepřihlašuje.

## 14. Testování verze 5.8.0

Release gate ověřuje:

- výchozí `direct-gemini` režim;
- přítomnost obou adaptérů;
- jednotný request/response kontrakt;
- předání stabilní operace a modelového profilu;
- usage metadata Direct Gemini Adapteru;
- neutrální gateway payload bez API klíče a lokálního kontextu;
- správné skrytí osobního klíče ve školním režimu;
- zákaz skrytého fallbacku na Gemini;
- vyloučení runtime konfigurace a školního API z PWA cache;
- všechny dosavadní regresní testy anonymizace a workflow.

Výsledek při vydání: **118/118 interních testů prošlo**.

Skutečný školní backend zatím neexistuje, proto byl School Gateway Adapter ověřen proti deterministickému mocku. Produkční autentizace, rozpočty a skutečné OpenAI volání se musí ověřit až na serveru.
