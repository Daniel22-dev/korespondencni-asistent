# Korespondenční asistent

Samostatný repozitář aplikace pro Gymnázium, Ostrava-Hrabůvka.

- **Verze:** 5.6.1
- **Doporučený název repozitáře:** `korespondencni-asistent`
- **GitHub Pages:** `https://daniel22-dev.github.io/korespondencni-asistent/`
- **Vlastník:** Daniel Baláž

## Co přináší verze 5.6.1

- běžná spojovací slova a předložky jako `Mimochodem` nebo `Podle` se už nespojují se jménem do jedné osoby;
- ručně označený pád jména se lokálně převádí na základní tvar, například `s Adélou Kulovou` → `Adéla Kulová`;
- různé pády jedné osoby se ukládají pod jedinou značkou a skryjí se i v doplňující poznámce;
- profil odesílatele obsahuje explicitní volbu **Mužský / Ženský / Bezrodové formulace**;
- gramatický rod se přenáší do všech hlavních promptů i do následných AI úprav již vytvořeného návrhu;
- kontrola před exportem blokuje zjevný opačný rod a u bezrodové volby upozorní na rodově příznakové formulace;
- předpřipravené bloky „Potvrzení přijetí“ a „Zdvořilé odmítnutí“ jsou nově rodově neutrální;
- interní sada byla rozšířena na **89 testů**.
- interaktivní manuál 1.2.0 odpovídá verzi aplikace 5.6.1.

Podrobnosti jsou v `docs/WORKFLOW-UPDATE-5.6.1.md`.

## Nahrání na GitHub

Obsah tohoto balíčku nahraj přímo do kořene repozitáře. Složky `.github`, `src` a `scripts` musí být přímo v kořeni, nikoli uvnitř další složky.

Složka `dist/` se do repozitáře nevkládá. Vytváří ji automaticky build a GitHub Actions.

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
