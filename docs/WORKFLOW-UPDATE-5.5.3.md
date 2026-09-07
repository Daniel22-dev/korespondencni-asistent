# Korespondenční asistent 5.5.3 — workflow update

Verze 5.5.3 zapracovává ověřené nálezy hloubkového auditu 5.5.2. Opravuje viditelnost anonymizačního kroku, české pády jmen, historii, školní scénáře, oslovení, návrhy jmen, perspektivu odesílatele, emoji, vícejazyčný předmět, dlouhé vstupy, navigaci, přístupnost, PWA a nasazení.

## Uživatelské změny
- anonymizační blok je skrytý do zahájení anonymizace a po smazání vstupu se znovu skryje;
- školní situace vždy zobrazí, co nastavila, i v jednoduchém režimu;
- v režimu Můj e-mail lze určit, zda uživatel píše jako jednotlivec, tým nebo škola;
- předmět se správně rozpozná v češtině, angličtině i španělštině;
- automatické návrhy jmen méně zvýrazňují běžná slova na začátku vět;
- dlouhé importy mají limit 60 000 znaků a doporučení vložit poslední relevantní zprávu.

## Technické změny
- odstraněna kolize CSS `display:block!important`;
- doplněna konkrétní morfologie `-ek/-ěk/-ec`;
- zavedena cache analýzy a debounce úprav klíče;
- odstraněn mrtvý skrytý rizikový náhled;
- opravena concurrency GitHub Actions a minimální verze AI Studia 0.18.9;
- testovací režim je pouze přes přesný parametr `?test=1`.

## Ověření vydání

Release gate nad sestaveným `dist/index.html` prošel: **76/76 interních testů**, bez runtime chyb a bez duplicitních ID. Statické kontroly navíc hlídají kolizi `privacy-stage` a shodu verze manuálu s README.
