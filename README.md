# Korespondenční asistent

Samostatný repozitář aplikace pro Gymnázium, Ostrava-Hrabůvka.

- **Verze:** 5.4.2
- **Doporučený název repozitáře:** `korespondencni-asistent`
- **GitHub Pages:** `https://daniel22-dev.github.io/korespondencni-asistent/`
- **Vlastník:** Daniel Baláž

## Co přináší verze 5.4.2

- jedno velké pracovní pole současně slouží k anonymizaci i jako přesný obsah připravený pro Gemini,
- našeptávač dovoluje bezpečné zbývající výrazy po přečtení ponechat hromadně, takže není nutné mechanicky odklikávat desítky návrhů,
- skutečná jména, instituce a místa lze dál řešit jednotlivě; pole **Zkontrolováno** se odemkne až po jejich vyřešení nebo vědomém hromadném ponechání,
- postupné označení `Petr` a `H.` se sloučí do jedné značky `osoba A`; podporována je i iniciála bez tečky a slovo `Mává` se nepřipojí,
- kontrola před odesláním má opravenou šířku textu a varianty odpovědi automaticky nepřebírají emoji,
- podpis z profilu se automaticky doplní a zobrazí v návrhu lokálně; jméno odesílatele se neposílá Gemini,
- přepracované, široké a přehledné okno **Formulace a podpisy**,
- odstraněn zbytečný vnější rámeček poznámky pro odpověď,
- **Šablony školních situací** jsou přejmenovány na **Scénáře školní komunikace**,
- vývojářské nástroje a interní testy se v produkci zobrazí pouze správci s rolí `admin`; lokální vývoj a testovací režim zůstávají zachovány.

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
