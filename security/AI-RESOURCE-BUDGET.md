# KS 5.10.25 – AI resource budget

| Položka | Standalone klient | School build / požadavek na gateway |
|---|---:|---:|
| max request | 10 MiB | 18 MiB klientský strop; server musí mít stejný nebo nižší tvrdý limit |
| max jedna část | 8 MiB | 14 MiB klientský strop; server tvrdě vynutí |
| max output hint | 32 768 tokenů (tone 8 192, synonyms 4 096) | stejný hint; server je autoritativní a může snížit |
| AI calls | pouze explicitní uživatelské workflow | server rate-limit per session/user |
| concurrency | bez autonomního loopu; explicitní UI akce | doporučený strop 1 aktivní generace na workflow, malý per-user burst |
| timeout | 45 s | klient 120 s; server musí mít vlastní kratší/rovný deadline |
| retry | 0 | max 1 gateway retry |
| cancel | AbortSignal podporuje Core/request cesta | gateway musí ukončit práci po disconnect/cancel, kde provider dovolí |
| blast radius | jedna karta/jeden pracovní koncept | per-user/session izolace, globální circuit breaker |

`maxOutputTokensHint` není bezpečnostní enforcement. V school režimu musí být autoritativní limit na gateway. SHIELD-LIVE ověření rate/concurrency/token/cost limitů je NOT TESTED, dokud server neběží.
