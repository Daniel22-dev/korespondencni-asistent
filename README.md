# Korespondenční asistent

Samostatná PWA aplikace ekosystému AI Studio Gymnázia Ostrava-Hrabůvka.

- **Verze aplikace:** 5.9.0
- **GHRAB AI Core:** 1.0.0
- **Doporučený repozitář:** `korespondencni-asistent`
- **GitHub Pages:** `https://daniel22-dev.github.io/korespondencni-asistent/`
- **Vlastník:** Daniel Baláž
- **Interaktivní manuál:** 1.3.1 (manuál 1.3.1)

## Co přináší verze 5.9.0

KS je první referenční aplikace napojená na vydaný **GHRAB AI Core 1.0.0**.

- lokální prototyp `GHRAB_AI` a vlastních transportních adaptérů byl odstraněn;
- aplikace integruje bitově shodné vydané Core artefakty ze složky `vendor/ghrab-ai-core-1.0.0/`;
- build před sestavením ověřuje SHA-256 Core i konformitní sady proti release manifestu;
- všech osm AI operací je registrováno dvojicí `appId + operation`;
- gateway request používá `input.parts`, registrované `schemaId`, `clientRequestId` a nový `attemptId`;
- runtime rozlišuje `defaultMode` a `allowedModes`;
- přechod a rollback mezi režimy mohou být pouze vědomé, nikdy automatické;
- serverové chyby se zobrazují pomocí jednotných českých textů z Core, nikoli libovolným textem ze serveru;
- `maxOutputTokensHint` je pouze návrh klienta; skutečný strop bude vynucovat gateway;
- v režimu School Gateway jsou provider requesty, retry a tokeny autoritativně převzaty ze serveru;
- lokální anonymizace, preflight, prompty, workflow a stávající Gemini klíče zůstaly zachovány;
- release gate spouští **118 aplikačních testů** a **17 společných Core conformance testů**.

Technický popis je v `docs/SERVER-READY-5.9.0.md`.

## Provozní režimy

### Současný výchozí režim

```text
prohlížeč
→ GHRAB AI Core 1.0.0
→ Direct Gemini transport
→ Gemini API
```

Uživatel používá vlastní Gemini API klíč. Výchozí runtime povoluje pouze `direct-gemini`, takže nasazení verze 5.9.0 samo o sobě nezapíná školní server.

### Budoucí migrační režim

```text
prohlížeč
→ GHRAB AI Core 1.0.0
→ School Gateway transport
→ školní AI server
→ serverem zvolený provider
```

Prvním plánovaným serverovým providerem může být OpenAI. Aplikace však není závislá na jeho názvu, SDK ani konkrétních modelech.

Příklad řízené migrace v `src/runtime-config.js`:

```javascript
ai: {
  defaultMode: "school-gateway",
  allowedModes: ["school-gateway", "direct-gemini"],
  allowUserModeSelection: true,
  automaticFallback: false
}
```

Po ověření provozu lze `allowedModes` omezit pouze na `school-gateway`. Pro rychlý rollback se změní runtime konfigurace, nikoli aplikační logika.

## Registrované AI operace

| Operace | Profil | Výstupní schema | Běžné provider requesty |
|---|---|---|---:|
| `incoming-analysis` | balanced | `correspondence.analysis.v1` | 1 |
| `reply-draft` | balanced | `correspondence.reply.v1` | 1 |
| `outgoing-rewrite` | balanced | `correspondence.text.v1` | 1 |
| `outgoing-compose` | balanced | `correspondence.text.v1` | 1 |
| `outgoing-proofread` | balanced | `correspondence.text.v1` | 1 |
| `draft-refinement` | balanced | `correspondence.text.v1` | 1 |
| `tone-check` | economy | `correspondence.tone.v1` | 1 |
| `synonym-suggestions` | economy | `correspondence.synonyms.v1` | 1 |

Interní provider retry nebo modelový fallback se měří samostatně. Tři návrhy odpovědi v operaci `reply-draft` jsou tři výstupy, ale běžně jeden provider request.

## Struktura integrace

```text
vendor/ghrab-ai-core-1.0.0/
  ghrab-ai-core-1.0.0.js              přesný vydaný Core
  ghrab-ai-conformance-1.0.0.js       společná konformitní sada
  ghrab-ai-contract-v1.0.0.md         závazný kontrakt
  ghrab-ai-core-manifest-1.0.0.json   verze a SHA-256

src/runtime-config.js                 veřejná volba režimů, bez tajných údajů
src/js/28-ai-integration.js           operace, schema a aplikační hooky KS
src/js/30-api-gemini.js               UI osobního klíče a kompatibilní callGemini wrapper
scripts/build.mjs                     ověření hashů a sestavení jednosouborové PWA
scripts/test.mjs                      app testy + vydaná Core conformance suite
```

Aplikace nemá vlastní implementaci Core ani vlastní School Gateway adaptér. Aplikační odlišnosti jsou pouze v `28-ai-integration.js`.

## Nahrání na GitHub

Obsah zdrojového balíčku nahraj přímo do kořene repozitáře. Složky `.github`, `src`, `scripts` a `vendor` musí být přímo v kořeni.

Složka `dist/` se do repozitáře nevkládá. Vytváří ji build a GitHub Actions.

V **Settings → Pages** nastav **Source: GitHub Actions**. Každý push do větve `main` provede build, kontrolu Core hashů, testy a nasazení.

## Lokální kontrola

```bash
npm ci
npm test
```

`npm test` nejprve sestaví `dist/`, ověří přesnou Core verzi a SHA-256, spustí aplikační regresní testy a poté společnou konformitní sadu.

## Bezpečnost

- OpenAI ani jiný školní serverový klíč nesmí být v klientském kódu.
- Osobní Gemini klíč se nikdy neposílá School Gateway.
- Runtime konfigurace neobsahuje tajné údaje.
- Klientské `privacy` příznaky jsou pouze diagnostická tvrzení, nikoli serverové oprávnění.
- Prompty, odpovědi, osobní údaje a anonymizační mapy se neukládají do provozní telemetrie.
- Citlivé údaje studentů je nutné před vložením anonymizovat.
