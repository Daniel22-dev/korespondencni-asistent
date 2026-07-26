# Korespondenční asistent jako PWA

Tato složka obsahuje instalovatelnou PWA verzi aplikace Korespondenční asistent.

## GitHub Pages URL

`https://daniel22-dev.github.io/korespondencni-asistent/`

## Soubory

- `index.template.html` + `styles.css` + `body.html` + `js/` – rozdělené zdroje aplikace; build (`scripts/build.mjs`) je skládá do jediného nasazovaného `index.html`
- `manifest.webmanifest` – název, barvy, režim standalone a ikony
- `sw.js` – service worker s verzovanou cache
- `icons/` – vlastní ikony ve stylu LifeHubu

## Instalace na telefonu

Otevři aplikaci v Chromu a zvol „Instalovat aplikaci" nebo „Přidat na plochu".

## Aktualizace

Při změně aplikace zvyš verzi v `js/10-release-changelog.js` v objektu `RELEASE` (a přidej záznam do `changes`) **a zároveň** v `sw.js` v konstantě `APP_VERSION`, aby se uživatelům nelepila stará cache. Shodu obou verzí hlídá build (`scripts/build.mjs`) — při nesouladu nasazení selže.

## Staré odkazy

V kořeni webu jsou přesměrovací soubory `Korespondencni-asistent.html` i `korespondencni-asistent.html` — starý odkaz se automaticky přesměruje do této složky.
