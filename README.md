# Korespondenční asistent

**Aktuální verze:** 5.10.22  
**Platforma:** GHRAB Platform 1.1.2 · etapa P5 / ecosystem release-wave candidate


Samostatná PWA aplikace ekosystému AI Studio Gymnázia Ostrava-Hrabůvka.

- **Verze aplikace:** 5.10.22
- **GHRAB AI Core:** 1.0.0
- **Doporučený repozitář:** `korespondencni-asistent`
- **GitHub Pages:** `https://daniel22-dev.github.io/korespondencni-asistent/`
- **Vlastník:** Daniel Baláž
- **Interaktivní manuál:** 1.3.16 (manuál 1.3.16)

## Co přináší verze 5.10.22

Verze 5.10.22 je cílený hotfix posledního zbývajícího GitHub Actions pádu po 5.10.21. Všechny ostatní release kontroly byly zelené; `qa:browser` však skončil ještě před testováním aplikace, protože DevTools `/json` v krátkém startovacím okně Chromia neobsahovalo žádný target `type: page` a harness okamžitě četl `undefined.webSocketDebuggerUrl`.

Browserový P3 harness nyní na page target opakovaně čeká. Pokud se target stále neobjeví, pokusí se vytvořit `about:blank` přes DevTools HTTP endpoint `/json/new` metodou PUT a znovu čeká. Při skutečné nedostupnosti skončí čitelnou chybou `Chromium page target timeout`. Produkční runtime, suite-session logika a vendor GHRAB Platform 1.1.2 se tímto hotfixem funkčně nemění.

Technický souhrn je v `RELEASE-NOTES-5.10.22-BROWSER-QA-TARGET-HOTFIX.md`.

## Co přináší verze 5.10.21

Verze 5.10.21 je cílený accessibility hotfix po GitHub Actions bězích 92018677848/877/916/924/925. 5.10.20 už v CI odstranila runtime init chyby (`initFailures: 0`) a suite-session scénáře včetně Browser Back/Forward zůstaly PASS. Jediným blokérem byl skutečný Axe `color-contrast` nález v interaktivním manuálu.

Deset názvů glossary položek používalo tmavý teal `#2c6e6b` na panelu `#111e2c`, což Axe 4.12.1 změřilo na 2,84:1 místo požadovaných 4,5:1. Barva těchto názvů je nyní `#59b8b2` (výpočtově přibližně 7,16:1). Axe pravidla ani release threshold nebyly oslabeny. Produkční suite-session logika a Platforma 1.1.2 se nemění.

Technický souhrn je v `RELEASE-NOTES-5.10.21-AXE-CONTRAST-HOTFIX.md`.

## Co přináší verze 5.10.20

Verze 5.10.20 je QA/runtime bootstrap hotfix po GitHub Actions bězích 91911707721/726/763/866. Suite-session Browser Back/Forward regresní scénář 5.10.19 už v CI prošel; nový pád vznikl až v `qa:runtime`, kde auditní harness měnil `application/ghrab-protected` na běžný JavaScript. Tím spustil aplikační suite-session modul ještě před deferred GHRAB Platform 1.1.2 a vyvolal správný fail-closed stav `blocked`.

5.10.20 produkční suite-session logiku nemění. `qa:runtime` a `qa:axe` nyní zachovávají chráněné skripty inertní, počkají na skutečnou Platformu 1.1.2 a odemknou je přes `GHRAB_PLATFORM.unlockProtectedScripts()`. Harness tak kopíruje produkční pořadí Platform → protected app.

Technický souhrn je v `RELEASE-NOTES-5.10.20-QA-RUNTIME-BOOTSTRAP-HOTFIX.md`.

## Co přináší verze 5.10.19

Verze 5.10.19 navazuje na 5.10.18 a opravuje druhou Browser Back/Forward větev reprodukovanou v GitHub Actions. Chromium nemusí návrat provést jako čisté BFCache resume; může vytvořit nový dokument s `navigation.type = back_forward`. V takovém případě se platformní replay mohl spustit během načítání, aplikace uklidila ještě prázdný formulář a zapsala ACK, a browser následně obnovil starou hodnotu textarea z historie.

