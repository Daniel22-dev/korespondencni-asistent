## 5.10.15 — user privacy hotfix: EML + obecná preventivní témata (2026-08-29)

- `.eml` import lokálně odstraní identitu odesílatele z hlavičky `From:` a z přesných podpisových výskytů odvozených z této hlavičky; do anonymizačního workflow vstupuje `[odesílatel]`.
- Privacy preflight rozlišuje obecné preventivní/edukační téma od konkrétního citlivého údaje nebo incidentu. Obecné seznamy témat jsou varování, nikoli hard stop.
- Konkrétní případy (např. individuální SPU/IVP, konkrétní šikana nebo závislost) zůstávají blokované.
- Přidány regresní testy pro EML preprocessing a false-positive preventivní seznamy.

## 5.10.16 - 2026-08-30

- Opraven false-positive strict-name preflight u anonymizovaných organizačních e-mailů.
- Hard block nyní rozlišuje high-confidence osobní jména od institucí a adresních míst.
- `.eml` lokálně odstraňuje i samostatné části jména odesílatele ze signatury.
- Přidána regrese na celý anonymizovaný preventivní e-mail; stávající blokace skutečných jmen zůstávají aktivní.

## 5.10.14 — GARP 2.3 corrective round po Claude kolo 1 (2026-08-29)

- opraven C-01: výstup tone-checku se při následné úpravě konceptu už nikdy nepovyšuje na uživatelskou direktivu; uživatel potvrzuje pouze indexy a modelová zjištění zůstávají v `<untrusted-data kind="model-derived-tone-findings">`;
- opraven C-02: HTML import odstraňuje i `opacity:0`, `font-size:0`, off-screen absolutní/fixní prvky a whitespace varianty `display : none`;
- opraven C-03: výchozí jsdom cesta `scripts/test.mjs` už neaktivuje automatický `?test=1` runner; samostatný gate obsahuje negative control;
- AIR-12 nyní mutuje 24 payloadů přes více skutečných prompt builderů včetně incoming, reply-scope, synonym, user-directive a tone-derived cest;
- secret/canary scany jsou součástí P5 release orchestrace, nikoli ruční doplněk;
- neznámé hodnoty statických promptových voleb už nemají raw fallback do promptu;
- produkční build odstraňuje celý interní test-runner payload a ponechává jen fail-closed stuby; test build jej zachovává. Tím se produkční `index.html` zmenšil přibližně o 147 kB a bylo možné vrátit přísnější performance budget z 5.10.12 bez rebaseline;
- live behaviorální AIR proti produkčnímu Gemini zůstává NOT TESTED bez bezpečně dostupného credentialu.

## 5.10.13 — GARP 2.3 AI-RED prompt-injection hardening (2026-08-29)
- performance budget byl po změřeném AI-RED nárůstu 7 489 B (0,96 % index.html) úzce přebaselinován; runtime limity zůstaly beze změny.

- všechny volné nebo importované texty vstupující do AI jsou rozlišeny jako nedůvěryhodná data nebo níže-prioritní uživatelské preference;
- opraven delimiter-injection povrch u vlastního e-mailu, následných úprav a kontroly tónu;
- AI-vytěžené požadavky z příchozího e-mailu se při tvorbě odpovědi vracejí jen jako nedůvěryhodná data (ochrana proti second-order prompt injection);
- synonymní sekundární AI cesta nově používá JSON trust boundary a plná prompt-injection pravidla;
- import HTML zahazuje zjevně skrytý obsah před dalším zpracováním;
- přidán GARP 2.3 strukturální AIR-01 až AIR-12 harness s canary, cross-context kontrolou, 24 mutacemi a negative control;
- live behaviorální odolnost externího modelu není bez produkčního credentialu vydávána za PASS.

## 5.10.12 — GARP 2.2 post-Claude kolo 2 hardening (2026-08-28)

- opraven fail-safe RT-20: nemožnost vyjmenovat storage se nyní propaguje jako selhání a nesmí skončit úspěšným potvrzením smazání;
- destruktivní interní test runner je dostupný pouze v lokálním testovacím buildu a v produkci je fail-closed;
- pevné testovací canary hodnoty byly nahrazeny runtime generovanými syntetickými markery;
- GARP round-3 evidence se generuje nově a finální secret/canary scan se provádí až po vzniku QA artefaktů;
- nejde o finální release: GARP 2.2 po druhé Claude kontrole nedovoluje automaticky prodloužit nezávislou smyčku.

## 5.10.11 — GARP 2.2 corrective round 1 (2026-08-28)

