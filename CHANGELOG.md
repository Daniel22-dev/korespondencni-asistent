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
