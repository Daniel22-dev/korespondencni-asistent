# Korespondenční asistent 5.9.8 — hlášení chyby

## Změny

- zavření rozepsaného hlášení používá vlastní neblokující dialog: návrat, ponechání konceptu, nebo úplné smazání;
- úplné smazání ruší aktivní snímání, uvolní URL screenshotů, vymaže text, snímky, technické chyby, připravený soubor a vytvoří nové ID hlášení;
- Gmail se otevře přímo v nové kartě ještě v okamžiku uživatelského kliknutí a ZIP se poté připraví a stáhne na původní kartě; asynchronní sestavení proto neztratí oprávnění prohlížeče otevřít novou kartu;
- po přípravě jsou vždy k dispozici přímé odkazy na Gmail a poštovní aplikaci a kopírování celé zprávy;
- systémová volba **Sdílet ZIP přes nabídku zařízení** se nabízí pouze po vytvoření ZIP a pouze při skutečné podpoře `navigator.canShare({files})`; je určena hlavně pro mobil a tablet a sama nic neposílá správci;
- návod AI Studia vysvětluje plovoucí ovládání snímání, systémovou lištu Chromu, smazání konceptu, Gmail a význam přímého sdílení.

## Soukromí

Do hlášení se automaticky nepřidávají prompty ani texty žáků. Snímky může uživatel volitelně začernit; před sdílením je nutné zkontrolovat, že neobsahují nesouvisející osobní údaje.
