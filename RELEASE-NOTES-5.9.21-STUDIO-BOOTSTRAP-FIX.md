# Korespondenční asistent 5.9.21 — oprava startu přes AI Studio

Datum: 9. 8. 2026

## Opravený problém

Při otevření KS uvnitř AI Studia byla centrální GHRAB Platform runtime vrstva dostupná ještě před odemčením chráněného aplikačního skriptu. Modul `28-ai-integration.js` proto okamžitě volal `createAiRuntimeConfig()` a četl lexikální proměnnou `geminiModel`, která byla inicializována až v pozdějším modulu `30-api-gemini.js`. JavaScript skončil chybou `ReferenceError: Cannot access 'geminiModel' before initialization`.

Shell se stihl částečně navázat, ale aplikace nedosáhla `ksAppReady=true`. Přísná kontrola startu z 5.9.20 pak správně odmítla částečný runtime a zobrazila obecnou obrazovku „Centrální přístupová služba není dostupná“, přestože samotný přístup nebyl příčinou.

## Oprava

- sdílené Gemini runtime konstanty a stav jsou přesunuty do `27-ai-runtime-state.js` před GHRAB AI integraci;
- `28-ai-integration.js` tak může bezpečně použít centrální `createAiRuntimeConfig()` i při startu přes AI Studio;
- strict-ready ochrana není vypnuta ani obejita;
- regresní Chromium test před skutečným GHRAB unlockem simuluje centrální `createAiRuntimeConfig()` a vyžaduje plný `ksShellReady` + `ksAppReady` bez runtime výjimky.
- nouzová bootstrap obrazovka při budoucím selhání zobrazí stručnou technickou příčinu a už automaticky netvrdí, že je nedostupná centrální přístupová služba.

## Rozsah

Prompty, anonymizace, přístupové tokeny, Gemini transport a uživatelská data se touto opravou nemění.