Child nyní rozpozná history traversal už při bootu, před registrací suite replay handleru. Stránku drží v `restoring` stavu, replay/guard odloží a nucený cleanup provede až po `pageshow` a post-restore tasku. Stejná ochrana zůstává i pro `pageshow.persisted=true`. Přidána je deterministická regrese `browser-history-fresh-navigation-replay`.

Technický souhrn je v `RELEASE-NOTES-5.10.19-SUITE-HISTORY-TRAVERSAL-HOTFIX.md`. Platforma zůstává **GHRAB Platform 1.1.2**; E-01/F-02/F-03 na úrovni celého ekosystému tím nejsou automaticky uzavřeny.

## Co přináší verze 5.10.18

Verze 5.10.18 je bezpečnostní hotfix nad migrací Platform 1.1.2. Opravuje Browser Back/Forward / BFCache cestu, při níž Chromium mohlo po správném vyčištění storage znovu zobrazit starou hodnotu formuláře z uloženého DOM snapshotu.

Při odchodu stránky do BFCache si child nově uloží stav suite generation, odloží zpracování nového suite signálu po dobu zmrazení a při `pageshow` s `persisted=true` drží obsah skrytý. Pokud během nepřítomnosti vznikla nová nebo dosud nezpracovaná suite generation, po skutečném obnovení DOM se provede nucený idempotentní lokální cleanup a teprve potom acknowledgement. Selhání zůstává fail-closed.

Technický souhrn hotfixu je v `RELEASE-NOTES-5.10.18-SUITE-BFCACHE-HOTFIX.md`. Platforma zůstává **GHRAB Platform 1.1.2** a tento child hotfix sám neuzavírá ekosystémové E-01/F-02/F-03.

## Co přináší verze 5.10.17

Verze 5.10.17 migruje Korespondenčního asistenta na **GHRAB Platform 1.1.2** a kontrakt `ghrab-suite-session-v1`. Při ukončení společné relace AI Studia aplikace ownership-aware uklidí pouze svůj pracovní obsah, session data, credentials, prompt/debug data, Studio handoff/event řádky a obsahový migrační backup označené pro smazání. Bezpečnostní tombstones a neosobní manuálové nastavení zůstávají zachovány.

Suite lifecycle rozlišuje přijetí signálu, dokončení cleanupu, per-tab dokončení a platformní acknowledgement; ACK vzniká až po ověřeném lokálním úklidu. Přidány jsou replay/ multi-tab/ history guards, write lock proti obnovení starých dat a fail-closed chování při chybě úložiště. Data manifest byl srovnán se skutečnými persistence writery v rámci PC-01.

Technický souhrn migrace je v `RELEASE-NOTES-5.10.17-PLATFORM-1.1.2.md`. Kandidát není sám o sobě prohlášením o uzavření ekosystémového E-01.

## Co přináší verze 5.10.16

Verze 5.10.16 opravuje druhou falešně pozitivní privacy cestu nalezenou při osobním testování. Finální odesílací brána už nepovyšuje každý neurčitý kandidát s velkým písmenem na osobní jméno. Tvrdě blokuje vysokou jistotu osoby, zatímco instituce a adresní řádky zůstávají ke kontrole. Import Gmail `.eml` navíc lokálně odstraňuje i samostatné části jména odesílatele ze signatury.

Technický souhrn je v `RELEASE-NOTES-5.10.16-STRICT-NAME-HOTFIX.md`.

## Co přináší verze 5.10.15

Verze 5.10.15 je uživatelský privacy hotfix navazující na bezpečnostní kandidát 5.10.14. Opravuje dvě falešně pozitivní cesty zjištěné při osobním testování běžných školních e-mailů, aniž by uvolnila blokaci skutečných osobních nebo citlivých údajů.

