# Diferenciátor jako PWA

Tato složka obsahuje instalovatelnou PWA verzi aplikace Diferenciátor.

## GitHub Pages URL

`https://daniel22-dev.github.io/diferenciator/`

## Soubory

- `index.template.html` + `styles.css` + `body.html` + `js/` – rozdělené zdroje aplikace; build (`scripts/build.mjs`) je skládá do jediného nasazovaného `index.html`
- `manifest.webmanifest` – název, ikony a instalační metadata
- `sw.js` – service worker s verzovanou cache
- `icons/` – ikony pro Android, Chrome a Apple zařízení

## Aktualizace

Při změně aplikace zvyš verzi v `js/10-release-changelog.js` v objektu `RELEASE` (a přidej záznam do `changes`) **a zároveň** v `sw.js` v konstantě `APP_VERSION`, aby se uživatelům nenačítala stará cache. Shodu obou verzí hlídá build (`scripts/build.mjs`) — při nesouladu nasazení selže.
## Offline režim

Instalace PWA slouží k pohodlnému spuštění Diferenciátoru z plochy nebo nabídky aplikací, nikoli k práci bez internetu. Při každém otevření se online ověřuje oprávnění přes AI Studio GHRAB a samotné generování využívá Gemini API. Přístupový modul se záměrně neukládá do lokální cache, aby se změna nebo odvolání oprávnění projevily bez prodlení.

