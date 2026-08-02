# Korespondenční asistent

Samostatný repozitář aplikace pro Gymnázium, Ostrava-Hrabůvka.

- **Verze:** 5.7.2
- **Doporučený název repozitáře:** `korespondencni-asistent`
- **GitHub Pages:** `https://daniel22-dev.github.io/korespondencni-asistent/`
- **Vlastník:** Daniel Baláž

## Co přináší verze 5.7.2

- opraveny neexistující české tvary ženských jmen, například **Terezě → Tereze**, **Petrě → Petře** a **Barborě → Barboře**;
- zpětná kanonizace bezpečně vrací tvary **Šárce → Šárka**, **Monice → Monika**, **Lence → Lenka** a **Olze → Olga**;
- doplněno pohyblivé **-e-** u jmen **Pavel, Karel a Havel**, aniž by se měnil **Daniel**;
- mužský a ženský nominativ, například **Petr / Petra** nebo **Jan / Jana**, se už nesloučí do jedné osoby;
- u víceslovné osoby se stejnou značkou automaticky skryje také samostatné příjmení a vokativ, například **Pane Nováku**;
- přísný režim už falešně nespouštějí slova **spustíme**, **Spuštění**, **drogerie**, školní předmět **psychologie** ani technické spojení **po rozvodu vody**;
- detekce závislosti pracuje po větách, takže obecná věta „v závislosti na počasí“ nezakryje citlivý údaj v jiné větě;
- neznámý cizí tvar, který by vedl k vymyšlenému českému základu, vyžádá ruční kontrolu skloňování;
- mobilní číslo se nehlásí zároveň jako rodné číslo a neoznačené dlouhé číslo lze lokálně převést na číslo dokladu;
- citlivý rozepsaný text se neukládá do pracovní relace ani před spuštěním anonymizace;
- manuál 1.3.1 popisuje známé omezení odvozených rodinných tvarů příjmení, například **Novákovic / Novákových**;
- interní sada byla rozšířena ze **104 na 113 testů** a release gate hlídá, že jejich počet neklesne.

Podrobnosti jsou v `docs/WORKFLOW-UPDATE-5.7.2.md`.

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
