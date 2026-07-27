# Korespondenční asistent

Samostatný repozitář aplikace pro Gymnázium, Ostrava-Hrabůvka.

- **Verze:** 5.5.5
- **Doporučený název repozitáře:** `korespondencni-asistent`
- **GitHub Pages:** `https://daniel22-dev.github.io/korespondencni-asistent/`
- **Vlastník:** Daniel Baláž

## Co přináší verze 5.5.5

- odstraněny osiřelé styly po zrušeném školním návodu a starších průvodcích;
- release gate nyní provede všechny kontroly před jediným závěrečným verdiktem;
- nové pojistky ověřují sestavený `dist/index.html` a `dist/manual/index.html`, nikoli jen zdrojové soubory;
- kapitola **Bezpečná práce s údaji** se kontroluje podle stabilního ID a struktury, ne podle konkrétního znění nadpisu;
- z finální anonymizační brány v obou pracovních cestách vede přímý odkaz na `manual/#bezpecnost`;
- opraven rozpor v dokumentaci auditu 5.5.2;
- interaktivní manuál 1.1.4 odpovídá aktuálnímu workflow;
- `dist/` se již nemá verzovat; vytváří jej automaticky build a GitHub Actions.

## Nahrání na GitHub

Obsah tohoto balíčku nahraj přímo do kořene repozitáře. Složky `.github`, `src` a `scripts` musí být přímo v kořeni, nikoli uvnitř další složky.

**Jednorázově před nahráním 5.5.5 odstraň z repozitáře dříve verzovanou složku `dist/`.** Od této verze je v `.gitignore` a při každém nasazení ji znovu vytvoří GitHub Actions.

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
dist/                   generovaný hotový web; nevkládá se do Git repozitáře
.github/workflows/      automatické nasazení
```

API klíče ani skutečné údaje žáků nepatří do repozitáře.
