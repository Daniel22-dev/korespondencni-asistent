# Korespondenční asistent 5.10.0 — přirozenější kontrola, oslovení a podpis

Datum: 12. 8. 2026

## Hlavní změny

- V hodnocení „Jak text působí?“ lze samostatně zaškrtnout komunikační rizika, šablonovité obraty a celkové doporučení.
- Akce „Zapracovat vybrané“ upraví pouze aktuálně zvolenou variantu a nevybrané připomínky ignoruje. Původní text zůstává v historii editoru.
- Neformální oslovení kolegy nebo člena vedení používá jen křestní jméno i po návratu anonymizační značky v 5. pádě, například `Lukáš Slouka` → `Ahoj Lukáši`.
- Profil odesílatele obsahuje volitelné jméno pro neformální podpis. Při tykání kolegovi nebo vedení lze automaticky použít například:

  ```text
  S pozdravem
  Dan
  ```

- Při vykání zůstává plné jméno. Vlastní ručně zvolený podpis se kontextovým pravidlem nepřepisuje.
- Při analýze příchozího e-mailu lze vypnout všechny automaticky rozpoznané požadavky a vytvořit odpověď pouze z vlastní poznámky.

## Ověření

- build a platformní konformita: úspěšné;
- interní regresní testy: 148/148;
- GHRAB AI Core konformita: 17/17;
- výkonové rozpočty byly vědomě navýšeny přibližně o 2–4 % kvůli novému ovládání a vloženým regresním testům a zůstávají blokující;
- fyzická Chromium kontrola je součástí GitHub Actions; v lokálním pracovním prostředí bez dostupného Chromia ji nebylo možné znovu spustit.

Zdrojový ZIP neobsahuje generovanou složku `dist`; tu vytvoří GitHub Actions při sestavení.