- import Gmail `.eml` lokálně nahradí identitu z hlavičky `From:` značkou `[odesílatel]` a odstraní stejné přesné jméno/e-mail i z podpisu zprávy;
- obecné preventivní a kurikulární seznamy témat (např. prevence šikany, závislostí nebo sebepoškozování) už nejsou automaticky považovány za konkrétní citlivý údaj;
- konkrétní případový kontext, například individuální SPU/IVP, konkrétní šikana, vyšetření nebo závislost, zůstává blokující;
- široký detektor citlivých termínů nadále vypíná historii/debug, takže obecné citlivé téma se neukládá do diagnostické historie;
- přidány regresní scénáře se syntetickými osobami a doménami `example.cz`; interní sada má 171 testů + 17 testů GHRAB AI Core conformance.

Technický souhrn hotfixu je v `RELEASE-NOTES-5.10.15-USER-PRIVACY-HOTFIX.md`.

## GHRAB AI Core

KS je referenční aplikace napojená na vydaný **GHRAB AI Core 1.0.0**.

- aplikace integruje bitově shodné vydané Core artefakty ze složky `vendor/ghrab-ai-core-1.0.0/`;
- build před sestavením ověřuje SHA-256 Core i konformitní sady proti release manifestu;
- všech osm AI operací je registrováno dvojicí `appId + operation`;
- gateway request používá `input.parts`, registrované `schemaId`, `clientRequestId` a `attemptId`;
- runtime rozlišuje `defaultMode` a `allowedModes`;
- přechod a rollback mezi režimy mohou být pouze vědomé, nikdy automatické;
- serverové chyby se zobrazují pomocí jednotných českých textů z Core, nikoli libovolným textem ze serveru;
- `maxOutputTokensHint` je pouze návrh klienta; skutečný strop vynucuje gateway;
- v režimu School Gateway jsou provider requesty, retry a tokeny autoritativně převzaty ze serveru;
- lokální anonymizace, skloňování a preflight zůstávají nezávislé na zvoleném AI provideru.

Server-ready integrace je popsána v `docs/SERVER-READY-5.9.1.md`.

## Provozní režimy

### Současný výchozí režim

```text
prohlížeč
→ GHRAB AI Core 1.0.0
→ Direct Gemini transport
→ Gemini API
```

Uživatel používá vlastní Gemini API klíč. Výchozí runtime povoluje pouze `direct-gemini`, takže standardní build 5.10.20 sám o sobě nezapíná školní server. School-server build aktivuje samostatnou `runtime-config.school-server.js`.

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
src/js/35-czech-person-grammar.js     jediný engine pádových tvarů osob
src/js/40-anonymizace.js              anonymizace, kanonizace, editor a lokální návrat jmen
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

`npm test` nejprve sestaví `dist/`, ověří přesnou Core verzi a SHA-256, spustí 155 aplikačních regresních testů a poté společnou konformitní sadu.

## Bezpečnost

- OpenAI ani jiný školní serverový klíč nesmí být v klientském kódu.
- Osobní Gemini klíč se nikdy neposílá School Gateway.
- Runtime konfigurace neobsahuje tajné údaje.
- Skutečná jména, jejich pády a anonymizační mapa zůstávají lokálně; model dostává pouze bezpečné značky.
- Klientské `privacy` příznaky jsou pouze diagnostická tvrzení, nikoli serverové oprávnění.
- Prompty, odpovědi, osobní údaje a anonymizační mapy se neukládají do provozní telemetrie.
- Citlivé údaje studentů je nutné před vložením anonymizovat.
## Referenční AI profily

Od verze **5.10.4** je KS referenční implementací tří provider-neutrálních profilů pro AI Studio GHRAB: `economy` (**Úsporný**), `balanced` (**Doporučený**) a `quality` (**Důkladný**). Aplikační kód neposílá konkrétní model ani `modelOverride`; Direct Gemini mapování je pouze v `src/runtime-config.js` a školní build používá `src/runtime-config.school-server.js`, kde konkrétní provider/model určuje server.