- RT-20 end-work is fail-safe: deletion is verified and failure is surfaced instead of unconditional success.
- Error reporter exposes `clearDraft()` and end-work clears the in-memory report draft before reload.
- GARP RT-20 evidence scans all storage values for the synthetic canary; negative control covers a canary under a key outside the app namespace.
- AI mock hooks are disabled in the production build by a build-time flag and are available only in explicit local test builds.
- `data-manifest.json` documents prompt-debug storage, Studio bridge keys and the fetch diagnostic wrapper.
- Audit `.log` evidence is explicitly trackable despite the general `*.log` ignore rule.
- Static meta CSP is generated from `security-headers.json`; QA checks exact parity.

## 5.10.10 — 2026-08-28 — GARP 2.2 security/privacy hardening

- omezeny importované soubory na 1 MB a sanitizovány importované slovníky i bloky školní knihovny,
- blokovaný AI preflight již ve své chybové zprávě neopakuje nalezený citlivý řetězec,
- access bootstrap nevypisuje raw text výjimky,
- doplněna funkce `GHRABCorrespondencePrivacy.endWork()` a uživatelské „Ukončit práci“ s vymazáním storage, pracovního DOM/stavu a reloadem,
- datový manifest již netvrdí neimplementovanou 30denní automatickou retenci, logout mazání ani nepřipojený server delete endpoint,
- testovací fixture s identifikovatelně vypadajícím jménem byla nahrazena syntetickými údaji,
- přidány regresní testy pro privacy preflight, importní limity, sanitaci školní knihovny a end-work mazání.
- performance budget byl po změřeném bezpečnostním nárůstu jednorázově přebaselinován v úzkém rozsahu; runtime budget zůstává beze změny.

## 5.10.9 — 2026-08-27 — průřezové hardening opravy ekosystému

### Opraveno

- school-server build už neponechává natvrdo zapsanou GitHub Pages cestu `/AI-Studio-GHRAB/`; centrální Studio bootstrap, access gate a reportér používají `studioBaseUrl` z aktivního školního deployment kontraktu;
- build failuje, pokud ve školním runtime zůstane standalone Studio cesta nebo pokud hlavní aplikace či manuál nepoužívají očekávaný `app-guard.js`;
- `sharedAccessVersion` v běžném i školním profilu je synchronizována na aktuální podepsaný bundle AI Studia `access-p1-20260824175535Z-k_wtm7Zj`;
- všechny externí GitHub Actions jsou připnuté na plný commit SHA při zachování dosavadních major řad.

### Regrese

- přidán samostatný `qa:school-profile`;
- P5 a P5 CI gate nově po standardním buildu vytvářejí a kontrolují school-server artefakt;
- GitHub Pages runtime zůstává na `/AI-Studio-GHRAB/`, takže změna school-server profilu nemění současný serverless provoz.

## 5.10.8 — 2026-08-24 — oprava přísné kontroly a testovací izolace

### Opraveno

- běžné slovo `Částka` už přísná kontrola nepovažuje za možné osobní jméno;
- test úvodní obrazovky se nejprve přepne na úvod, takže neselhává při spuštění z rozpracovaného e-mailu;
- test relace si výslovně obnoví ukládání a používá bezpečné ověření struktury, takže nepřebírá potlačený stav z přísného režimu;
- testovací snapshot uchovává a po běhu obnoví také stav potlačení pracovní relace.

### Ověření

- přidán regresní scénář s anonymizovaným e-mailem o odměnách a slovem `Částka`;
- interní sada má 159 testů.

## 5.10.7 — 2026-08-23 — přísná kontrola začátku věty

- UI heuristika pro potlačení běžných slov na začátku věty zůstala beze změny.
- Přísná odesílací větev používá `includeSentenceStart`, a proto kontroluje také jednoslovné kandidáty, které se v našeptávači nezobrazují.
- Cache klíč obsahuje režimy `includeReviewed` a `includeSentenceStart`; UI a preflight si nemohou zaměnit výsledek.
- `Nguyen`, `Halama`, `Svobodou` a `Nováková` na začátku věty zastaví `assertGeminiSafety`, včetně varianty se stavem `keep-bulk`.
- Při tvorbě odpovědi se přísná kontrola jmen vztahuje na uživatelský text, poznámku a osobní styl, nikoli podruhé na body vytvořené předchozí AI analýzou.
- UI regrese ověřuje, že `Prosím` ani `Zítra` nezačnou zaplavovat panel návrhů.
- Dotčené performance limity byly kvůli nové bezpečnostní logice a testům zvýšeny o 5 kB (nejvýše 0,83 %); všechny zůstávají blokující.
- Interní sada má 158 testů.

