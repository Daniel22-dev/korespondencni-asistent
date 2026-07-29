# Korespondenční asistent

Samostatný repozitář aplikace pro Gymnázium, Ostrava-Hrabůvka.

- **Verze:** 5.6.0
- **Doporučený název repozitáře:** `korespondencni-asistent`
- **GitHub Pages:** `https://daniel22-dev.github.io/korespondencni-asistent/`
- **Vlastník:** Daniel Baláž

## Co přináší verze 5.6.0

- bezpečnostní pravidla se z anonymizačního kroku otevírají v modálním okně přímo v aplikaci; úplný manuál se otevírá v nové kartě;
- rozpracovaná anonymizace, klíč náhrad, kontrola i aktuální pracovní krok se dočasně ukládají do `sessionStorage` a po návratu nebo obnovení stejné karty se obnoví;
- poznámky pro odpověď procházejí stejnou přísnou anonymizací jako hlavní text; nevyřešený možný identifikátor odeslání zastaví;
- před každým API voláním se kontroluje celý skutečně sestavený prompt včetně poznámky, voleb a doplňujícího kontextu;
- u poznámek jsou lokální štítky ve tvaru `osoba B · Cecilia`; skutečné jméno se do Gemini neposílá;
- Gemini pracuje se strojovými značkami osob a požadovaným gramatickým pádem, skutečný tvar jména se doplní až lokálně v prohlížeči;
- pádové tvary lze u neobvyklých jmen jednorázově zkontrolovat a upravit v klíči náhrad;
- odpověď Gemini se před zobrazením znovu bezpečnostně kontroluje a známé skutečné údaje se nesmějí objevit bez vědomého odanonymizování;
- interaktivní manuál 1.2.0 odpovídá novému workflow;
- interní sada byla rozšířena na **85 testů**.

Podrobnosti jsou v `docs/WORKFLOW-UPDATE-5.6.0.md`.

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
