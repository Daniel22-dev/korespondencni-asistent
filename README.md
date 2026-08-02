# Korespondenční asistent

Samostatný repozitář aplikace pro Gymnázium, Ostrava-Hrabůvka.

- **Verze:** 5.7.1
- **Doporučený název repozitáře:** `korespondencni-asistent`
- **GitHub Pages:** `https://daniel22-dev.github.io/korespondencni-asistent/`
- **Vlastník:** Daniel Baláž

## Co přináší verze 5.7.1

- opravena kanonizace českých pádů osob včetně jmen a příjmení typu **Petr Novák**, **Jana Nováková**, **Marek Krejčí**, **Lucie Malá** a **Ondřej Vaněk**;
- celý navržený základní tvar se nyní zpětně ověřuje skloňováním; nejistý případ se viditelně označí a vyžádá ruční kontrolu;
- telefonní čísla a čísla dokladů používají jeden zdroj pravidel; variabilní symboly, objednávky, faktury, ISBN, IČO a DIČ už nejsou falešně blokované jako telefon;
- citlivé školní termíny jsou vyhodnocovány v kontextu, takže provozní věty o rozvodu vody, závislosti na počasí nebo objednávce z poradny nespouštějí přísný režim;
- kontrola před exportem blokuje jen prázdný text a zbylou anonymizační značku; stylistické, rodové a termínové pochybnosti jsou upozornění;
- česká pravidla používají Unicode bezpečné hranice slov a rozpoznávají také adresy a dny s diakritikou;
- přísný režim smaže a potlačí pracovní relaci se skutečnými údaji;
- smazání lokálních dat zahrnuje také předávku a provozní události AI Studia;
- importovaný i přímo uložený profil prochází whitelistem, délkovými limity a kontrolou povolených hodnot;
- funkce **Můj způsob psaní** z verze 5.7.0 zůstává beze změny a prošla auditem bez nálezu;
- interní sada byla rozšířena z **94 na 104 testů** a release gate hlídá, že jejich počet neklesne;
- interaktivní manuál 1.3.0 odpovídá verzi aplikace 5.7.1.

Podrobnosti jsou v `docs/WORKFLOW-UPDATE-5.7.1.md`.

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