## 5.10.6 — 2026-08-23 — druhé ověření bezpečnostních oprav

- Opravena koncovková heuristika českých příjmení: pracuje s původním NFC tvarem, takže spolehlivě zachytí také `Nováková` a `Kučerové`.
- Jednoslovné návrhy z uživatelského obsahu jsou po hromadném `Ponechat všechny` blokující; bezpečný konkrétní výraz lze propustit pouze samostatnou volbou `Ponechat` u daného slova.
- Starý stav `keep` a nový hromadný stav `keep-bulk` se při preflightu považují za nedostatečné; pouze `keep-explicit` může potvrdit jednoslovný výraz.
- JSON kódovaná zóna `untrusted-email-data` se používá v rozboru i při tvorbě tří návrhů odpovědi. Trojité uvozovky už příchozí e-mail neohraničují.
- Hostile corpus testuje obě promptové cesty; regresní příklady zahrnují `Nováková`, `Kučerové`, `Halama`, `Nguyen` a `Müller`.
- XSS sink baseline zůstává beze změny na 99 `innerHTML` a 2 `insertAdjacentHTML`; druhé kolo žádný nový sink nepřidalo.
- Dotčené performance limity byly kvůli nové bezpečnostní logice a regresním testům řízeně zvýšeny o 2–4 kB (nejvýše 0,5 %); nejde o prominutí kontroly a všechny limity zůstávají blokující.
- Interní sada má 155 testů.

## 5.10.5 — 2026-08-23 — bezpečnostní GARP

- Odesílací preflight znovu vyhodnocuje přesný prompt a kontext nezávisle na UI stavu `Ponechat`; silní kandidáti osobních jmen jsou blokující nález.
- Hromadné `Ponechat všechny` už nemůže samo o sobě propustit známé, víceslovné nebo pravděpodobně skloňované osobní jméno.
- Příchozí e-mail se analytickému modelu předává uvnitř jasně označené datové zóny jako jeden JSON řetězec; systémový prompt výslovně zakazuje interpretovat jeho obsah jako instrukce.
- Klientské `privacy.clientAnonymized` a `privacy.preflightPassed` se odvozují z úspěšného návratu bezpečnostní brány, nejsou bezpodmínečně zapsané v requestu.
- Dřívější přirozenojazykové příklady se skutečnými tvary jmen byly nahrazeny anonymními značkami, aby přísná kontrola celého promptu nezpůsobovala falešnou stopku.
- XSS sink baseline byla snížena z 100 na skutečných 99 použití `innerHTML`; CSP výjimka `unsafe-inline` zůstává evidovaným architektonickým dluhem, bez nového doloženého exploitovatelného sinku.
- Celkový `dist` rozpočet byl kvůli nové blokující kontrole a testům řízeně zvýšen o 2 kB (0,16 %); ostatní dílčí limity se nemění.
- Přidány cílené regresní testy pro čtyři pokusy obejít jmennou bránu, propsání privacy příznaků a hostile corpus deseti prompt-injection vstupů. Interní sada má 154 testů.

## 5.10.4 — 2026-08-14 — sjednocení AI profilů / referenční vzor

- Uživatelská volba je provider-neutrální: **◇ Úsporný / ⚡ Doporučený / ★ Důkladný** = `economy / balanced / quality`.
- Konkrétní Gemini ID zmizela z aplikačního UI a aplikační logiky; zůstávají pouze ve veřejné Direct Gemini runtime konfiguraci.
- `credentialProvider` už neposílá `modelOverride`; GHRAB AI Core vybírá model z runtime mapování podle `modelProfile`.
- Stejný profil se posílá i do `school-gateway`, kde konkrétní provider/model určuje server.
- Všechny operace přijímají všechny tři profily, takže globální volba uživatele není v konfliktu s registrem operací.
- Přidána explicitní `runtime-config.school-server.js` a build školního profilu ji aktivuje.
- Přidány regresní kontroly proti návratu konkrétních providerových modelů do UI/aplikační vrstvy.

## 5.10.3 — oprava rekurzivního obrazu při snímání (2026-08-13)

