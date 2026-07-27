# Korespondenční asistent

Samostatný repozitář aplikace pro Gymnázium, Ostrava-Hrabůvka.

- **Verze:** 5.5.1
- **Doporučený název repozitáře:** `korespondencni-asistent`
- **GitHub Pages:** `https://daniel22-dev.github.io/korespondencni-asistent/`
- **Vlastník:** Daniel Baláž

## Co přináší verze 5.5.1

- režim **Můj e-mail** zobrazuje pracovní profil přímo v pracovním toku; role, předměty a škola se ukládají lokálně a používají jako kontext,
- volba **Rychle** transparentně používá místní pravidla a rozlišuje jednoho člověka od skupiny,
- hlavní druh práce je oddělen od podrobností zvolené akce, školního scénáře a výsledného tónu a délky,
- školní scénář je nepovinný a po výběru vypíše, které parametry změnil,
- u pouhé jazykové opravy se nezobrazují nerelevantní volby tónu a délky,
- hromadný e-mail používá množné oslovení a kontroluje nechtěné tvary určené jednotlivci,
- interaktivní manuál 1.1.0 obsahuje samostatnou část k celému režimu Můj e-mail a sjednocené označení verze.

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
