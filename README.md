# Korespondenční asistent

Samostatný repozitář aplikace pro Gymnázium, Ostrava-Hrabůvka.

- **Verze:** 5.4.3
- **Doporučený název repozitáře:** `korespondencni-asistent`
- **GitHub Pages:** `https://daniel22-dev.github.io/korespondencni-asistent/`
- **Vlastník:** Daniel Baláž

## Co přináší verze 5.4.3

- kliknutí na libovolné slovo nebo označení víceslovného úseku přímo v e-mailu otevře pevný panel napravo; u dlouhých zpráv není nutné rolovat k oddělenému seznamu,
- panel nabízí kategorie **Osoba**, **Instituce / organizace**, **Místo**, **Název / dílo**, **Kontakt**, **Jiný citlivý údaj** a **Ponechat**,
- nové bezpečné značky `[název 1]`, `[kontakt 1]` a `[citlivý údaj 1]` se zpracovávají stejně jako dosavadní náhrady a zůstávají v lokálním klíči,
- finální kontrola má tři jasné kroky: skryté údaje, návrhy k posouzení a potvrzení uživatele; vždy uvádí konkrétní důvod, proč ještě nelze pokračovat,
- hromadná volba **Ponechat všech N** je dostupná přímo ve finální kontrole,
- opakované a matoucí varovné bloky byly zjednodušeny; oranžová označuje skutečně potřebnou akci a zelená dokončený krok,
- v pokročilém režimu přibyl adresát **Jiný** s polem pro vlastní popis, například nakladatelství, knihovna nebo externí partner,
- zachovány jsou opravy 5.4.2: hromadné ponechání návrhů, slučování `Petr` + `H.` do jedné osoby, opravená kontrola a potlačení nevyžádaných emoji.

## Nahrání na GitHub

Obsah tohoto balíčku nahraj přímo do kořene repozitáře. Složky `.github`, `src`, `scripts` a `dist` musí být přímo v kořeni, nikoli uvnitř další složky.

V **Settings → Pages** nastav **Source: GitHub Actions**. Každý push do větve `main` provede build, interní testy a nasazení.

## Lokální kontrola

```bash
npm ci
npm test
```

`npm test` nejprve znovu sestaví `dist/`, zkontroluje verzi PWA, bezpečnostní bránu, duplicity ID, manifest a spustí interní testy aplikace.

## Struktura

```text
src/                    editovatelné zdroje aplikace
scripts/build.mjs       sestavení jednosouborového index.html
scripts/test.mjs        release testy nad dist/
dist/                   hotový web pro GitHub Pages
.github/workflows/      automatické nasazení
```

API klíče ani skutečné údaje žáků nepatří do repozitáře.