- pomocné video pro snímání obrazovky se nyní vkládá přímo do kořene reportéru, na který platí jeho skryté styly;
- video dostalo nezávislou inline pojistku mimo obrazovku, nulovou viditelnost, vypnuté události ukazatele a označení `aria-hidden`;
- při sdílení stejné karty a posouvání stránky už nevzniká „zrcadlová chodba“ s opakovaným rozhraním aplikace;
- statická i Chromium regresní kontrola ověřují, že pomocné video nemůže být viditelné;
- dvoukrokové stažení ZIP, odemčení Gmailu, import Gmail `.eml` a ostatní opravy verze 5.10.2 zůstávají beze změny.

## 5.10.2 — Gmail EML, jasnější sestavení a spolehlivé stažení hlášení (2026-08-13)

- odstraněno duplicitní oznámení o dostupné PWA aktualizaci při otevření aplikace;
- volba pro vytvoření nového e-mailu je nově pojmenovaná „Sestavit nový e-mail ze zadání nebo bodů“ a odpovídá souvislým instrukcím i bodovému podkladu;
- import `.eml` z Gmailu lépe zpracuje MIME strukturu, kódované hlavičky, textovou i HTML část, quoted-printable/base64 a běžná středoevropská kódování; platí bezpečný limit 40 MB;
- hlášení chyby nejprve připraví přímý odkaz ke stažení ZIP a až po skutečném kliknutí zpřístupní předvyplněný Gmail;
- rozhraní i e-mail výslovně uvádějí, že Gmail místní ZIP automaticky nepřipojí a uživatel jej musí přiložit ručně;
- opraven selektor prohlížečového CI testu, který zaměňoval tlačítko „Připravit ZIP balíček“ za dřívější primární tlačítko snímání obrazovky;
- fyzický download v Chromium testu se ověřuje podle skutečně uloženého ZIPu na disku, nikoli pomocí zachytávání programového `link.click()`, které se při skutečném myším kliknutí nespouští;
- regresní sada má 151 interních testů a samostatnou statickou i prohlížečovou kontrolu reportéru.

## 5.10.1 — šablony, rychlé úpravy a čitelná oznámení (2026-08-13)

- neplatná testovací šablona s názvem `<b>šablona</b>` se už nemůže propsat do uložených dat; starý neplatný záznam se při načtení automaticky odstraní a platné šablony zůstanou zachované;
- tlačítka „Zkrátit“, „Zmírnit“, „Zpřesnit“ a „Přirozeněji“ už u bezpečně vygenerovaného konceptu neblokují běžná slova s velkým písmenem v předmětu, například `Informace`;
- bezpečnost zůstává zachována: po ruční změně konceptu se znovu použije úplná kontrola možných jmen, kontaktů a citlivých údajů;
- delší chyby a bezpečnostní upozornění zůstávají zobrazené do ručního zavření, mají vlastní tlačítko „Zavřít“, jsou širší a nepřekrývají spodní ovládací lištu;
- krátká potvrzení se zavírají automaticky až po delší, délce textu přizpůsobené době;
- regresní sada zůstává na 148 testech a nově přímo ověřuje import neplatné šablony i rychlou úpravu předmětu `Informace k odměnám`.

## 5.10.0 — přirozenější oslovení, podpis a volitelné AI úpravy (2026-08-12)

- kontrola „Jak text působí?“ nabízí samostatné zaškrtávací volby pro komunikační rizika, šablonovité obraty a celkový návrh;
- tlačítko „Zapracovat vybrané“ upraví pouze právě zvolenou variantu, respektuje nevybrané body a uloží změnu do historie verzí;
- při tykání kolegovi nebo vedení se po anonymizaci vrací pouze křestní jméno i ze značky osoby v 5. pádě, například `Lukáš Slouka` → `Ahoj Lukáši`;
- profil obsahuje volitelnou podobu jména pro neformální podpis; u kolegy nebo vedení s tykáním lze použít `S pozdravem` a `Dan`, při vykání zůstává plné jméno a vlastní podpis se nepřepisuje;
- odpověď lze vytvořit bez vybraného automaticky rozpoznaného požadavku, pokud uživatel zadá celý obsah do poznámky;
- výkonové limity byly pro minor verzi zvýšeny přibližně o 2–4 % kvůli novému ovládání a regresním testům, nadále zůstávají blokující součástí release gate;
- interní regresní sada byla rozšířena na 148 testů.

## 5.9.22 — Další možnosti, profil a vlastní předmět (2026-08-12)

