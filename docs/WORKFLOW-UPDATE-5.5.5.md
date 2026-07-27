# Korespondenční asistent 5.5.5 — dotažení bezpečnostního release

## Důvod vydání

Kontrola verze 5.5.4 potvrdila funkční přesun bezpečnostního obsahu do manuálu, ale odhalila nedotažený úklid, slabě integrované testovací pojistky, rozpor v dokumentaci a chybějící kontextový odkaz z anonymizační brány.

## Provedené změny

- odstraněny osiřelé styly `.school-guide-*`, `.safety-guide`, staré `.mini-step*` z aplikace a nepoužívané `.guide-bigline` / `.guide-quick*`;
- opraven zavádějící komentář u vývojářských nástrojů;
- statické pojistky byly přesunuty před jediný finální souhrn release gate;
- pojistky čtou nasazované `dist/index.html` a `dist/manual/index.html`;
- nepřítomnost `openSchoolGuide()` se ověřuje nad celým sestaveným HTML, ne nad jedním zdrojovým modulem;
- kapitola Bezpečná práce s údaji se ověřuje podle stabilního `id="bezpecnost"`, navigačních odkazů a struktury bezpečnostního seznamu;
- manuál má strojově čitelné atributy `data-manual-version` a `data-app-version`;
- v obou pracovních cestách je ve finální anonymizační bráně odkaz na `./manual/#bezpecnost`;
- dokument `AUDIT-5.5.2.md` obsahuje výslovnou opravu dřívějšího nepravdivého tvrzení;
- `dist/` je nově ignorované a má být odstraněno z Git repozitáře; CI jej sestaví před testem i nasazením.

## Nasazení

Před nahráním této verze jednorázově odstraň dříve verzovanou složku `dist/` z repozitáře. Poté nahraj obsah zdrojového balíčku. GitHub Pages musí používat zdroj **GitHub Actions**.
