# Korespondenční asistent

Samostatný repozitář aplikace pro Gymnázium, Ostrava-Hrabůvka.

- **Verze:** 5.4.4
- **Doporučený název repozitáře:** `korespondencni-asistent`
- **GitHub Pages:** `https://daniel22-dev.github.io/korespondencni-asistent/`
- **Vlastník:** Daniel Baláž

## Co přináší verze 5.4.4

- v pokročilém nastavení odpovědi je nová volba **Píšu jako**: **Jednotlivec**, **Za tým / komisi** nebo **Za školu / instituci**,
- výchozí režim **Jednotlivec** drží 1. osobu jednotného čísla i tehdy, když se v původním e-mailu mluví o kolezích, škole nebo předmětové komisi,
- prompt používá jednotné tvary jako „děkuji“, „vážím si“, „projednám s kolegy“ a „budu Vás kontaktovat“,
- kontrola před exportem zachytí nechtěné množné tvary typu „vážíme“, „budeme“, „zvážíme“ nebo „projednáme“ a nepustí je bez opravy,
- Gemini má vytvořit tělo e-mailu zakončené pouze značkou `[podpis]`; vlastní „S pozdravem“ ani jméno už generovat nemá,
- aplikace před zobrazením automaticky odstraní případné rozloučení modelu před značkou `[podpis]` a profilový podpis doplní lokálně právě jednou,
- zachovány jsou změny 5.4.3: přímý výběr anonymizační kategorie v textu, jasná finální kontrola a adresát **Jiný**.

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