- automatické testy se spouštějí až tlačítkem, během běhu ukazují průběh a nevytvářejí záplavu dočasných hlášek;
- testovací běh bezpečně obnovuje profil, aplikační úložiště, formuláře i otevřenou pracovní cestu; opraveny dva pády způsobené platformní migrací storage klíčů;
- profil odesílatele se při vyplňování nezavře kliknutím mimo formulář a při chybě uložení zůstane otevřený s viditelnou zprávou;
- při sestavení nebo přepisu lze zadat vlastní předmět, který se do výsledku doplní pouze lokálně a neposílá se AI;
- kontrola „Jak text působí?“ analyzuje tělo zprávy bez předmětu a nedotčený návrh z potvrzeného bezpečného zdroje falešně nevrací k anonymizaci;
- rozšířen Chromium regresní test o 42 fyzických klikacích kontrol hlavních cest, celé nabídky Další možnosti a všech čtyř vývojářských nástrojů; interní sada má 144 testů.

## 5.9.21 — oprava startu uvnitř AI Studia (2026-08-09)

- opraven pád chráněného aplikačního skriptu při startu s již aktivním centrálním GHRAB Platform runtime (`ReferenceError: Cannot access 'geminiModel' before initialization`);
- Gemini model/key runtime stav je inicializován v novém modulu `27-ai-runtime-state.js` ještě před `28-ai-integration.js`;
- produkční strict-ready kontrola z 5.9.20 zůstává zachována a nyní správně dosáhne `ksAppReady=true`;
- `qa:ui` nově před unlockem simuluje dostupnost `GHRAB_PLATFORM.createAiRuntimeConfig()` a brání návratu stejné TDZ regrese.
- nouzová startovací obrazovka už netvrdí automaticky výpadek centrální přístupové služby; bezpečně zobrazí stručnou technickou příčinu, pokud bootstrap skutečně selže.

## 5.9.20 — UI hotfix + CI stabilizace (2026-08-09)

- odstraněno automatické onboarding překrytí, které mohlo zachytit první kliknutí nad aplikací;
- kritické shell ovládání se váže v rané vrstvě a bootstrap ověřuje plný ready stav;
- přidán regresní Chromium test se skutečným GHRAB Platform unlockem a fyzickými kliknutími;
- CI test nyní odolně čeká na CDP `page` target a v případě potřeby jej vytvoří přes `Target.createTarget`;
- sjednocena release metadata 5.9.20 v README a changelogu.

## 5.9.19 — P5 (2026-08-05)


## 5.9.19 — P5 R2

- P5 R2 runtime audit se skripty a odemčeným UI.
- Reprodukovatelné deklarované QA závislosti a blokující exact axe v CI.


- Předprodukční akceptace bez povinného školního serveru.
- Nulové otevřené automatické a11y nálezy jsou podmínkou P5 brány.
- Přidán aktualizovaný release-acceptance kontrakt a odložený GitHub upload.

# Changelog

## 5.9.17 — P4 FINAL (2026-08-04)

- Finální certifikace, čisté buildy, přístupnost, výkon, bezpečnost a release evidence.
- Přidána povinná `qa:p4:ci` brána.

## 5.9.16 - 2026-08-04 (P3)

- Platforma 1.1.0, pristupnost, performance budgety a modularizace P3.

## 5.9.15 — P2: sjednocení platformy GHRAB (2026-08-04)

- jeden kanonický školní logotyp a jednotná autorská patička;
- GHRAB Platform 1.0.0: motiv, storage namespace s vratnou migrací, Studio Bridge 2.0 a artifact envelope v1;
- jednotný název PWA cache `ghrab-correspondence-v5.9.15` a řízená aktualizace;
- platformní konformitní test je součástí buildu a CI.


## 5.9.14 — P1 (2026-08-04)

- Produkční bezpečnost, serverový profil, datové manifesty a jednotná observability vrstva.
- GHRAB AI Core 1.0.0 a přepínání direct-gemini / school-gateway.

# Changelog

## 5.9.13 — 2026-08-04

- Etapa P0: referenční serverová implementace zůstává zachována; aktualizován kanonický reportér 1.1.0 s bezpečnou délkou Gmail URL, focus trapem a správnou identitou nového hlášení.
## 5.9.12 — 2026-08-03

- sjednocen technický reportér s kanonickou implementací AI Studio GHRAB;
- odstraněna paralelní KS implementace a kompatibilitní vrstva;
- doplněny dynamické motivy, řízený koncept, až pět screenshotů, ZIP a nativní Gmail workflow;
- reportér, CSS a aplikační adaptér jsou verzované a cachované service workerem;
- lokální manuál odkazuje na centrální návod a nevytváří druhou instanci.

Podrobnosti starších verzí jsou v `docs/WORKFLOW-UPDATE-*.md`.
